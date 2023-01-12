const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL,
    true // debug on
  );

  // 1. Test GetAmount function

  // MATIC:
  let balance = await lib.GetAmount(lib.Tokens.MATIC);
  // console.log(); console.log(balance);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC`);
  }

  // ETH:
  if (lib.Tokens.hasOwnProperty('ETH')) {
    balance = await lib.GetAmount(lib.Tokens.ETH);
    // console.log(); console.log(balance);
    if (balance !== false) {
      console.log(`Balance: ${balance.value} ETH`);
    }
  }

  // USDC:
  balance = await lib.GetAmount(lib.Tokens.USDC);
  // console.log(); console.log(balance);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }

  // WBTC:
  balance = await lib.GetAmount(lib.Tokens.WBTC);
  // console.log(); console.log(balance);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WBTC`);
  }

  // WETH:
  balance = await lib.GetAmount(lib.Tokens.WETH);
  // console.log(); console.log(balance);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH`);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
