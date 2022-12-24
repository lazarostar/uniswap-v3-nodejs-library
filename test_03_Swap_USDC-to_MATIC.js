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
  var balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);

  // Swapping 1 MATIC worth of USDC to MATIC (after this we should have 1 more MATIC in the wallet)
  var result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.MATIC, 0.2, true);
  // console.log(result);

  console.log("\nAfter (we should have 1 more MATIC in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);

  // Swapping 1 USDC to MATIC (after this we should have 1 USDC less in the wallet)
  result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.MATIC, 0.2, false);
  // console.log(result);

  console.log("\nAfter (we should have 1 USDC less in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
