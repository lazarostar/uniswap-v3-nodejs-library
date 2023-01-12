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

  // 13. Test GetNearestTickRangeFromTick function

  console.log("Getting the current tick value for USDC/WETH feeTier 0.05");
  let currentTick = await lib.GetCurrentPriceTick(lib.Tokens.USDC, lib.Tokens.WETH, 0.05);
  if (currentTick !== false) {
    console.log(`Current tick is ${currentTick}\n`);
    console.log(`Getting the nearest "USDC/WETH feeTier 0.05" tick range from tick ${currentTick}`);
    let result = await lib.GetNearestTickRangeFromTick(lib.Tokens.USDC, lib.Tokens.WETH, 0.05, currentTick);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(currentTick);
  }

  // ---

  console.log("Getting the current tick value for WETH/USDC feeTier 0.05");
  currentTick = await lib.GetCurrentPriceTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05);
  if (currentTick !== false) {
    console.log(`Current tick is ${currentTick}\n`);
    console.log(`Getting the nearest "WETH/USDC feeTier 0.05" tick range from tick ${currentTick}`);
    let result = await lib.GetNearestTickRangeFromTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, currentTick);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(currentTick);
  }

  // ---

  console.log("Getting the current tick value for USDC/MATIC feeTier 0.05");
  currentTick = await lib.GetCurrentPriceTick(lib.Tokens.USDC, lib.Tokens.MATIC, 0.05);
  if (currentTick !== false) {
    console.log(`Current tick is ${currentTick}\n`);
    console.log(`Getting the nearest "USDC/MATIC feeTier 0.05" tick range from tick ${currentTick}`);
    let result = await lib.GetNearestTickRangeFromTick(lib.Tokens.USDC, lib.Tokens.MATIC, 0.05, currentTick);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(currentTick);
  }

  // ---

  console.log("Getting the current tick value for MATIC/USDC feeTier 0.05");
  currentTick = await lib.GetCurrentPriceTick(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05);
  if (currentTick !== false) {
    console.log(`Current tick is ${currentTick}\n`);
    console.log(`Getting the nearest "MATIC/USDC feeTier 0.05" tick range from tick ${currentTick}`);
    let result = await lib.GetNearestTickRangeFromTick(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, currentTick);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(currentTick);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
