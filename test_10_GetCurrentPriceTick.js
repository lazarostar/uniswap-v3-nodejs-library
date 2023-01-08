const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 10. Test GetCurrentPriceTick function

  console.log(`Getting the current tick value for USDC/WETH`)
  var currentTick = await lib.GetCurrentPriceTick(lib.Tokens.USDC, lib.Tokens.WETH, 0.05);
  console.log(`Current tick is ${currentTick}\n`);

  console.log(`Getting the current tick value for WETH/USDC`)
  currentTick = await lib.GetCurrentPriceTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05);
  console.log(`Current tick is ${currentTick}\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
