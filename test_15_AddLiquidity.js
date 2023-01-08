const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 15. Test AddLiquidity function

  const poolID = 613718

  var result = await lib.GetPoolPositionInfo(poolID)
  console.log(result, `\n`)

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Adding Liquidity to pool #${poolID}`)
  result = await lib.AddLiquidity(poolID, 1, 0.001)
  console.log(`Result: ${result}\n`);

  console.log("After:\n")
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
