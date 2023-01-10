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

  console.log(`Getting the current price of WETH in USDC`)
  price = await lib.GetCurrentPrice(lib.Tokens.WETH, lib.Tokens.USDC);
  console.log(`1 WETH is ${price} USDC\n`);

  console.log(`Getting the nearest "WETH/USDC feeTier 0.05" tick range from price ${price}`)
  var result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, price);
  if (result !== false) {
    console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  } else {
    console.log(`Result: ${result}\n`);
    process.exit(1);
  }
  const tickLower = result[0];
  const tickUpper = result[1];

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool WETH/USDC feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, WETH amount: 0.001, USDC amount: 1`)
  var result = await lib.CreatePoolPositionTicks(
    lib.Tokens.WETH,
    lib.Tokens.USDC,
    0.05,
    tickLower,
    tickUpper,
    0.001,
    1
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 0.001 WETH less and 1 USDC less in the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
