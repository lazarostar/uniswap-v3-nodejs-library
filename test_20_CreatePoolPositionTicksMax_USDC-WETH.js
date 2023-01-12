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

  // 20. Test CreatePoolPositionTicksMax function

  const wideningMultiplier = 1; // this must be 0 or higher!

  console.log(`Getting pool data for the USDC/WETH feeTier: 0.05 pool`);
  let result = await lib.GetPoolData(lib.Tokens.USDC, lib.Tokens.WETH, 0.05);
  if (result === false) return 1;
  const spacing = result.spacing;
  console.log(`Pool spacing: ${spacing}\n`);

  console.log("Getting the current price of USDC in WETH");
  let price = await lib.GetCurrentPrice(lib.Tokens.USDC, lib.Tokens.WETH);
  console.log(`1 USDC is ${price} WETH\n`);
  if (price === false) return 2;

  console.log(`Getting the nearest "USDC/WETH feeTier 0.05" tick range from price ${price}`);
  result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.USDC, lib.Tokens.WETH, 0.05, price);
  if (result === false) return 3;
  console.log(`The tick range is: ${result[0]} to ${result[1]}`);
  // Widening the smallest possible range:
  const tickLower = result[0] - (spacing * wideningMultiplier);
  const tickUpper = result[1] + (spacing * wideningMultiplier);
  console.log(`My target tick range is: ${tickLower} to ${tickUpper}\n`);

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH\n`);
  }

  console.log(`Creating new pool USDC/WETH feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, adding all USDC and WETH what we have`);
  result = await lib.CreatePoolPositionTicksMax(
    lib.Tokens.USDC,
    lib.Tokens.WETH,
    0.05,
    tickLower,
    tickUpper
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 0 USDC and 0 WETH in the wallet because we just added all those to the new pool) :\n");
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
