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

  console.log(`Getting pool data for the MATIC/USDC feeTier: 0.05 pool`)
  var result = await lib.GetPoolData(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05)
  if (result == false) {
    console.log(`Result: ${result}\n`);
    process.exit(1);
  }
  const spacing = result.spacing;

  const usdcAmount = await lib.GetAmount(lib.Tokens.USDC);

  console.log(`Getting the current price of MATIC in USDC`)
  price = await lib.GetCurrentPrice(lib.Tokens.MATIC, lib.Tokens.USDC);
  console.log(`1 MATIC is ${price} USDC\n`);

  console.log(`Getting the nearest "MATIC/USDC feeTier 0.05" tick range from price ${price}`)
  result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, price);
  if (result == false) {
    console.log(`Result: ${result}\n`);
    process.exit(1);
  }
  console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  const tickLower = result[0] - spacing;
  const tickUpper = result[1] + spacing;
  console.log(`My target tick range is: ${tickLower} to ${tickUpper}\n`);

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool MATIC/USDC feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, MATIC amount: 7, USDC amount: ${usdcAmount}`);
  var result = await lib.CreatePoolPositionTicks(
    lib.Tokens.MATIC,
    lib.Tokens.USDC,
    0.05,
    tickLower,
    tickUpper,
    7,
    usdcAmount
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 7 MATIC less and 0 USDC in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
