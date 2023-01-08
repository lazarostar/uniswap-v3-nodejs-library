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

  console.log(`Swapping "1 MATIC worth of USDC" to MATIC`)
  var result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.MATIC, 1, true);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have less USDC and 1 more MATIC in the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  // ---

  console.log(`Swapping 1 USDC to MATIC`)
  result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.MATIC, 1, false);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have 1 USDC less in the wallet and more MATIC in the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
