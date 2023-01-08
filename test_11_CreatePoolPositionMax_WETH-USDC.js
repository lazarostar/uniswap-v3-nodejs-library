const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 11. Test CreatePoolPositionMax function

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool WETH/USDC feeTier: 0.05, price range: 1265 - 1275, adding all WETH and USDC what we have`)
  var result = await lib.CreatePoolPositionMax(
    lib.Tokens.WETH,
    lib.Tokens.USDC,
    0.05,
    1265,
    1275
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 0 WETH and 0 USDC in the wallet because we should have added all those to the new pool) :\n")
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
