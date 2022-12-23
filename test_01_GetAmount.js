const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 1. Test GetAmount function

  // MATIC:
  var balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);

  // USDC:
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);

  // ETH:
  balance = await lib.GetAmount(lib.Tokens.ETH);
  console.log(`Balance: ${balance} ETH`);

  // WETH:
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);

  // WBTC:
  balance = await lib.GetAmount(lib.Tokens.WBTC);
  console.log(`Balance: ${balance} WBTC`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
