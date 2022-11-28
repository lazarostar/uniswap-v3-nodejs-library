const ethers = require("ethers");
const JSBI = require("jsbi");
const { ADDRESS_ZERO } = require("@uniswap/v3-sdk");
const {
  AlphaRouter,
  SwapType,
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
      "Tether USD"
    ),
  },
};

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
            V3_SWAP_ROUTER_ADDRESS,
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
        value: token0.isNative
          ? ethers.BigNumber.from(isOutput ? quoteAmountString : amountString)
          : 0,
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

  return {
    GetAmount,
    GetCurrentPrice,
    Swap,
    Tokens: Tokens[network],
  };
}

module.exports = { Init, Networks };
