const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 1. Test GetAmount function

  // MATIC:
  var price = await lib.GetCurrentPrice(lib.Tokens.MATIC, lib.Tokens.USDC);
  console.log(`1 MATIC is ${price} USDC`);

  // ETH:
  if (lib.Tokens.hasOwnProperty('ETH')) {
    price = await lib.GetCurrentPrice(lib.Tokens.ETH, lib.Tokens.USDC);
    console.log(`1 ETH is ${price} USDC`);
  }

  // USDC:
  price = await lib.GetCurrentPrice(lib.Tokens.USDC, lib.Tokens.USDT);
  console.log(`1 USDC is ${price} USDT`);

  // WBTC:
  price = await lib.GetCurrentPrice(lib.Tokens.WBTC, lib.Tokens.USDC);
  console.log(`1 WBTC is ${price} USDC`);

  // WETH:
  price = await lib.GetCurrentPrice(lib.Tokens.WETH, lib.Tokens.USDC);
  console.log(`1 WETH is ${price} USDC`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
