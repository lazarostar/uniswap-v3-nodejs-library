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

  console.log("Getting the current price of WETH in USDC");
  const price = await lib.GetCurrentPrice(lib.Tokens.WETH, lib.Tokens.USDC);
  if (price === false) return 1;
  console.log(`1 WETH is ${price} USDC\n`);

  console.log(`Getting the nearest "WETH/USDC feeTier 0.05" tick range from price ${price}`);
  let result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, price);
  if (price === false) return 2;
  const tickLower = result[0];
  const tickUpper = result[1];
  console.log(`The tick range is: ${tickLower} to ${tickUpper}\n`);

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH`);
  }
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC\n`);
  }

  console.log(`Creating new pool WETH/USDC feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, WETH amount: 0.001, USDC amount: 1`);
  result = await lib.CreatePoolPositionTicks(
    lib.Tokens.WETH,
    lib.Tokens.USDC,
    0.05,
    tickLower,
    tickUpper,
    0.001,
    1
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 0.001 WETH less and 1 USDC less in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.WETH);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} WETH`);
  }
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC\n`);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
