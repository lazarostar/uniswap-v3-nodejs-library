const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 12. Test GetNearestTickRangeFromPrice function

  console.log(`Getting the current tick value for USDC/WETH feeTier 0.05`)
  var currentTick = await lib.GetCurrentPriceTick(lib.Tokens.USDC, lib.Tokens.WETH, 0.05);
  console.log(`Current tick is ${currentTick}\n`);

  console.log(`Getting the nearest "USDC/WETH feeTier 0.05" tick range from tick ${currentTick}`)
  var result = await lib.GetNearestTickRangeFromTick(lib.Tokens.USDC, lib.Tokens.WETH, 0.05, currentTick);
  if (result !== false) {
    console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  } else {
    console.log(`Result: ${result}\n`);
  }

  // ---

  console.log(`Getting the current tick value for WETH/USDC feeTier 0.05`)
  var currentTick = await lib.GetCurrentPriceTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05);
  console.log(`Current tick is ${currentTick}\n`);

  console.log(`Getting the nearest "WETH/USDC feeTier 0.05" tick range from tick ${currentTick}`)
  result = await lib.GetNearestTickRangeFromTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, currentTick);
  if (result !== false) {
    console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  } else {
    console.log(`Result: ${result}\n`);
  }

  // ---

  console.log(`Getting the current tick value for USDC/MATIC feeTier 0.05`)
  currentTick = await lib.GetCurrentPriceTick(lib.Tokens.USDC, lib.Tokens.MATIC, 0.05);
  console.log(`Current tick is ${currentTick}\n`);

  console.log(`Getting the nearest "USDC/MATIC feeTier 0.05" tick range from tick ${currentTick}`)
  result = await lib.GetNearestTickRangeFromTick(lib.Tokens.USDC, lib.Tokens.MATIC, 0.05, currentTick);
  if (result !== false) {
    console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  } else {
    console.log(`Result: ${result}\n`);
  }

  // ---

  console.log(`Getting the current tick value for MATIC/USDC feeTier 0.05`)
  currentTick = await lib.GetCurrentPriceTick(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05);
  console.log(`Current tick is ${currentTick}\n`);

  console.log(`Getting the nearest "MATIC/USDC feeTier 0.05" tick range from tick ${currentTick}`)
  result = await lib.GetNearestTickRangeFromTick(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, currentTick);
  if (result !== false) {
    console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  } else {
    console.log(`Result: ${result}\n`);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
