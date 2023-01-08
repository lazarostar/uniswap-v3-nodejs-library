const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 3. Test Swap function

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  console.log(`Swapping 100 USDC to MATIC`)
  var result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.MATIC, 100, false);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have the same amount if we didn't have 100 USDC in the wallet at the beginning) :\n")
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
