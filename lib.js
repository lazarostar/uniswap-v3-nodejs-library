const ethers = require("ethers");
const JSBI = require("jsbi");
const {
  ADDRESS_ZERO,
  Pool,
  FACTORY_ADDRESS,
  Position,
  nearestUsableTick,
  NonfungiblePositionManager,
  priceToClosestTick,
  tickToPrice,
} = require("@uniswap/v3-sdk");
const {
  abi: IUniswapV3FactoryABI,
} = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");
const {
  abi: INonfungiblePositionManagerABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const {
  AlphaRouter,
  SwapType,
  SwapToRatioStatus,
  SWAP_ROUTER_02_ADDRESS,
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS
} = require("@uniswap/smart-order-router");
const {
  CurrencyAmount,
  TradeType,
  Percent,
  Fraction,
  Price,
} = require("@uniswap/sdk-core");

const { Tokens, Networks } = require('./tokens')

const V3_SWAP_ROUTER_ADDRESS = SWAP_ROUTER_02_ADDRESS;
const V3_POSITION_NFT_ADDRESS = NONFUNGIBLE_POSITION_MANAGER_ADDRESS;

const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

const IERC20MinimalABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        name: "_spender",
        type: "address",
      },
      {
        name: "_value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const __getTokenIdFromTransactionLogs = (logs) => {
  for (const log of logs) {
    // signature of event Transfer (index_topic_1 address from, index_topic_2 address to, index_topic_3 uint256 tokenId)
    if (log.address === V3_POSITION_NFT_ADDRESS && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      return Number.parseInt(log.topics[3], 16)
    }
  }
  return -1
}

const __getTokenByAddress = (address, network) => {
  Object.values(Tokens[network]).find;
  for (let symbol in Tokens[network]) {
    if (Tokens[network][symbol].address === address)
      return Tokens[network][symbol];
  }
  return null;
};

async function __getPoolImmutables(poolContract) {
  const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
    await Promise.all([
      poolContract.factory(),
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.tickSpacing(),
      poolContract.maxLiquidityPerTick(),
    ]);

  const immutables = {
    factory,
    token0,
    token1,
    fee,
    tickSpacing,
    maxLiquidityPerTick,
  };
  return immutables;
}

async function __getPoolState(poolContract) {
  const [liquidity, slot] = await Promise.all([
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  const PoolState = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
  };

  return PoolState;
}

const __poolCache = [];
const __getPoolPositionInfo = async (
  web3Provider,
  walletAddress,
  token0,
  token1,
  feeTier,
  tickLower,
  tickUpper,
  liquidity,
  tokenId,
  isActive
) => {
  const i = __poolCache.findIndex(
    (item) =>
      (item.token0.address === token0.address &&
        item.token1.address === token1.address &&
        item.feeTier === feeTier) ||
      (item.token0.address === token1.address &&
        item.token1.address === token0.address &&
        item.feeTier === feeTier)
  );
  if (i > -1) {
    return {
      tick: __poolCache[i].tick,
      amount0: __poolCache[i].amount0,
      amount1: __poolCache[i].amount1,
      unclaimedFee0: __poolCache[i].unclaimedFee0,
      unclaimedFee1: __poolCache[i].unclaimedFee1,
    };
  }

  const positionManagerContract = new ethers.Contract(
    V3_POSITION_NFT_ADDRESS,
    INonfungiblePositionManagerABI,
    web3Provider
  );
  const factoryContract = new ethers.Contract(
    FACTORY_ADDRESS,
    IUniswapV3FactoryABI,
    web3Provider
  );
  const poolAddress = await factoryContract.getPool(
    token0.address,
    token1.address,
    feeTier
  );
  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    web3Provider
  );
  const [immutables, state] = await Promise.all([
    __getPoolImmutables(poolContract),
    __getPoolState(poolContract),
  ]);
  const pool = new Pool(
    token0,
    token1,
    immutables.fee,
    state.sqrtPriceX96.toString(),
    state.liquidity.toString(),
    state.tick
  );
  const position = new Position({
    pool: pool,
    tickLower: tickLower,
    tickUpper: tickUpper,
    liquidity: liquidity,
  });

  let unclaimedFee0 = 0,
    unclaimedFee1 = 0;
  if (isActive) {
    const results = await positionManagerContract.callStatic.collect({
      tokenId,
      recipient: walletAddress,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    });
    unclaimedFee0 = (
      parseFloat(results.amount0) / Math.pow(10, token0.decimals)
    ).toPrecision(4);
    unclaimedFee1 = (
      parseFloat(results.amount1) / Math.pow(10, token1.decimals)
    ).toPrecision(4);
  }

  __poolCache.push({
    token0,
    token1,
    feeTier,
    tick: state.tick,
    amount0: position.amount0.toSignificant(5),
    amount1: position.amount1.toSignificant(5),
    unclaimedFee0,
    unclaimedFee1,
  });
  return {
    tick: state.tick,
    amount0: position.amount0.toSignificant(5),
    amount1: position.amount1.toSignificant(5),
    unclaimedFee0,
    unclaimedFee1,
  };
};

