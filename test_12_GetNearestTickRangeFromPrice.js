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

  // 12. Test GetNearestTickRangeFromPrice function

  console.log("Getting the current price of WETH in USDC");
  let price = await lib.GetCurrentPrice(lib.Tokens.WETH, lib.Tokens.USDC);
  if (price !== false) {
    console.log(`1 WETH is ${price} USDC\n`);
    console.log(`Getting the nearest "WETH/USDC feeTier 0.05" tick range from price ${price}`);
    let result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, price);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(price);
  }

  // ---

  console.log("Getting the current price of USDC in WETH");
  price = await lib.GetCurrentPrice(lib.Tokens.USDC, lib.Tokens.WETH);
  if (price !== false) {
    console.log(`1 USDC is ${price} WETH\n`);
    console.log(`Getting the nearest "USDC/WETH feeTier 0.05" tick range from price ${price}`);
    let result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.USDC, lib.Tokens.WETH, 0.05, price);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(price);
  }

  // ---

  console.log("Getting the current price of MATIC in USDC");
  price = await lib.GetCurrentPrice(lib.Tokens.MATIC, lib.Tokens.USDC);
  if (price !== false) {
    console.log(`1 MATIC is ${price} USDC\n`);
    console.log(`Getting the nearest "MATIC/USDC feeTier 0.05" tick range from price ${price}`);
    let result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, price);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(price);
  }

  // ---

  console.log("Getting the current price of USDC in MATIC");
  price = await lib.GetCurrentPrice(lib.Tokens.USDC, lib.Tokens.MATIC);
  if (price !== false) {
    console.log(`1 USDC is ${price} MATIC\n`);
    console.log(`Getting the nearest "USDC/MATIC feeTier 0.05" tick range from price ${price}`);
    let result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.USDC, lib.Tokens.MATIC, 0.05, price);
    if (result !== false) {
      console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
    } else {
      console.log(`Result: ${result}\n`);
    }
  } else {
    console.log(price);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
