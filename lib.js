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
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  nativeOnChain,
} = require("@uniswap/smart-order-router");
const {
  CurrencyAmount,
  TradeType,
  Percent,
  Fraction,
  Price,
} = require("@uniswap/sdk-core");

const { Tokens, Networks } = require("./tokens");

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
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
      {
        name: "_spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
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
  {
    constant: false,
    inputs: [],
    name: "deposit",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        name: "wad",
        type: "uint256",
      },
    ],
    name: "withdraw",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const __getTokenIdFromTransactionLogs = (logs) => {
  for (const log of logs) {
    // signature of event Transfer (index_topic_1 address from, index_topic_2 address to, index_topic_3 uint256 tokenId)
    if (
      log.address === V3_POSITION_NFT_ADDRESS &&
      log.topics[0] ===
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    ) {
      return Number.parseInt(log.topics[3], 16);
    }
  }
  return false;
};

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

function Init(walletAddress, privateKey, network, rpcUrl, debug = false) {
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
    __log__("* Couldn't initialize wallet *");
    return false;
  }

  function __log__(...args) {
    if (debug) console.log(...args);
  }

  async function Wrap(amount) {
    try {
      const nativeToken = nativeOnChain(network);
      const wrappedToken = nativeToken.wrapped;
      const contract = new ethers.Contract(
        wrappedToken.address,
        IERC20MinimalABI,
        web3Provider
      );

      var bignumAmount = amount;
      var humanAmount = amount;
      if (amount instanceof ethers.BigNumber) {
        humanAmount = amount / Math.pow(10, nativeToken.decimals);
      } else {
        if (typeof amount !== 'number') return false;
        bignumAmount = ethers.BigNumber.from("" + Math.floor(amount * Math.pow(10, nativeToken.decimals)));
      }

      __log__("Getting the actual feeData ...");
      const feeData = await web3Provider.getFeeData();
      __log__(`Wrapping ${humanAmount} ${nativeToken.symbol} ...`);
      const tx = await contract.connect(connectedWallet).deposit({
        value: bignumAmount,
        gasPrice: feeData.gasPrice.mul(110).div(100),
      });
      await tx.wait();
      return true;
    } catch (e) {
      __log__(e)
      return false;
    }
  }

  async function Unwrap(amount) {
    try {
      const nativeToken = nativeOnChain(network);
      const wrappedToken = nativeToken.wrapped;
      const contract = new ethers.Contract(
        wrappedToken.address,
        IERC20MinimalABI,
        web3Provider
      );

      var bignumAmount = amount;
      var humanAmount = amount;
      if (amount instanceof ethers.BigNumber) {
        humanAmount = amount / Math.pow(10, nativeToken.decimals);
      } else {
        if (typeof amount !== 'number') return false;
        bignumAmount = ethers.BigNumber.from("" + Math.floor(amount * Math.pow(10, nativeToken.decimals)));
      }

      __log__(`Getting the actual feeData ...`);
      const feeData = await web3Provider.getFeeData();
      __log__(`Unwrapping ${humanAmount} ${wrappedToken.symbol} ...`);
      const tx = await contract.connect(connectedWallet).withdraw(
          bignumAmount,
          {
            gasPrice: feeData.gasPrice.mul(110).div(100),
          }
        );
      await tx.wait();
      return true;
    } catch (e) {
      __log__(e)
      return false;
    }
  }

  async function UnwrapAll() {
    const nativeToken = nativeOnChain(network);
    const wrappedToken = nativeToken.wrapped;
    const balance = await GetAmount(wrappedToken);
    if (balance === false) return false;
    __log__(`Wrapped balance is ${balance.value}`);
    if (balance.value < 0) return false; // the balance cannot be negative
    if (balance.value <= 0.000000000000001) return true; // the wrapped balance is too small, no need to unwrap that
    const result = await Unwrap(balance.bignum);
    return result;
  }

  async function GetAmount(token) {
    try {
      if (token.isNative) {
        const balance = await web3Provider.getBalance(walletAddress);
        return {
          bignum: balance,
          decimals: token.decimals,
          value: balance / Math.pow(10, token.decimals)
        }
      }
      const contract = new ethers.Contract(
        token.address,
        IERC20MinimalABI,
        web3Provider
      );
      const balance = await contract.balanceOf(walletAddress);
      return {
        bignum: balance,
        decimals: token.decimals,
        value: balance / Math.pow(10, token.decimals)
      }
    } catch (e) {
      return false;
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
      return false;
    }
  }

  async function Swap(token0, token1, amount, isOutput = false) {
    try {
      const originalToken0 = token0;
      const [token, quoteToken] = isOutput
        ? [token1, token0]
        : [token0, token1];

      let tokenAmount;
      let tokenAmountHuman;
      let tokenBigNum;
      if (amount instanceof ethers.BigNumber) {
        tokenAmountHuman = amount / Math.pow(10, token.decimals);
        tokenBigNum = amount;
      } else {
        if (typeof amount !== 'number') return false;
        tokenAmountHuman = amount;
        tokenBigNum = ethers.BigNumber.from('' + Math.floor(tokenAmountHuman * Math.pow(10, token.decimals)));
      }
      tokenAmount = CurrencyAmount.fromRawAmount(token, Math.floor(tokenAmountHuman * Math.pow(10, token.decimals)));

      __log__("Routing...");
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
      __log__(`quoteAmountString: ${quoteAmountString}`);

      if (!originalToken0.isNative) {
        const token0Contract = new ethers.Contract(
          originalToken0.address,
          IERC20MinimalABI,
          web3Provider
        );
        const allowance = await token0Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if (
          ethers.BigNumber.from(allowance).gt(
            ethers.BigNumber.from(quoteAmountString)
          ) &&
          ethers.BigNumber.from(allowance).gt(
            tokenBigNum
          )
        ) {
          __log__("No need to approve.");
        } else {
          const feeData = await web3Provider.getFeeData();
          __log__(`Approving ${originalToken0.symbol} ...`);
          const approvalTx = await token0Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }
      }

      const nonce = await web3Provider.getTransactionCount(walletAddress);
      __log__(`Nonce: ${nonce}`);

      const multicallTx = {
        nonce: nonce,
        data: route.methodParameters.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        from: walletAddress,
        value: ethers.BigNumber.from(route.methodParameters.value),
        gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
        gasLimit: ethers.BigNumber.from(route.estimatedGasUsed).mul(300).div(100),
        chainId: network,
      };

      const signedTx = await wallet.signTransaction(multicallTx);

      const tx = await web3Provider.sendTransaction(signedTx);
      await tx.wait();
      return true;
    } catch (e) {
      return false;
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
    try {
      if (token0.isNative) {
        const ok = await Wrap(amount0);
        if (!ok) return false;
        token0 = token0.wrapped;
      }
      if (token1.isNative) {
        const ok = await Wrap(amount1);
        if (!ok) return false;
        token1 = token1.wrapped;
      }
    } catch (e) {
      return false;
    }

    try {
      let token0Amount;
      let token0AmountHuman;
      let token0BigNum;
      if (amount0 instanceof ethers.BigNumber) {
        token0AmountHuman = amount0 / Math.pow(10, token0.decimals);
        token0BigNum = amount0;
      } else {
        if (typeof amount0 !== 'number') return false;
        token0AmountHuman = amount0;
        token0BigNum = ethers.BigNumber.from('' + Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)));
      }
      token0Amount = CurrencyAmount.fromRawAmount(token0, Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)));

      let token1Amount;
      let token1AmountHuman;
      let token1BigNum;
      if (amount1 instanceof ethers.BigNumber) {
        token1AmountHuman = amount1 / Math.pow(10, token1.decimals);
        token1BigNum = amount1;
      } else {
        if (typeof amount1 !== 'number') return false;
        token1AmountHuman = amount1;
        token1BigNum = ethers.BigNumber.from('' + Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)));
      }
      token1Amount = CurrencyAmount.fromRawAmount(token1, Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)));

      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        IUniswapV3FactoryABI,
        web3Provider
      );

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        feeTier
      );
      __log__(`Pool: ${poolAddress}`);

      const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI,
        web3Provider
      );

      const [immutables, state] = await Promise.all([
        __getPoolImmutables(poolContract),
        __getPoolState(poolContract),
      ]);

      [
        token0,
        token1,
        minPrice,
        maxPrice,
        amount0,
        amount1,
        token0Amount,
        token1Amount,
        token0BigNum,
        token1BigNum
      ] =
        token0.address === immutables.token0
          ? [
              token0,
              token1,
              minPrice,
              maxPrice,
              amount0,
              amount1,
              token0Amount,
              token1Amount,
              token0BigNum,
              token1BigNum
            ]
          : [
              token1,
              token0,
              1 / maxPrice,
              1 / minPrice,
              amount1,
              amount0,
              token1Amount,
              token0Amount,
              token1BigNum,
              token0BigNum
            ];

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

      __log__(`Tick Lower: ${tickLower}, Tick Upper: ${tickUpper}`);

      __log__("Routing ...");
      const routeToRatioResponse = await router.routeToRatio(
        token0Amount,
        token1Amount,
        new Position({
          pool: pool,
          tickLower: tickLower,
          tickUpper: tickUpper,
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
            recipient: walletAddress,
          },
        }
      );

      if (routeToRatioResponse.status == SwapToRatioStatus.SUCCESS) {
        let feeData = false;

        const token0Contract = new ethers.Contract(
          token0.address,
          IERC20MinimalABI,
          web3Provider
        );
        const token0Allowance = await token0Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if ( ethers.BigNumber.from(token0Allowance).gt(token0BigNum) ) {
          __log__(`No need to approve ${token0.symbol}`);
        } else {
          __log__("Getting the actual feeData ...");
          feeData = await web3Provider.getFeeData();
          __log__(`Approving ${token0.symbol} ...`);
          let approvalTx = await token0Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }

        const token1Contract = new ethers.Contract(
          token1.address,
          IERC20MinimalABI,
          web3Provider
        );
        const token1Allowance = await token1Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if ( ethers.BigNumber.from(token1Allowance).gt(token1BigNum) ) {
          __log__(`No need to approve ${token1.symbol}`);
        } else {
          if (feeData === false) {
            __log__("Getting the actual feeData ...");
            feeData = await web3Provider.getFeeData();
          }
          __log__(`Approving ${token1.symbol} ...`);
          approvalTx = await token1Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }

        const route = routeToRatioResponse.result;

        const nonce = await web3Provider.getTransactionCount(walletAddress);
        __log__(`Nonce: ${nonce}`);

        const multicallTx = {
          nonce: nonce,
          data: route.methodParameters.calldata,
          to: V3_SWAP_ROUTER_ADDRESS,
          value: ethers.BigNumber.from(route.methodParameters.value),
          from: walletAddress,
          gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
          gasLimit: 1_000_000,
          chainId: network,
        };

        const signedTx = await wallet.signTransaction(multicallTx);

        const tx = await web3Provider.sendTransaction(signedTx);
        __log__(`Transaction: ${tx.hash}`);
        const result = await tx.wait();

        const tokenId = __getTokenIdFromTransactionLogs(result.logs);
        await UnwrapAll();
        return tokenId;
      }
      return false;
    } catch (e) {
      __log__(e.message);
      await UnwrapAll();
      return false;
    }
  }

  async function CreatePoolPositionMax(
    token0,
    token1,
    feeTier,
    minPrice,
    maxPrice
  ) {
    let token0Balance = await GetAmount(token0);
    if (token0Balance === false) return false;

    // TODO: If token0 is the native token then do NOT use all of it, we must leave a little for the gas fee!

    let token1Balance = await GetAmount(token1);
    if (token1Balance === false) return false;

    const result = await CreatePoolPosition(
      token0,
      token1,
      feeTier,
      minPrice,
      maxPrice,
      token0Balance.bignum,
      token1Balance.bignum
    );

    return result;
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
    try {
      if (token0.isNative) {
        const ok = await Wrap(amount0);
        if (!ok) return false;
        token0 = token0.wrapped;
      }
      if (token1.isNative) {
        const ok = await Wrap(amount1);
        if (!ok) return false;
        token1 = token1.wrapped;
      }
    } catch (e) {
      return false;
    }

    try {
      let token0Amount;
      let token0AmountHuman;
      let token0BigNum;
      if (amount0 instanceof ethers.BigNumber) {
        token0AmountHuman = amount0 / Math.pow(10, token0.decimals);
        token0BigNum = amount0;
      } else {
        if (typeof amount0 !== 'number') return false;
        token0AmountHuman = amount0;
        token0BigNum = ethers.BigNumber.from('' + Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)));
      }
      token0Amount = CurrencyAmount.fromRawAmount(token0, Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)));

      let token1Amount;
      let token1AmountHuman;
      let token1BigNum;
      if (amount1 instanceof ethers.BigNumber) {
        token1AmountHuman = amount1 / Math.pow(10, token1.decimals);
        token1BigNum = amount1;
      } else {
        if (typeof amount1 !== 'number') return false;
        token1AmountHuman = amount1;
        token1BigNum = ethers.BigNumber.from('' + Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)));
      }
      token1Amount = CurrencyAmount.fromRawAmount(token1, Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)));

      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        IUniswapV3FactoryABI,
        web3Provider
      );

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        feeTier
      );
      __log__(`Pool: ${poolAddress}`);

      const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI,
        web3Provider
      );

      const [immutables, state] = await Promise.all([
        __getPoolImmutables(poolContract),
        __getPoolState(poolContract),
      ]);

      [
        token0,
        token1,
        minTick,
        maxTick,
        amount0,
        amount1,
        token0Amount,
        token1Amount,
        token0BigNum,
        token1BigNum
      ] =
        token0.address === immutables.token0
          ? [
              token0,
              token1,
              minTick,
              maxTick,
              amount0,
              amount1,
              token0Amount,
              token1Amount,
              token0BigNum,
              token1BigNum
            ]
          : [
              token1,
              token0,
              -maxTick,
              -minTick,
              amount1,
              amount0,
              token1Amount,
              token0Amount,
              token1BigNum,
              token0BigNum
            ];

      const pool = new Pool(
        token0,
        token1,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
      );

      const tickLower = minTick;
      const tickUpper = maxTick;

      __log__(`Tick Lower: ${tickLower}, Tick Upper: ${tickUpper}`);

      __log__("Routing ...");
      const routeToRatioResponse = await router.routeToRatio(
        token0Amount,
        token1Amount,
        new Position({
          pool: pool,
          tickLower: tickLower,
          tickUpper: tickUpper,
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
            recipient: walletAddress,
          },
        }
      );

      if (routeToRatioResponse.status == SwapToRatioStatus.SUCCESS) {
        let feeData = false;

        const token0Contract = new ethers.Contract(
          token0.address,
          IERC20MinimalABI,
          web3Provider
        );
        const token0Allowance = await token0Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if ( ethers.BigNumber.from(token0Allowance).gt(token0BigNum) ) {
          __log__(`No need to approve ${token0.symbol}`);
        } else {
          __log__("Getting the actual feeData ...");
          feeData = await web3Provider.getFeeData();
          __log__(`Approving ${token0.symbol} ...`);
          let approvalTx = await token0Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }

        const token1Contract = new ethers.Contract(
          token1.address,
          IERC20MinimalABI,
          web3Provider
        );
        const token1Allowance = await token1Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if ( ethers.BigNumber.from(token1Allowance).gt(token1BigNum) ) {
          __log__(`No need to approve ${token1.symbol}`);
        } else {
          if (feeData === false) {
            __log__("Getting the actual feeData ...");
            feeData = await web3Provider.getFeeData();
          }
          __log__(`Approving ${token1.symbol} ...`);
          approvalTx = await token1Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }

        const route = routeToRatioResponse.result;

        const nonce = await web3Provider.getTransactionCount(walletAddress);
        __log__(`Nonce: ${nonce}`);

        const multicallTx = {
          nonce: nonce,
          data: route.methodParameters.calldata,
          to: V3_SWAP_ROUTER_ADDRESS,
          value: ethers.BigNumber.from(route.methodParameters.value),
          from: walletAddress,
          gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
          gasLimit: 1_000_000,
          chainId: network,
        };

        const signedTx = await wallet.signTransaction(multicallTx);

        const tx = await web3Provider.sendTransaction(signedTx);
        __log__(`Transaction: ${tx.hash}`);
        const result = await tx.wait();

        const tokenId = __getTokenIdFromTransactionLogs(result.logs);
        await UnwrapAll();
        return tokenId;
      }
      return false;
    } catch (e) {
      __log__(e.message);
      await UnwrapAll();
      return false;
    }
  }

  async function CreatePoolPositionTicksMax(
    token0,
    token1,
    feeTier,
    minTick,
    maxTick
  ) {
    let token0Balance = await GetAmount(token0);
    if (token0Balance === false) return false;

    // TODO: If token0 is the native token then do NOT use all of it, we must leave a little for the gas fee!

    let token1Balance = await GetAmount(token1);
    if (token1Balance === false) return false;

    const result = await CreatePoolPositionTicks(
      token0,
      token1,
      feeTier,
      minTick,
      maxTick,
      token0Balance.bignum,
      token1Balance.bignum
    );

    return result;
  }

  async function ClosePoolPosition(tokenId) {
    try {
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

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        positionInfo.fee
      );
      __log__(`Pool: ${poolAddress}`);

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

      const { calldata, value } =
        NonfungiblePositionManager.removeCallParameters(position, {
          tokenId: tokenId,
          liquidityPercentage: new Percent(1),
          slippageTolerance: new Percent(5, 100),
          deadline: Math.floor(Date.now() / 1000 + 1800),
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
            recipient: walletAddress,
          },
        });

      const nonce = await web3Provider.getTransactionCount(walletAddress);
      __log__(`Nonce: ${nonce}`);

      const feeData = await web3Provider.getFeeData();

      const multicallTx = {
        nonce: nonce,
        data: calldata,
        to: V3_POSITION_NFT_ADDRESS,
        from: walletAddress,
        value: ethers.BigNumber.from(value),
        gasPrice: feeData.gasPrice.mul(125).div(100),
        gasLimit: 1_000_000,
        chainId: network,
      };

      const signedTx = await wallet.signTransaction(multicallTx);

      const tx = await web3Provider.sendTransaction(signedTx);
      const result = await tx.wait();

      await UnwrapAll();

      return true;
    } catch (e) {
      await UnwrapAll();
      return false;
    }
  }

  async function GetNFTList(hideClosedPositions = true) {
    try {
      const nativeToken = nativeOnChain(network);
      const wrappedToken = nativeToken.wrapped;

      const positionManagerContract = new ethers.Contract(
        V3_POSITION_NFT_ADDRESS,
        INonfungiblePositionManagerABI,
        web3Provider
      );
      const size = (
        await positionManagerContract.balanceOf(walletAddress)
      ).toNumber();

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
          const isActive = Number(position.liquidity) === 0 ? false : true;
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
            minTick: Number(position.tickLower),
            maxTick: Number(position.tickUpper),
            isActivePosition: isActive,
            isInRange: tick >= position.tickLower && tick <= position.tickUpper,
            token0: token0.address === wrappedToken.address ? nativeToken.symbol : token0.symbol,
            token1: token1.address === wrappedToken.address ? nativeToken.symbol : token1.symbol,
            feeTier: position.fee / 10000,
            liquidityToken0: Number(amount0),
            liquidityToken1: Number(amount1),
            unclaimedFee0: Number(unclaimedFee0),
            unclaimedFee1: Number(unclaimedFee1),
            minPrice: Number(
              tickToPrice(token0, token1, position.tickLower).toSignificant(5)
            ),
            maxPrice: Number(
              tickToPrice(token0, token1, position.tickUpper).toSignificant(5)
            ),
            currentPrice: Number(
              tickToPrice(token0, token1, tick).toSignificant(5)
            ),
          };
        })
      );
      return hideClosedPositions
        ? positionList.filter((position) => position.isActivePosition)
        : positionList;
    } catch (e) {
      __log__(e);
      return false;
    }
  }

  async function CollectUnclaimedFees(tokenId) {
    try {
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

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        positionInfo.fee
      );
      __log__(`Pool: ${poolAddress}`);

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

      __log__("amount0:", position.amount0.toSignificant(4));
      __log__("amount1:", position.amount1.toSignificant(4));

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
      __log__(`Nonce: ${nonce}`);

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
      __log__("Unsigned Tx");
      __log__(unsignedTx);

      const signedTx = await wallet.signTransaction(unsignedTx);
      __log__(`Signed Tx: ${signedTx}`);

      const tx = await web3Provider.sendTransaction(signedTx);
      await tx.wait();
      return {
        [token0.symbol]: Number(unclaimedFee0),
        [token1.symbol]: Number(unclaimedFee1),
      };
    } catch (e) {
      return false;
    }
  }

  async function GetUnclaimedFeeAmounts(tokenId) {
    try {
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

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        positionInfo.fee
      );
      __log__(`Pool: ${poolAddress}`);

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

      __log__("amount0:", position.amount0.toSignificant(4));
      __log__("amount1:", position.amount1.toSignificant(4));

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
        [token0.symbol]: Number(unclaimedFee0),
        [token1.symbol]: Number(unclaimedFee1),
      };
    } catch (e) {
      return false;
    }
  }

  async function GetFeeTiers(token0, token1) {
    try {
      const possibleFeeTiers = [100, 500, 3_000, 5_000, 10_000];
      const result = [];

      token0 = token0.isNative ? token0.wrapped : token0;
      token1 = token1.isNative ? token1.wrapped : token1;

      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        IUniswapV3FactoryABI,
        web3Provider
      );

      for (const fee of possibleFeeTiers) {
        __log__(`Getting pool with fee ${fee / 10_000}%...`);
        const poolAddress = await factoryContract.getPool(
          token0.address,
          token1.address,
          fee
        );
        if (poolAddress !== ADDRESS_ZERO) {
          result.push(fee / 10_000);
          __log__("Okay");
        } else {
          __log__("Not exist");
        }
      }

      return result;
    } catch (e) {
      return false;
    }
  }

  async function GetCurrentPriceTick(token0, token1, feeTier) {
    if (token0.isNative) token0 = token0.wrapped;
    if (token1.isNative) token1 = token1.wrapped;

    try {
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
      __log__(`Pool: ${poolAddress}`);

      const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI,
        web3Provider
      );

      const [immutables, state] = await Promise.all([
        __getPoolImmutables(poolContract),
        __getPoolState(poolContract),
      ]);

      return immutables.token0 === token0.address ? state.tick : -state.tick;
    } catch (e) {
      return false;
    }
  }

  async function GetNearestTickRangeFromPrice(token0, token1, feeTier, price) {
    if (token0.isNative) token0 = token0.wrapped;
    if (token1.isNative) token1 = token1.wrapped;

    const inputToken0 = token0;

    feeTier *= 10_000;

    try {
      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        IUniswapV3FactoryABI,
        web3Provider
      );

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        feeTier
      );
      __log__(`Pool: ${poolAddress}`);

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
      );
      const nearestTick = nearestUsableTick(
        priceToClosestTick(currentPrice),
        immutables.tickSpacing
      );

      let tickLower, tickUpper;
      const nearestPrice = tickToPrice(token0, token1, nearestTick);
      if (nearestPrice.greaterThan(currentPrice)) {
        [tickLower, tickUpper] = [
          nearestTick - immutables.tickSpacing,
          nearestTick,
        ];
      } else {
        [tickLower, tickUpper] = [
          nearestTick,
          nearestTick + immutables.tickSpacing,
        ];
      }

      return (inputToken0.address === token0.address) ? [tickLower, tickUpper] : [-tickUpper, -tickLower];
    } catch (e) {
      __log__(e);
      return false;
    }
  }

  async function GetNearestTickRangeFromTick(token0, token1, feeTier, tick) {
    if (token0.isNative) token0 = token0.wrapped;
    if (token1.isNative) token1 = token1.wrapped;

    const inputToken0 = token0;

    feeTier *= 10_000;

    try {
      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        IUniswapV3FactoryABI,
        web3Provider
      );

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        feeTier
      );
      __log__(`Pool: ${poolAddress}`);

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

      const nearestTick = nearestUsableTick(tick, immutables.tickSpacing);

      let tickLower, tickUpper;
      if (nearestTick > tick) {
        [tickLower, tickUpper] = [
          nearestTick - immutables.tickSpacing,
          nearestTick,
        ];
      } else {
        [tickLower, tickUpper] = [
          nearestTick,
          nearestTick + immutables.tickSpacing,
        ];
      }

      return (inputToken0.address === token0.address) ? [tickLower, tickUpper] : [-tickUpper, -tickLower];
    } catch (e) {
      __log__(e);
      return false;
    }
  }

  async function AddLiquidity(tokenId, amount0, amount1) {
    try {
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

      let token0Amount;
      let token0AmountHuman;
      let token0BigNum;
      if (amount0 instanceof ethers.BigNumber) {
        token0AmountHuman = amount0 / Math.pow(10, token0.decimals);
        token0BigNum = amount0;
      } else {
        if (typeof amount0 !== 'number') return false;
        token0AmountHuman = amount0;
        token0BigNum = ethers.BigNumber.from('' + Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)));
      }
      token0Amount = CurrencyAmount.fromRawAmount(token0, Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)));

      let token1Amount;
      let token1AmountHuman;
      let token1BigNum;
      if (amount1 instanceof ethers.BigNumber) {
        token1AmountHuman = amount1 / Math.pow(10, token1.decimals);
        token1BigNum = amount1;
      } else {
        if (typeof amount1 !== 'number') return false;
        token1AmountHuman = amount1;
        token1BigNum = ethers.BigNumber.from('' + Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)));
      }
      token1Amount = CurrencyAmount.fromRawAmount(token1, Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)));

      __log__(`Token0: ${token0.symbol}, Token1: ${token1.symbol}`);

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        positionInfo.fee
      );
      __log__(`Pool: ${poolAddress}`);

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
        amount0: Math.floor(token0AmountHuman * Math.pow(10, token0.decimals)),
        amount1: Math.floor(token1AmountHuman * Math.pow(10, token1.decimals)),
      });

      __log__("Routing ...");
      const routeToRatioResponse = await router.routeToRatio(
        token0Amount,
        token1Amount,
        position,
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
            tokenId,
          },
        }
      );

      if (routeToRatioResponse.status == SwapToRatioStatus.SUCCESS) {
        let feeData = false;

        const token0Contract = new ethers.Contract(
          token0.address,
          IERC20MinimalABI,
          web3Provider
        );
        const token0Allowance = await token0Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if ( ethers.BigNumber.from(token0Allowance).gt(token0BigNum) ) {
          __log__(`No need to approve ${token0.symbol}`);
        } else {
          __log__("Getting the actual feeData ...");
          feeData = await web3Provider.getFeeData();
          __log__(`Approving ${token0.symbol} ...`);
          let approvalTx = await token0Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }

        const token1Contract = new ethers.Contract(
          token1.address,
          IERC20MinimalABI,
          web3Provider
        );
        const token1Allowance = await token1Contract.allowance(
          walletAddress,
          V3_SWAP_ROUTER_ADDRESS
        );
        if ( ethers.BigNumber.from(token1Allowance).gt(token1BigNum) ) {
          __log__(`No need to approve ${token1.symbol}`);
        } else {
          if (feeData === false) {
            __log__("Getting the actual feeData ...");
            feeData = await web3Provider.getFeeData();
          }
          __log__(`Approving ${token1.symbol} ...`);
          approvalTx = await token1Contract
            .connect(connectedWallet)
            .approve(V3_SWAP_ROUTER_ADDRESS, MAX_UINT128, {
              gasPrice: feeData.gasPrice.mul(110).div(100),
            });
          await approvalTx.wait();
        }

        const route = routeToRatioResponse.result;

        const nonce = await web3Provider.getTransactionCount(walletAddress);
        __log__(`Nonce: ${nonce}`);

        const multicallTx = {
          nonce: nonce,
          data: route.methodParameters.calldata,
          to: V3_SWAP_ROUTER_ADDRESS,
          value: ethers.BigNumber.from(route.methodParameters.value),
          from: walletAddress,
          gasPrice: ethers.BigNumber.from(route.gasPriceWei).mul(110).div(100),
          gasLimit: 1_000_000,
          chainId: network,
        };

        const signedTx = await wallet.signTransaction(multicallTx);

        const tx = await web3Provider.sendTransaction(signedTx);
        __log__(`Transaction: ${tx.hash}`);
        await tx.wait();
        return true;
      }
      return false;
    } catch (e) {
      __log__(e.message);
      return false;
    }
  }

  async function AddLiquidityMax(tokenId) {
    try {
      const positionManagerContract = new ethers.Contract(
        V3_POSITION_NFT_ADDRESS,
        INonfungiblePositionManagerABI,
        web3Provider.getSigner(wallet.address)
      );

      const positionInfo = await positionManagerContract.positions(tokenId);
      const token0 = __getTokenByAddress(positionInfo.token0, network);
      const token1 = __getTokenByAddress(positionInfo.token1, network);

      let token0Balance = await GetAmount(token0);
      if (token0Balance === false) return false;

      // TODO: If token0 is the native token then do NOT use all of it, we must leave a little for the gas fee!

      let token1Balance = await GetAmount(token1);
      if (token1Balance === false) return false;

      const result = await AddLiquidity(tokenId, token0Balance.bignum, token1Balance.bignum);
      return result;
    } catch (e) {
      return false;
    }
  }

  async function GetPoolPositionInfo(tokenId) {
    try {
      const positionManagerContract = new ethers.Contract(
        V3_POSITION_NFT_ADDRESS,
        INonfungiblePositionManagerABI,
        web3Provider
      );

      const nativeToken = nativeOnChain(network);
      const wrappedToken = nativeToken.wrapped;

      const position = await positionManagerContract.positions(tokenId);
      const token0 = __getTokenByAddress(position.token0, network);
      const token1 = __getTokenByAddress(position.token1, network);
      const isActive = Number(position.liquidity) === 0 ? false : true;
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
        minTick: Number(position.tickLower),
        maxTick: Number(position.tickUpper),
        isActivePosition: isActive,
        isInRange: tick >= position.tickLower && tick <= position.tickUpper,
        token0: token0.address === wrappedToken.address ? nativeToken.symbol : token0.symbol,
        token1: token1.address === wrappedToken.address ? nativeToken.symbol : token1.symbol,
        feeTier: position.fee / 10000,
        liquidityToken0: Number(amount0),
        liquidityToken1: Number(amount1),
        unclaimedFee0: Number(unclaimedFee0),
        unclaimedFee1: Number(unclaimedFee1),
        minPrice: Number(
          tickToPrice(token0, token1, position.tickLower).toSignificant(5)
        ),
        maxPrice: Number(
          tickToPrice(token0, token1, position.tickUpper).toSignificant(5)
        ),
        currentPrice: Number(
          tickToPrice(token0, token1, tick).toSignificant(5)
        ),
      };
    } catch (e) {
      return false;
    }
  }

  async function SwapAll(token0, token1) {
    const token0Amount = await GetAmount(token0);
    if (token0Amount === false) return false;

    // TODO: If token0 is the native token then do NOT swap all of it, we must leave a little for the gas fee!

    const result = await Swap(token0, token1, token0Amount.bignum);
    return result;
  }

  async function GetPoolData(token0, token1, feeTier) {
    feeTier *= 10000;
    try {
      if (token0.isNative) {
        token0 = token0.wrapped;
      }
      if (token1.isNative) {
        token1 = token1.wrapped;
      }
    } catch (e) {
      return false;
    }

    try {
      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        IUniswapV3FactoryABI,
        web3Provider
      );

      __log__("Getting pool...");
      const poolAddress = await factoryContract.getPool(
        token0.address,
        token1.address,
        feeTier
      );
      __log__(`Pool: ${poolAddress}`);

      const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI,
        web3Provider
      );

      const [immutables, state] = await Promise.all([
        __getPoolImmutables(poolContract),
        __getPoolState(poolContract),
      ]);

      [token0, token1] =
        token0.address === immutables.token0
          ? [token0, token1]
          : [token1, token0];

      return {
        spacing: immutables.tickSpacing,
        token0: token0.symbol,
        token1: token1.symbol,
      };
    } catch (e) {
      return false;
    }
  }

  return {
    Wrap,
    Unwrap,
    UnwrapAll,
    GetAmount,
    GetCurrentPrice,
    Swap,
    CreatePoolPosition,
    CreatePoolPositionMax,
    CreatePoolPositionTicks,
    CreatePoolPositionTicksMax,
    ClosePoolPosition,
    GetNFTList,
    CollectUnclaimedFees,
    GetUnclaimedFeeAmounts,
    GetFeeTiers,
    GetCurrentPriceTick,
    GetNearestTickRangeFromPrice,
    GetNearestTickRangeFromTick,
    AddLiquidity,
    AddLiquidityMax,
    GetPoolPositionInfo,
    SwapAll,
    GetPoolData,
    Tokens: Tokens[network],
  };
}

module.exports = { Init, Networks };
