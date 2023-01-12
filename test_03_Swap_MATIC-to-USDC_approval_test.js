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

  // 3. Test Swap function

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.MATIC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC`);
  }
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC\n`);
  }

  console.log("Swapping 1 MATIC to USDC");
  let result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.USDC, 1, false);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have 1 MATIC less and more USDC in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC`);
  }
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC\n`);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
