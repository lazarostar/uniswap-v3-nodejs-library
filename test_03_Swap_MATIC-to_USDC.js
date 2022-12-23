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

  // Swapping 1 USDC worth of MATIC to USDC (after this we should have 1 more USDC in the wallet)
  var result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.USDC, 1, true);
  // console.log(result);

  console.log("\nAfter (we should have 1 more USDC in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);

  // Swapping 1 MATIC to USDC (after this we should have 1 MATIC less in the wallet)
  result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.USDC, 1, false);
  // console.log(result);

  console.log("\nAfter (we should have 1 MATIC less in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
