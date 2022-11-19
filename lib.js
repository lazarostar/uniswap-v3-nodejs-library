const Web3 = require("web3");
const { Pool, FACTORY_ADDRESS, ADDRESS_ZERO } = require("@uniswap/v3-sdk");
const { Token, SupportedChainId } = require("@uniswap/sdk-core");

const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const {
  abi: IUniswapV3FactoryABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json");

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
];

const tokens = {
  ETH: ADDRESS_ZERO,
  WETH: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  MATIC: "0x0000000000000000000000000000000000001010",
  WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

function Init(walletAddress, privateKey, rpcUrl) {
  const web3 = new Web3(rpcUrl);

  async function GetAmount(token) {
    try {
      if (token === ADDRESS_ZERO) {
        const balance = await web3.eth.getBalance(walletAddress);
        return balance / Math.pow(10, 18);
      }
      const contract = new web3.eth.Contract(IERC20MinimalABI, token);
      const decimals = await contract.methods.decimals().call();
      const balance = await contract.methods.balanceOf(walletAddress).call();
      return balance / Math.pow(10, decimals);
    } catch (e) {
      console.log("Error occured:", e.message);
    }
  }

  async function GetCurrentPrice(token0, token1, fee = 3000) {
    const factory = new web3.eth.Contract(
      IUniswapV3FactoryABI,
      FACTORY_ADDRESS
    );
    const poolAddress = await factory.methods
      .getPool(token0, token1, fee)
      .call();

    const pool = await createPoolInstance(poolAddress);
    const tokenPrice =
      pool.token0.address === token0 ? pool.token1Price : pool.token0Price;
    return tokenPrice.toFixed(6);
  }

  async function createPoolInstance(poolAddress) {
    const poolContract = new web3.eth.Contract(IUniswapV3PoolABI, poolAddress);

    const [immutables, state] = await Promise.all([
      getPoolImmutables(poolContract),
      getPoolState(poolContract),
    ]);

    const token0Contract = new web3.eth.Contract(
      IERC20MinimalABI,
      immutables.token0
    );
    const [decimals0, symbol0, name0] = await Promise.all([
      token0Contract.methods.decimals().call(),
      token0Contract.methods.symbol().call(),
      token0Contract.methods.name().call(),
    ]);

    const token1Contract = new web3.eth.Contract(
      IERC20MinimalABI,
      immutables.token1
    );
    const [decimals1, symbol1, name1] = await Promise.all([
      token1Contract.methods.decimals().call(),
      token1Contract.methods.symbol().call(),
      token1Contract.methods.name().call(),
    ]);

    const TokenA = new Token(
      SupportedChainId.POLYGON,
      immutables.token0,
      Number(decimals0),
      symbol0,
      name0
    );

    const TokenB = new Token(
      SupportedChainId.POLYGON,
      immutables.token1,
      Number(decimals1),
      symbol1,
      name1
    );

    const pool = new Pool(
      TokenA,
      TokenB,
      Number(immutables.fee),
      state.sqrtPriceX96.toString(),
      state.liquidity.toString(),
      Number(state.tick)
    );

    return pool;
  }

  async function getPoolImmutables(poolContract) {
    const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
      await Promise.all([
        poolContract.methods.factory().call(),
        poolContract.methods.token0().call(),
        poolContract.methods.token1().call(),
        poolContract.methods.fee().call(),
        poolContract.methods.tickSpacing().call(),
        poolContract.methods.maxLiquidityPerTick().call(),
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
      poolContract.methods.liquidity().call(),
      poolContract.methods.slot0().call(),
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

  return {
    GetAmount,
    GetCurrentPrice,
  };
}

module.exports = { Init, tokens };
