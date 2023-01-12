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

  // 4. Test CreatePoolPosition function

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH\n`);
  }

  console.log("Creating new pool USDC/WETH feeTier: 0.05, price range: 1325 - 1375, WETH amount: 0.001, USDC amount: 1");
  let result = await lib.CreatePoolPosition(
    lib.Tokens.USDC,
    lib.Tokens.WETH,
    0.05,
    1/1375,
    1/1325,
    1,
    0.001
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 0.001 WETH less and 1 USDC less in the wallet) :\n");
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
