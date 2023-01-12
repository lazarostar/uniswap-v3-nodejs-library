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
  let balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH\n`);
  }

  console.log('Swapping "0.001 WETH worth of USDC" to WETH');
  let result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.WETH, 0.001, true);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have less USDC and 0.001 WETH more in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH\n`);
  }

  // ---

  console.log("Swapping 1 USDC to WETH");
  result = await lib.Swap(lib.Tokens.USDC, lib.Tokens.WETH, 1, false);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have 1 USDC less and more WETH in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH\n`);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
