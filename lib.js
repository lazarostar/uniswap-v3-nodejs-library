const Web3 = require("web3");

const TokenAddresses = {
  ETH: "0x0000000000000000000000000000000000000000",
  WETH: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  MATIC: "0x0000000000000000000000000000000000001010",
  WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
};

// The minimum ABI to get ERC20 Token balance
let minABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // decimals
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

module.exports = function Init(walletAddress, privateKey, rpcUrl) {
  const web3 = new Web3(rpcUrl);

  async function GetAmount(token) {
    let contract = new web3.eth.Contract(minABI, TokenAddresses[token]);
    decimals = await contract.methods.decimals().call();
    balance = await contract.methods.balanceOf(walletAddress).call();
    return balance / Math.pow(10, decimals);
  }

  return {
    GetAmount,
  };
};
