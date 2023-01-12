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

  // 17. Test SwapAll function

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC\n`);

  }

  console.log("Swapping all USDC tokens in the wallet to MATIC");
  const result = await lib.SwapAll(lib.Tokens.USDC, lib.Tokens.MATIC)
  console.log(`Result: ${result}\n`);

  console.log("After (we should have 0 USDC and more MATIC in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC\n`);

  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