function Init(walletAddress, privateKey, network, rpcUrl) {
  const web3Provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const router = new AlphaRouter({
    chainId: network,
    provider: web3Provider,
  });

  let wallet, connectedWallet;
  try {
    wallet = new ethers.Wallet(privateKey);
    connectedWallet = wallet.connect(web3Provider);
  } catch (e) {
    console.log('* Couldn\'t initialize wallet *')
  }

  async function GetAmount(token) {
    try {
      if (token.isNative) {
        const balance = await web3Provider.getBalance(walletAddress);
        return balance / Math.pow(10, token.decimals);
      }
      const contract = new ethers.Contract(
        token.address,
        IERC20MinimalABI,
        web3Provider
      );
      const balance = await contract.balanceOf(walletAddress);
      return balance / Math.pow(10, token.decimals);
    } catch (e) {
      console.log(`Error occured: ${e.message}`);
    }
  }

  async function GetCurrentPrice(token0, token1) {
    try {
      const token0Amount = CurrencyAmount.fromRawAmount(
        token0,
        JSBI.BigInt(Math.pow(10, token0.decimals))
      );
      const route = await router.route(
        token0Amount,
        token1,
        TradeType.EXACT_INPUT,
        {
          type: SwapType.SWAP_ROUTER_02,
          recipient: walletAddress,
          slippageTolerance: new Percent(5, 100),
          deadline: Math.floor(Date.now() / 1000 + 1800),
        }
      );
      return Number(route.quote.toFixed(token1.decimals));
    } catch (e) {
      console.log(`Error occured: ${e.message}`);
    }
  }

  async function Swap(token0, token1, amount, isOutput = false) {
    const [token, quoteToken] = isOutput
      ? [token1, token0]
      : [token0, token1];
    const amountString = "" + amount * Math.pow(10, token.decimals);
    const tokenAmount = CurrencyAmount.fromRawAmount(
      token,
      JSBI.BigInt(amountString)
    );

    console.log("Routing...");
    const route = await router.route(
      tokenAmount,
      quoteToken,
      isOutput ? TradeType.EXACT_OUTPUT : TradeType.EXACT_INPUT,
      {
        type: SwapType.SWAP_ROUTER_02,
        recipient: walletAddress,
        slippageTolerance: new Percent(5, 100),
        deadline: Math.floor(Date.now() / 1000 + 1800),
      }
    );

    const quoteAmountString = route.quote
      .multiply(Math.pow(10, quoteToken.decimals))
      .toFixed(0);
    console.log(`quoteAmountString: ${quoteAmountString}`);

    if (!token0.isNative) {
      const token0Contract = new ethers.Contract(
        token0.address,
        IERC20MinimalABI,
        web3Provider
      );
      console.log("Collecting fee data...");
      const feeData = await web3Provider.getFeeData();
      console.log("Approving...");
      const approvalTx = await token0Contract
        .connect(connectedWallet)
        .approve(
          V3_POSITION_NFT_ADDRESS,
          isOutput
            ? route.quote
              .multiply(Math.pow(10, quoteToken.decimals))
              .multiply(new Fraction(105, 100))
              .toFixed(0)
            : amountString,
          {
            gasPrice: feeData.gasPrice.mul(110).div(100),
          }
        );
      await approvalTx.wait();
    }

    const nonce = await web3Provider.getTransactionCount(walletAddress);
    console.log(`Nonce: ${nonce}`);

    const multicallTx = {
      nonce: nonce,
      data: route.methodParameters.calldata,
      to: V3_SWAP_ROUTER_ADDRESS,
      from: walletAddress,
      value: ethers.BigNumber.from(route.methodParameters.value),
      gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
      gasLimit: ethers.BigNumber.from(route.estimatedGasUsed)
        .mul(300)
        .div(100),
      chainId: network,
    };

    const signedTx = await wallet.signTransaction(multicallTx);

    const tx = await web3Provider.sendTransaction(signedTx);
    const result = await tx.wait();
  }

  async function CreatePoolPosition(
    token0,
    token1,
    feeTier,
    minPrice,
    maxPrice,
    amount0,
    amount1
  ) {
    feeTier *= 10000;

    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      feeTier
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    [token0, token1, minPrice, maxPrice, amount0, amount1] =
      token0.address === immutables.token0
        ? [token0, token1, minPrice, maxPrice, amount0, amount1]
        : [token1, token0, 1 / maxPrice, 1 / minPrice, amount1, amount0];

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const tickLower = nearestUsableTick(
      priceToClosestTick(
        new Price(
          token0,
          token1,
          Math.pow(10, token0.decimals),
          Math.round(minPrice * Math.pow(10, token1.decimals))
        )
      ),
      immutables.tickSpacing
    );
    const tickUpper = nearestUsableTick(
      priceToClosestTick(
        new Price(
          token0,
          token1,
          Math.pow(10, token0.decimals),
          Math.round(maxPrice * Math.pow(10, token1.decimals))
        )
      ),
      immutables.tickSpacing
    );

    console.log(`Tick Lower: ${tickLower}, Tick Upper: ${tickUpper}`);
    console.log(`Current Tick: ${state.tick}`);

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(
      Position.fromAmounts({
        pool,
        tickLower,
        tickUpper,
        amount0: Math.floor(amount0 * Math.pow(10, token0.decimals)),
        amount1: Math.floor(amount1 * Math.pow(10, token1.decimals)),
      }),
      {
        slippageTolerance: new Percent(5, 100),
        recipient: walletAddress,
        deadline: Math.floor(Date.now() / 1000 + 1800),
      }
    );

    const feeData = await web3Provider.getFeeData();

    const token0Contract = new ethers.Contract(
      token0.address,
      IERC20MinimalABI,
      web3Provider
    );
    console.log(`Approving ${token0.symbol} ...`);
    let approvalTx = await token0Contract
      .connect(connectedWallet)
      .approve(
        V3_POSITION_NFT_ADDRESS,
        MAX_UINT128,
        {
          gasPrice: feeData.gasPrice.mul(110).div(100),
        }
      );
    await approvalTx.wait();

    const token1Contract = new ethers.Contract(
      token1.address,
      IERC20MinimalABI,
      web3Provider
    );
    console.log(`Approving ${token1.symbol} ...`);
    approvalTx = await token1Contract
      .connect(connectedWallet)
      .approve(
        V3_POSITION_NFT_ADDRESS,
        MAX_UINT128,
        {
          gasPrice: feeData.gasPrice.mul(110).div(100),
        }
      );
    await approvalTx.wait();

    const nonce = await web3Provider.getTransactionCount(walletAddress);
    console.log(`Nonce: ${nonce}`);

    const multicallTx = {
      nonce: nonce,
      data: calldata,
      to: V3_POSITION_NFT_ADDRESS,
      from: walletAddress,
      value: ethers.BigNumber.from(value),
      gasPrice: feeData.gasPrice.mul(110).div(100),
      gasLimit: 1_000_000,
      chainId: network,
    };

    const signedTx = await wallet.signTransaction(multicallTx);
    console.log(`Signed Tx: ${signedTx}`);

    const tx = await web3Provider.sendTransaction(signedTx);
    const result = await tx.wait();

    return __getTokenIdFromTransactionLogs(result.logs)
  }

  async function ClosePoolPosition(tokenId) {
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    const positionManagerContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider
    );

    const positionInfo = await positionManagerContract.positions(tokenId);
    const token0 = __getTokenByAddress(positionInfo.token0, network);
    const token1 = __getTokenByAddress(positionInfo.token1, network);

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      positionInfo.fee
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const position = new Position({
      pool: pool,
      tickLower: positionInfo.tickLower,
      tickUpper: positionInfo.tickUpper,
      liquidity: positionInfo.liquidity,
    });

    const { calldata, value } = NonfungiblePositionManager.removeCallParameters(
      position,
      {
        tokenId: tokenId,
        liquidityPercentage: new Percent(1),
        slippageTolerance: new Percent(5, 100),
        deadline: Math.floor(Date.now() / 1000 + 1800),
        collectOptions: {
          expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
          expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
          recipient: walletAddress,
        },
      }
    );

    const nonce = await web3Provider.getTransactionCount(walletAddress);
    console.log(`Nonce: ${nonce}`);

    const feeData = await web3Provider.getFeeData();

    const multicallTx = {
      nonce: nonce,
      data: calldata,
      to: V3_POSITION_NFT_ADDRESS,
      from: walletAddress,
      value: ethers.BigNumber.from(value),
      gasPrice: feeData.gasPrice.mul(110).div(100),
      gasLimit: 1_000_000,
      chainId: network,
    };

    const signedTx = await wallet.signTransaction(multicallTx);
    console.log(`Signed Tx: ${signedTx}`);

    const tx = await web3Provider.sendTransaction(signedTx);
    const result = await tx.wait();

    return result;
  }

  async function GetNFTList(hideClosedPositions = true) {
    const positionManagerContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider
    );
    const size = (
      await positionManagerContract.balanceOf(walletAddress)
    ).toNumber();
    console.log(size);

    const promiseList = [];
    for (let i = 0; i < size; i++) {
      promiseList.push(
        positionManagerContract
          .tokenOfOwnerByIndex(walletAddress, i)
          .then((val) => val.toNumber())
      );
    }
    const tokenIdList = await Promise.all(promiseList);
    const positionPromiseList = [];
    for (let i = 0; i < size; i++) {
      positionPromiseList.push(
        positionManagerContract.positions(tokenIdList[i])
      );
    }
    const positionInfoList = await Promise.all(positionPromiseList);
    const positionList = await Promise.all(
      positionInfoList.map(async (position, i) => {
        const token0 = __getTokenByAddress(position.token0, network);
        const token1 = __getTokenByAddress(position.token1, network);
        const isActive = position.liquidity.toNumber() === 0 ? false : true;
        const { tick, amount0, amount1, unclaimedFee0, unclaimedFee1 } =
          await __getPoolPositionInfo(
            web3Provider,
            walletAddress,
            token0,
            token1,
            position.fee,
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            tokenIdList[i],
            isActive
          );
        return {
          id: tokenIdList[i],
          minTick: position.tickLower,
          maxTick: position.tickUpper,
          isActivePosition: isActive,
          isInRange: tick >= position.tickLower && tick <= position.tickUpper,
          token0: token0.symbol,
          token1: token1.symbol,
          feeTier: position.fee / 10000 + "%",
          liquidityToken0: amount0,
          liquidityToken1: amount1,
          unclaimedFee0,
          unclaimedFee1,
          minPrice: tickToPrice(
            token0,
            token1,
            position.tickLower
          ).toSignificant(5),
          maxPrice: tickToPrice(
            token0,
            token1,
            position.tickUpper
          ).toSignificant(5),
          currentPrice: tickToPrice(token0, token1, tick).toSignificant(5),
        };
      })
    );
    return hideClosedPositions
      ? positionList.filter((position) => position.isActivePosition)
      : positionList;
  }

  async function CollectUnclaimedFees(tokenId) {
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    const positionManagerContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider.getSigner(wallet.address)
    );

    const positionInfo = await positionManagerContract.positions(tokenId);
    const token0 = __getTokenByAddress(positionInfo.token0, network);
    const token1 = __getTokenByAddress(positionInfo.token1, network);

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      positionInfo.fee
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const position = new Position({
      pool: pool,
      tickLower: positionInfo.tickLower,
      tickUpper: positionInfo.tickUpper,
      liquidity: positionInfo.liquidity,
    });

    console.log("amount0:", position.amount0.toSignificant(4));
    console.log("amount1:", position.amount1.toSignificant(4));

    let unclaimedFee0 = 0,
      unclaimedFee1 = 0;
    const collectResults = await positionManagerContract.callStatic.collect({
      tokenId,
      recipient: walletAddress,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    });
    unclaimedFee0 = (
      parseFloat(collectResults.amount0) / Math.pow(10, token0.decimals)
    ).toPrecision(4);
    unclaimedFee1 = (
      parseFloat(collectResults.amount1) / Math.pow(10, token1.decimals)
    ).toPrecision(4);

    const feeData = await web3Provider.getFeeData();
    const nonce = await web3Provider.getTransactionCount(walletAddress);
    console.log(`Nonce: ${nonce}`);

    const unsignedTx =
      await positionManagerContract.populateTransaction.collect(
        {
          tokenId: tokenId,
          recipient: walletAddress,
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        },
        {
          nonce: nonce,
          from: walletAddress,
          gasPrice: feeData.gasPrice.mul(110).div(100),
          gasLimit: 1_000_000,
        }
      );
    unsignedTx.chainId = network;
    console.log("Unsigned Tx");
    console.log(unsignedTx);

    const signedTx = await wallet.signTransaction(unsignedTx);
    console.log(`Signed Tx: ${signedTx}`);

    const tx = await web3Provider.sendTransaction(signedTx);
    const results = await tx.wait();
    return {
      token0: unclaimedFee0,
      token1: unclaimedFee1
    };
  }

  async function GetUnclaimedFeeAmounts(tokenId) {
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    const positionManagerContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider.getSigner(wallet.address)
    );

    const positionInfo = await positionManagerContract.positions(tokenId);
    const token0 = __getTokenByAddress(positionInfo.token0, network);
    const token1 = __getTokenByAddress(positionInfo.token1, network);

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      positionInfo.fee
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const position = new Position({
      pool: pool,
      tickLower: positionInfo.tickLower,
      tickUpper: positionInfo.tickUpper,
      liquidity: positionInfo.liquidity,
    });

    console.log("amount0:", position.amount0.toSignificant(4));
    console.log("amount1:", position.amount1.toSignificant(4));

    let unclaimedFee0 = 0,
      unclaimedFee1 = 0;
    const collectResults = await positionManagerContract.callStatic.collect({
      tokenId,
      recipient: walletAddress,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    });
    unclaimedFee0 = (
      parseFloat(collectResults.amount0) / Math.pow(10, token0.decimals)
    ).toPrecision(4);
    unclaimedFee1 = (
      parseFloat(collectResults.amount1) / Math.pow(10, token1.decimals)
    ).toPrecision(4);

    return {
      token0: unclaimedFee0,
      token1: unclaimedFee1
    };
  }

  async function GetFeeTiers(token0, token1) {
    const possibleFeeTiers = [100, 500, 3_000, 5_000, 10_000]
    const result = []

    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    for (const fee of possibleFeeTiers) {
      console.log(`Getting pool with fee ${fee / 10_000}%...`);
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        fee
      );
      if (poolAddress !== ADDRESS_ZERO) {
        result.push(fee / 10_000)
        console.log('Okay')
      } else {
        console.log('Not exist')
      }
    }

    return result
  }

  async function GetCurrentPriceTick(token0, token1, feeTier) {
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      feeTier * 10_000
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    return immutables.token0 === token0.address ? state.tick : (-state.tick)
  }

  async function CreatePoolPositionMax(token0, token1, feeTier, minPrice, maxPrice) {
    feeTier *= 10_000

    let token0Balance = await GetAmount(token0)
    let token1Balance = await GetAmount(token1)

    let token0Amount = CurrencyAmount.fromRawAmount(token0, Math.floor(token0Balance * Math.pow(10, token0.decimals)))
    let token1Amount = CurrencyAmount.fromRawAmount(token1, Math.floor(token1Balance * Math.pow(10, token1.decimals)))

    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      feeTier
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    [token0, token1, minPrice, maxPrice, token0Balance, token1Balance, token0Amount, token1Amount] =
      token0.address === immutables.token0
        ? [token0, token1, minPrice, maxPrice, token0Balance, token1Balance, token0Amount, token1Amount]
        : [token1, token0, 1 / maxPrice, 1 / minPrice, token1Balance, token0Balance, token1Amount, token0Amount];

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const tickLower = nearestUsableTick(
      priceToClosestTick(
        new Price(
          token0,
          token1,
          Math.pow(10, token0.decimals),
          Math.round(minPrice * Math.pow(10, token1.decimals))
        )
      ),
      immutables.tickSpacing
    );
    const tickUpper = nearestUsableTick(
      priceToClosestTick(
        new Price(
          token0,
          token1,
          Math.pow(10, token0.decimals),
          Math.round(maxPrice * Math.pow(10, token1.decimals))
        )
      ),
      immutables.tickSpacing
    );

    console.log(`Tick Lower: ${tickLower}, Tick Upper: ${tickUpper}`);

    console.log('Routing ...')
    const routeToRatioResponse = await router.routeToRatio(
      token0Amount,
      token1Amount,
      new Position({
        pool,
        tickLower,
        tickUpper,
        liquidity: 1,
      }),
      {
        ratioErrorTolerance: new Fraction(1, 100),
        maxIterations: 6,
      },
      {
        swapOptions: {
          recipient: walletAddress,
          slippageTolerance: new Percent(5, 100),
          deadline: Math.floor(Date.now() / 1000 + 1800),
        },
        addLiquidityOptions: {
          recipient: walletAddress
        }
      }
    );

    if (routeToRatioResponse.status == SwapToRatioStatus.SUCCESS) {
      const feeData = await web3Provider.getFeeData();

      const token0Contract = new ethers.Contract(
        token0.address,
        IERC20MinimalABI,
        web3Provider
      );
      console.log(`Approving ${token0.symbol} ...`);
      let approvalTx = await token0Contract
        .connect(connectedWallet)
        .approve(
          V3_SWAP_ROUTER_ADDRESS,
          MAX_UINT128,
          {
            gasPrice: feeData.gasPrice.mul(110).div(100),
          }
        );
      await approvalTx.wait();

      const token1Contract = new ethers.Contract(
        token1.address,
        IERC20MinimalABI,
        web3Provider
      );
      console.log(`Approving ${token1.symbol} ...`);
      approvalTx = await token1Contract
        .connect(connectedWallet)
        .approve(
          V3_SWAP_ROUTER_ADDRESS,
          MAX_UINT128,
          {
            gasPrice: feeData.gasPrice.mul(110).div(100),
          }
        );
      await approvalTx.wait();

      const route = routeToRatioResponse.result

      const nonce = await web3Provider.getTransactionCount(walletAddress);
      console.log(`Nonce: ${nonce}`);

      const multicallTx = {
        nonce: nonce,
        data: route.methodParameters.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        from: walletAddress,
        // value: ethers.BigNumber.from(route.methodParameters.value),
        value: ethers.BigNumber.from('100000000000000000'),
        gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
        gasLimit: ethers.BigNumber.from(route.estimatedGasUsed)
          .mul(300)
          .div(100),
        chainId: network,
      };

      const signedTx = await wallet.signTransaction(multicallTx);

      const tx = await web3Provider.sendTransaction(signedTx);
      console.log(`Transaction: ${tx.hash}`)
      const result = await tx.wait();

      return result;
    }

    return 'failed'
  }

  async function GetNearestTickRangeFromPrice(token0, token1, feeTier, price) {
    const [inputToken0, inputToken1] = [token0, token1]

    feeTier *= 10_000

    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      feeTier
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    [token0, token1, price] =
      token0.address === immutables.token0
        ? [token0, token1, price]
        : [token1, token0, 1 / price];

    const currentPrice = new Price(
      token0,
      token1,
      Math.pow(10, token0.decimals),
      Math.round(price * Math.pow(10, token1.decimals))
    )
    const nearestTick = nearestUsableTick(
      priceToClosestTick(
        currentPrice
      ),
      immutables.tickSpacing
    );

    let tickLower, tickUpper;
    const nearestPrice = tickToPrice(token0, token1, nearestTick)
    if (nearestPrice.greaterThan(currentPrice)) {
      [tickLower, tickUpper] = [nearestTick - immutables.tickSpacing, nearestTick]
    } else {
      [tickLower, tickUpper] = [nearestTick, nearestTick + immutables.tickSpacing]
    }

    if (inputToken0.address === token0.address) return [tickLower, tickUpper]
    return [-tickUpper, -tickLower]
  }

  async function GetNearestTickRangeFromTick(token0, token1, feeTier, tick) {
    const [inputToken0, inputToken1] = [token0, token1]

    feeTier *= 10_000

    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      feeTier
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    [token0, token1, tick] =
      token0.address === immutables.token0
        ? [token0, token1, tick]
        : [token1, token0, -tick];

    const nearestTick = nearestUsableTick(
      tick,
      immutables.tickSpacing
    );

    let tickLower, tickUpper;
    if (nearestTick > tick) {
      [tickLower, tickUpper] = [nearestTick - immutables.tickSpacing, nearestTick]
    } else {
      [tickLower, tickUpper] = [nearestTick, nearestTick + immutables.tickSpacing]
    }

    if (inputToken0.address === token0.address) return [tickLower, tickUpper]
    return [-tickUpper, -tickLower]
  }

  async function CreatePoolPositionTicks(
    token0,
    token1,
    feeTier,
    minTick,
    maxTick,
    amount0,
    amount1
  ) {
    feeTier *= 10000;

    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      feeTier
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    [token0, token1, minTick, maxTick, amount0, amount1] =
      token0.address === immutables.token0
        ? [token0, token1, minTick, maxTick, amount0, amount1]
        : [token1, token0, -maxTick, -minTick, amount1, amount0];

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const tickLower = nearestUsableTick(
      minTick,
      immutables.tickSpacing
    );
    const tickUpper = nearestUsableTick(
      maxTick,
      immutables.tickSpacing
    );

    console.log(`Tick Lower: ${tickLower}, Tick Upper: ${tickUpper}`);
    console.log(`Current Tick: ${state.tick}`);

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(
      Position.fromAmounts({
        pool,
        tickLower,
        tickUpper,
        amount0: Math.floor(amount0 * Math.pow(10, token0.decimals)),
        amount1: Math.floor(amount1 * Math.pow(10, token1.decimals)),
      }),
      {
        slippageTolerance: new Percent(5, 100),
        recipient: walletAddress,
        deadline: Math.floor(Date.now() / 1000 + 1800),
      }
    );

    const feeData = await web3Provider.getFeeData();

    const token0Contract = new ethers.Contract(
      token0.address,
      IERC20MinimalABI,
      web3Provider
    );
    console.log(`Approving ${token0.symbol} ...`);
    let approvalTx = await token0Contract
      .connect(connectedWallet)
      .approve(
        V3_POSITION_NFT_ADDRESS,
        MAX_UINT128,
        {
          gasPrice: feeData.gasPrice.mul(110).div(100),
        }
      );
    await approvalTx.wait();

    const token1Contract = new ethers.Contract(
      token1.address,
      IERC20MinimalABI,
      web3Provider
    );
    console.log(`Approving ${token1.symbol} ...`);
    approvalTx = await token1Contract
      .connect(connectedWallet)
      .approve(
        V3_POSITION_NFT_ADDRESS,
        MAX_UINT128,
        {
          gasPrice: feeData.gasPrice.mul(110).div(100),
        }
      );
    await approvalTx.wait();

    const nonce = await web3Provider.getTransactionCount(walletAddress);
    console.log(`Nonce: ${nonce}`);

    const multicallTx = {
      nonce: nonce,
      data: calldata,
      to: V3_POSITION_NFT_ADDRESS,
      from: walletAddress,
      value: ethers.BigNumber.from(value),
      gasPrice: feeData.gasPrice.mul(110).div(100),
      gasLimit: 1_000_000,
      chainId: network,
    };

    const signedTx = await wallet.signTransaction(multicallTx);
    console.log(`Signed Tx: ${signedTx}`);

    const tx = await web3Provider.sendTransaction(signedTx);
    const result = await tx.wait();

    return __getTokenIdFromTransactionLogs(result.logs)
  }

  async function AddLiquidity(tokenId, token0Amount, token1Amount) {
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    const positionManagerContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider.getSigner(wallet.address)
    );

    const positionInfo = await positionManagerContract.positions(tokenId);
    const token0 = __getTokenByAddress(positionInfo.token0, network);
    const token1 = __getTokenByAddress(positionInfo.token1, network);

    console.log(`Token0: ${token0.symbol}, Token1: ${token1.symbol}`);

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      positionInfo.fee
    );
    console.log(`Pool: ${poolAddress}`);

    const poolContract = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      web3Provider
    );

    const [immutables, state] = await Promise.all([
      __getPoolImmutables(poolContract),
      __getPoolState(poolContract),
    ]);

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    const position = Position.fromAmounts({
      pool,
      tickLower: positionInfo.tickLower,
      tickUpper: positionInfo.tickUpper,
      amount0: Math.floor(token0Amount * Math.pow(10, token0.decimals)),
      amount1: Math.floor(token1Amount * Math.pow(10, token1.decimals)),
    })

    console.log(`Position liquidity: ${[position.liquidity]}`)

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(
      position,
      {
        tokenId: tokenId,
        slippageTolerance: new Percent(5, 100),
        deadline: Math.floor(Date.now() / 1000 + 1800),
      }
    );

    const feeData = await web3Provider.getFeeData();

    const token0Contract = new ethers.Contract(
      token0.address,
      IERC20MinimalABI,
      web3Provider
    );
    console.log(`Approving ${token0.symbol} ...`);
    let approvalTx = await token0Contract
      .connect(connectedWallet)
      .approve(
        V3_POSITION_NFT_ADDRESS,
        MAX_UINT128,
        {
          gasPrice: feeData.gasPrice.mul(110).div(100),
        }
      );
    await approvalTx.wait();

    const token1Contract = new ethers.Contract(
      token1.address,
      IERC20MinimalABI,
      web3Provider
    );
    console.log(`Approving ${token1.symbol} ...`);
    approvalTx = await token1Contract
      .connect(connectedWallet)
      .approve(
        V3_POSITION_NFT_ADDRESS,
        MAX_UINT128,
        {
          gasPrice: feeData.gasPrice.mul(110).div(100),
        }
      );
    await approvalTx.wait();

    const nonce = await web3Provider.getTransactionCount(walletAddress);
    console.log(`Nonce: ${nonce}`);

    const multicallTx = {
      nonce: nonce,
      data: calldata,
      to: V3_POSITION_NFT_ADDRESS,
      from: walletAddress,
      value: ethers.BigNumber.from(value),
      gasPrice: feeData.gasPrice.mul(110).div(100),
      gasLimit: 1_000_000,
      chainId: network,
    };

    const signedTx = await wallet.signTransaction(multicallTx);
    console.log(`Signed Tx: ${signedTx}`);

    const tx = await web3Provider.sendTransaction(signedTx);
    const result = await tx.wait();

    return result
  }

  async function GetPoolPositionInfo(tokenId) {
    const positionManagerContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider
    );

    const position = await positionManagerContract.positions(tokenId)
    const token0 = __getTokenByAddress(position.token0, network);
    const token1 = __getTokenByAddress(position.token1, network);
    const isActive = position.liquidity.toNumber() === 0 ? false : true;
    const { tick, amount0, amount1, unclaimedFee0, unclaimedFee1 } =
      await __getPoolPositionInfo(
        web3Provider,
        walletAddress,
        token0,
        token1,
        position.fee,
        position.tickLower,
        position.tickUpper,
        position.liquidity,
        tokenId,
        isActive
      );
    return {
      id: tokenId,
      minTick: position.tickLower,
      maxTick: position.tickUpper,
      isActivePosition: isActive,
      isInRange: tick >= position.tickLower && tick <= position.tickUpper,
      token0: token0.symbol,
      token1: token1.symbol,
      feeTier: position.fee / 10000 + "%",
      liquidityToken0: amount0,
      liquidityToken1: amount1,
      unclaimedFee0,
      unclaimedFee1,
      minPrice: tickToPrice(
        token0,
        token1,
        position.tickLower
      ).toSignificant(5),
      maxPrice: tickToPrice(
        token0,
        token1,
        position.tickUpper
      ).toSignificant(5),
      currentPrice: tickToPrice(token0, token1, tick).toSignificant(5),
    };
  }

  async function SwapAll(token0, token1) {
    const token0Amount = await GetAmount(token0)
    return Swap(token0, token1, token0Amount)
  }

  return {
    GetAmount,
    GetCurrentPrice,
    Swap,
    CreatePoolPosition,
    ClosePoolPosition,
    GetNFTList,
    CollectUnclaimedFees,
    GetUnclaimedFeeAmounts,
    GetFeeTiers,
    GetCurrentPriceTick,
    CreatePoolPositionMax,
    GetNearestTickRangeFromPrice,
    GetNearestTickRangeFromTick,
    CreatePoolPositionTicks,
    AddLiquidity,
    GetPoolPositionInfo,
    SwapAll,
    Tokens: Tokens[network],
  };
}

module.exports = { Init, Networks };
