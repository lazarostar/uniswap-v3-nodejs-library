const { nativeOnChain } = require("@uniswap/smart-order-router");
const {
  Token,
  SupportedChainId,
} = require("@uniswap/sdk-core");

const Networks = {
  GOERLI: SupportedChainId.GOERLI,
  MAINNET: SupportedChainId.MAINNET,
  POLYGON: SupportedChainId.POLYGON,
  ARBITRUM_ONE: SupportedChainId.ARBITRUM_ONE,
  // OPTIMISM: SupportedChainId.OPTIMISM,
  // CELO: SupportedChainId.CELO,
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
      "Uniswap"
    ),
  },
  [Networks.MAINNET]: {
    NATIVE: nativeOnChain(Networks.MAINNET),
    ETH: nativeOnChain(Networks.MAINNET),
    WETH: new Token(
      Networks.MAINNET,
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      18,
      "WETH",
      "Wrapped Ether"
    ),
    MATIC: new Token(
      Networks.MAINNET,
      "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
      18,
      "MATIC",
      "Matic Token"
    ),
    BNB: new Token(
      Networks.MAINNET,
      "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
      18,
      "BNB",
      "BNB"
    ),
    BUSD: new Token(
      Networks.MAINNET,
      "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
      18,
      "BUSD",
      "Binance USD"
    ),
    DAI: new Token(
      Networks.MAINNET,
      "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      18,
      "DAI",
      "Dai Stablecoin"
    ),
    USDT: new Token(
      Networks.MAINNET,
      "0xdac17f958d2ee523a2206206994597c13d831ec7",
      6,
      "USDT",
      "Tether USD"
    ),
    USDC: new Token(
      Networks.MAINNET,
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      6,
      "USDC",
      "USD Coin"
    ),
    WBTC: new Token(
      Networks.MAINNET,
      "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      8,
      "WBTC",
      "Wrapped BTC"
    ),
    UNI: new Token(
      Networks.MAINNET,
      "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
      18,
      "UNI",
      "Uniswap"
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
      "Wrapped Ether"
    ),
    BNB: new Token(
      Networks.POLYGON,
      "0x3BA4c387f786bFEE076A58914F5Bd38d668B42c3",
      18,
      "BNB",
      "BNB"
    ),
    BUSD: new Token(
      Networks.POLYGON,
      "0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7",
      18,
      "BUSD",
      "Binance USD"
    ),
    DAI: new Token(
      Networks.POLYGON,
      "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      18,
      "DAI",
      "Dai Stablecoin"
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
    WBTC: new Token(
      Networks.POLYGON,
      "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      8,
      "WBTC",
      "Wrapped BTC"
    ),
    UNI: new Token(
      Networks.POLYGON,
      "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",
      18,
      "UNI",
      "Uniswap"
    ),
  },
  [Networks.ARBITRUM_ONE]: {
    NATIVE: nativeOnChain(Networks.ARBITRUM_ONE),
    ETH: nativeOnChain(Networks.ARBITRUM_ONE),
    WETH: new Token(
      Networks.ARBITRUM_ONE,
      "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      18,
      "WETH",
      "Wrapped Ether"
    ),
    DAI: new Token(
      Networks.ARBITRUM_ONE,
      "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      18,
      "DAI",
      "Dai Stablecoin"
    ),
    USDT: new Token(
      Networks.ARBITRUM_ONE,
      "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      6,
      "USDT",
      "Tether USD"
    ),
    USDC: new Token(
      Networks.ARBITRUM_ONE,
      "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
      6,
      "USDC",
      "USD Coin"
    ),
    WBTC: new Token(
      Networks.ARBITRUM_ONE,
      "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      8,
      "WBTC",
      "Wrapped BTC"
    ),
    UNI: new Token(
      Networks.ARBITRUM_ONE,
      "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0",
      18,
      "UNI",
      "Uniswap"
    ),
  },
}

module.exports = {
  Networks, Tokens
};
