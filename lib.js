const ethers = require("ethers");
const JSBI = require("jsbi");
const {
  ADDRESS_ZERO,
  Pool,
  FACTORY_ADDRESS,
  Position,
  nearestUsableTick,
  NonfungiblePositionManager,
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
} = require("@uniswap/smart-order-router");
const {
  Token,
  CurrencyAmount,
  SupportedChainId,
  TradeType,
  Percent,
  Fraction,
} = require("@uniswap/sdk-core");

const V3_SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const V3_POSITION_NFT_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

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
  const wallet = new ethers.Wallet(privateKey);
  const connectedWallet = wallet.connect(web3Provider);
  const router = new AlphaRouter({
    chainId: network,
    provider: web3Provider,
  });

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
    token0Amount,
    token1Amount,
    minPrice,
    maxPrice
  ) {
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

    const [TokenA, TokenB] =
      token0.address === immutables.token0
        ? [token0, token1]
        : [token1, token0];

    const pool = new Pool(
      TokenA,
      TokenB,
      immutables.fee,
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      state.tick
    );

    // const token0Balance = CurrencyAmount.fromRawAmount(token0, "100000");
    // const token1Balance = CurrencyAmount.fromRawAmount(token1, "0");

    // console.log("Routing...");
    // const routeToRatioResponse = await router.routeToRatio(
    //   token0Balance,
    //   token1Balance,
    //   new Position({
    //     pool,
    //     tickLower:
    //       nearestUsableTick(state.tick, immutables.tickSpacing) -
    //       immutables.tickSpacing * 2,
    //     tickUpper:
    //       nearestUsableTick(state.tick, immutables.tickSpacing) +
    //       immutables.tickSpacing * 2,
    //     liquidity: 1,
    //   }),
    //   {
    //     ratioErrorTolerance: new Fraction(1, 100),
    //     maxIterations: 6,
    //   },
    //   {
    //     swapOptions: {
    //       recipient: walletAddress,
    //       slippageTolerance: new Percent(5, 100),
    //       deadline: Math.floor(Date.now() / 1000 + 1800),
    //     },
    //     addLiquidityOptions: {
    //       recipient: walletAddress,
    //     },
    //   }
    // );

    // if (routeToRatioResponse.status == SwapToRatioStatus.SUCCESS) {
    //   const route = routeToRatioResponse.result;
    //   return route.postSwapTargetPool

    //   console.log("Collecting fee data...");
    //   const feeData = await web3Provider.getFeeData();

    //   if (!token0.isNative) {
    //     const token0Contract = new ethers.Contract(
    //       token0.address,
    //       IERC20MinimalABI,
    //       web3Provider
    //     );
    //     console.log("Approving Token 0 for router...");
    //     const approvalTx = await token0Contract
    //       .connect(connectedWallet)
    //       .approve(
    //         V3_POSITION_NFT_ADDRESS,
    //         token0Balance.multiply(Math.pow(10, token0.decimals)).toFixed(0),
    //         {
    //           gasPrice: feeData.gasPrice.mul(110).div(100),
    //         }
    //       );
    //     await approvalTx.wait();
    //   }
    //   if (!token1.isNative) {
    //     const token1Contract = new ethers.Contract(
    //       token1.address,
    //       IERC20MinimalABI,
    //       web3Provider
    //     );
    //     console.log("Approving Token 1...");
    //     const approvalTx = await token1Contract
    //       .connect(connectedWallet)
    //       .approve(
    //         poolAddress,
    //         route.quote
    //           .multiply(Math.pow(10, token1.decimals))
    //           .multiply(new Fraction(105, 100))
    //           .toFixed(0),
    //         {
    //           gasPrice: feeData.gasPrice.mul(110).div(100),
    //         }
    //       );
    //     await approvalTx.wait();
    //   }

    //   const nonce = await web3Provider.getTransactionCount(walletAddress);
    //   console.log(`Nonce: ${nonce}`);

    //   const multicallTx = {
    //     nonce: nonce,
    //     data: route.methodParameters.calldata,
    //     to: V3_SWAP_ROUTER_ADDRESS,
    //     value: ethers.BigNumber.from(route.methodParameters.value),
    //     from: walletAddress,
    //     gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
    //     gasLimit: ethers.BigNumber.from(route.estimatedGasUsed)
    //       .mul(300)
    //       .div(100),
    //     chainId: network,
    //   };

    //   console.log(multicallTx);

    //   const signedTx = await wallet.signTransaction(multicallTx);

    //   const tx = await web3Provider.sendTransaction(signedTx);
    //   const result = await tx.wait();

    //   return result;
    // }

    const tickLower =
      nearestUsableTick(state.tick, immutables.tickSpacing) -
      immutables.tickSpacing * 2;
    const tickUpper =
      nearestUsableTick(state.tick, immutables.tickSpacing) +
      immutables.tickSpacing * 2;

    console.log(tickLower, tickUpper);

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(
      new Position({
        pool,
        tickLower:
          nearestUsableTick(state.tick, immutables.tickSpacing) -
          immutables.tickSpacing * 2,
        tickUpper:
          nearestUsableTick(state.tick, immutables.tickSpacing) +
          immutables.tickSpacing * 2,
        liquidity: 1000,
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
    return { tokenId, token0, token1, feeTier };
  }

  async function ClosePoolPosition(tokenId) {
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      IUniswapV3FactoryABI,
      web3Provider
    );

    const nftContract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider
    );

    const positionFromContract = await nftContract.positions(tokenId);
    const token0 = getTokenByAddress(positionFromContract.token0, network);
    const token1 = getTokenByAddress(positionFromContract.token1, network);

    console.log("Getting pool...");
    const poolAddress = await factoryContract.getPool(
      token0.address,
      token1.address,
      positionFromContract.fee
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
      tickLower: positionFromContract.tickLower,
      tickUpper: positionFromContract.tickUpper,
      liquidity: positionFromContract.liquidity,
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
    const contract = new ethers.Contract(
      V3_POSITION_NFT_ADDRESS,
      INonfungiblePositionManagerABI,
      web3Provider
    );
    const size = (await contract.balanceOf(walletAddress)).toNumber();
    console.log(size);

    const promiseList = [];
    for (let i = 0; i < size; i++) {
      promiseList.push(
        contract
          .tokenOfOwnerByIndex(walletAddress, i)
          .then((val) => val.toNumber())
      );
    }
    const tokenIdList = await Promise.all(promiseList);
    const positionPromiseList = [];
    for (let i = 0; i < size; i++) {
      positionPromiseList.push(contract.positions(tokenIdList[i]));
    }
    const positionListFromContract = await Promise.all(positionPromiseList);
    const positionList = positionListFromContract.map((position, i) => ({
      id: tokenIdList[i],
      minTick: position.tickLower,
      maxTick: position.tickUpper,
      isActivePosition: position.liquidity.toNumber() === 0 ? false : true,
      isInRange: true,
      token0: getTokenByAddress(position.token0, network).symbol,
      token1: getTokenByAddress(position.token1, network).symbol,
      feeTier: position.fee / 10000 + "%",
      liquidity: position.liquidity.toNumber(),
      unclaimedFee0: 0,
      unclaimedFee1: 0,
      minPrice: 0,
      maxPrice: 0,
      currentPrice: 0,
    }));
    return hideClosedPositions
      ? positionList.filter((position) => position.isActivePosition)
      : positionList;
    // return positionListFromContract;
  }

  return {
    GetAmount,
    GetCurrentPrice,
    Swap,
    CreatePoolPosition,
    ClosePoolPosition,
    GetNFTList,
    Tokens: Tokens[network],
  };
}

module.exports = { Init, Networks };
