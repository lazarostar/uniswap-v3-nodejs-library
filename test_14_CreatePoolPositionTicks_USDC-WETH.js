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

  // 14. Test CreatePoolPositionTicks function

  console.log("Getting the current price of USDC in WETH");
  const price = await lib.GetCurrentPrice(lib.Tokens.USDC, lib.Tokens.WETH);
  if (price === false) return 1;
  console.log(`1 USDC is ${price} WETH\n`);

  console.log(`Getting the nearest "USDC/WETH feeTier 0.05" tick range from price ${price}`);
  let result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.USDC, lib.Tokens.WETH, 0.05, price);
  if (result === false) return 2;
  const tickLower = result[0];
  const tickUpper = result[1];
  console.log(`The tick range is: ${tickLower} to ${tickUpper}\n`);

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC`);
  }
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH\n`);
  }

  console.log(`Creating new pool USDC/WETH feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, USDC amount: 1, WETH amount: 0.001`);
  result = await lib.CreatePoolPositionTicks(
    lib.Tokens.USDC,
    lib.Tokens.WETH,
    0.05,
    tickLower,
    tickUpper,
    1,
    0.001
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 1 USDC less and 0.001 WETH lessin the wallet) :\n");
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
