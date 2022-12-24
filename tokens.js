const { nativeOnChain } = require("@uniswap/smart-order-router");
const {
  Token,
  SupportedChainId,
} = require("@uniswap/sdk-core");

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
    ETH: nativeOnChain(Networks.POLYGON),
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
    WBTC: new Token(
      Networks.POLYGON,
      "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      8,
      "WBTC",
      "Wrapped Bitcoin"
    )
  },
}

module.exports = {
  Networks, Tokens
};