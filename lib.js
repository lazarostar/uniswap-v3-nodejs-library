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
  nativeOnChain,
  SWAP_ROUTER_02_ADDRESS,
} = require("@uniswap/smart-order-router");
const {
  Token,
  CurrencyAmount,
  SupportedChainId,
  TradeType,
  Percent,
  Fraction,
  Price,
} = require("@uniswap/sdk-core");

const V3_SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const V3_POSITION_NFT_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

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

const Networks = {
  GOERLI: SupportedChainId.GOERLI,
  POLYGON: SupportedChainId.POLYGON,
};

const Tokens = {
  [Networks.GOERLI]: {
    NATIVE: nativeOnChain(Networks.GOERLI),
    ETH: nativeOnChain(Networks.GOERLI),
    UNI: new Token(
      Networks.GOERLI,
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      18,
      "UNI",
      "Uniswap Token"
    ),
  },
  [Networks.POLYGON]: {
    NATIVE: nativeOnChain(Networks.POLYGON),
    MATIC: nativeOnChain(Networks.POLYGON),
    WMATIC: new Token(
      Networks.POLYGON,
      "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      18,
      "WMATIC",
      "Wrapped Matic"
    ),
    WETH: new Token(
      Networks.POLYGON,
      "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      18,
      "WETH",
      "Wrapped ETH"
    ),
    USDT: new Token(
      Networks.POLYGON,
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      6,
      "USDT",
      "Tether USD"
    ),
    USDC: new Token(
      Networks.POLYGON,
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      6,
      "USDC",
      "USD Coin"
    ),
  },
};

const getTokenByAddress = (address, network) => {
  Object.values(Tokens[network]).find;
  for (let symbol in Tokens[network]) {
    if (Tokens[network][symbol].address === address)
      return Tokens[network][symbol];
  }
  return null;
};

async function getPoolImmutables(poolContract) {
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

async function getPoolState(poolContract) {
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
    try {
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

      return result;
    } catch (e) {
      console.log(`Error occured: ${e.message}`);
    }
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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
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

    const tokenId = Number.parseInt(result.logs[6].topics[1], 16);
    return tokenId;
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
    const token0 = getTokenByAddress(positionInfo.token0, network);
    const token1 = getTokenByAddress(positionInfo.token1, network);

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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
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
    const poolCache = [];
    const getPoolPositionInfo = async (
      token0,
      token1,
      feeTier,
      tickLower,
      tickUpper,
      liquidity,
      tokenId,
      isActive
    ) => {
      const i = poolCache.findIndex(
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
          tick: poolCache[i].tick,
          amount0: poolCache[i].amount0,
          amount1: poolCache[i].amount1,
          unclaimedFee0: poolCache[i].unclaimedFee0,
          unclaimedFee1: poolCache[i].unclaimedFee1,
        };
      }

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
        getPoolImmutables(poolContract),
        getPoolState(poolContract),
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

      poolCache.push({
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
        const token0 = getTokenByAddress(position.token0, network);
        const token1 = getTokenByAddress(position.token1, network);
        const isActive = position.liquidity.toNumber() === 0 ? false : true;
        const { tick, amount0, amount1, unclaimedFee0, unclaimedFee1 } =
          await getPoolPositionInfo(
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
    const token0 = getTokenByAddress(positionInfo.token0, network);
    const token1 = getTokenByAddress(positionInfo.token1, network);

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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
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
    const token0 = getTokenByAddress(positionInfo.token0, network);
    const token1 = getTokenByAddress(positionInfo.token1, network);

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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
    ]);

    const pool = new Pool(
      token0,
      token1,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    pool.price

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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
    ]);

    return immutables.token0 === token0.address ? state.tick : (-state.tick)
  }

  async function CreatePoolPositionMax(token0, token1, feeTier, minPrice, maxPrice) {
    feeTier *= 10_000

    let token0Balance = await GetAmount(token0)
    let token1Balance = await GetAmount(token1)

    let token0Amount = CurrencyAmount.fromRawAmount(token0, token0Balance * Math.pow(10, token0.decimals))
    let token1Amount = CurrencyAmount.fromRawAmount(token1, token1Balance * Math.pow(10, token1.decimals))

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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
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
          tokenId: 547177,
          // recipient: walletAddress
        }
      }
    );

    if (routeToRatioResponse.status == SwapToRatioStatus.SUCCESS) {
      console.log("Collecting fee data...");
      const feeData = await web3Provider.getFeeData();

      const token0Contract = new ethers.Contract(
        token0.address,
        IERC20MinimalABI,
        web3Provider
      );
      console.log("Approving Token 0 ...");
      let approvalTx = await token0Contract
        .connect(connectedWallet)
        .approve(
          V3_POSITION_NFT_ADDRESS,
          token0Balance * Math.pow(10, token0.decimals),
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
      console.log("Approving Token 1 ...");
      approvalTx = await token1Contract
        .connect(connectedWallet)
        .approve(
          V3_POSITION_NFT_ADDRESS,
          token1Balance * Math.pow(10, token1.decimals),
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
        value: ethers.BigNumber.from(route.methodParameters.value),
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

  async function GetNearestTickRange(token0, token1, feeTier, price) {
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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
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
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
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

    console.log('=== Logs ===')
    console.log(result.logs)

    const tokenId = Number.parseInt(result.logs[6].topics[1], 16);
    return tokenId;
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
    GetNearestTickRange,
    CreatePoolPositionTicks,
    Tokens: Tokens[network],
  };
}

module.exports = { Init, Networks };
