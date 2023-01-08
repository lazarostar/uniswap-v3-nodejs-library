const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 4. Test CreatePoolPosition function

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool USDC/WETH feeTier: 0.05, price range: 1255 - 1265, WETH amount: 0.001, USDC amount: 1`)
  var result = await lib.CreatePoolPosition(
    lib.Tokens.USDC,
    lib.Tokens.WETH,
    0.05,
    0.00079051, // = 1/1265
    0.00079681, // = 1/1255
    1,
    0.001
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 0.001 less WETH and 1 less USDC in the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
