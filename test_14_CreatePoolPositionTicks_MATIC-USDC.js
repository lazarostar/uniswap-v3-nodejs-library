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

  console.log("Getting pool data for the MATIC/USDC feeTier: 0.05 pool");
  let result = await lib.GetPoolData(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05)
  if (result == false) return 1;
  const spacing = result.spacing;

  console.log("Getting the current price of MATIC in USDC");
  const price = await lib.GetCurrentPrice(lib.Tokens.MATIC, lib.Tokens.USDC);
  if (price === false) return 2;
  console.log(`1 MATIC is ${price} USDC\n`);

  console.log(`Getting the nearest "MATIC/USDC feeTier 0.05" tick range from price ${price}`);
  result = await lib.GetNearestTickRangeFromPrice(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, price);
  if (result === false) return 3;
  console.log(`The tick range is: ${result[0]} to ${result[1]}\n`);
  const tickLower = result[0] - spacing;
  const tickUpper = result[1] + spacing;
  console.log(`My target tick range is: ${tickLower} to ${tickUpper}\n`);

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens.MATIC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC`);
  }
  balance = await lib.GetAmount(lib.Tokens.USDC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} USDC\n`);
  }

  console.log(`Creating new pool MATIC/USDC feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, MATIC amount: 1, USDC amount: ${balance.value}`);
  result = await lib.CreatePoolPositionTicks(
    lib.Tokens.MATIC,
    lib.Tokens.USDC,
    0.05,
    tickLower,
    tickUpper,
    1,
    balance.bignum
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 1 MATIC less and 0 USDC in the wallet) :\n");
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} MATIC`);
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
