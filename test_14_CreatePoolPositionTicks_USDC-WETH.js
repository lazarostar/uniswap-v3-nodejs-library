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

  console.log(`Getting the current price of USDC in WETH`)
  price = await lib.GetCurrentPrice(lib.Tokens.USDC, lib.Tokens.WETH);
  console.log(`1 USDC is ${price} WETH\n`);

  console.log(`Getting the nearest "USDC/WETH feeTier 0.05" tick range from price ${price}`)
  var result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.USDC, lib.Tokens.WETH, 0.05, price);
  if (result !== false) {
    console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  } else {
    console.log(`Result: ${result}\n`);
    process.exit(1);
  }
  const tickLower = result[0];
  const tickUpper = result[1];

  console.log(`Before:\n`)
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  var balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  console.log(`Creating new pool USDC/WETH feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, USDC amount: 1, WETH amount: 0.001`)
  var result = await lib.CreatePoolPositionTicks(
    lib.Tokens.USDC,
    lib.Tokens.WETH,
    0.05,
    tickLower,
    tickUpper,
    1,
    0.001
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 1 USDC less and 0.001 WETH lessin the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  var balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
