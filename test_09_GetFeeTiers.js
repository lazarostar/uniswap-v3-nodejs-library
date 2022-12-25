const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 9. Test GetFeeTiers function

  console.log('MATIC/USDC fee tiers:');
  var result = await lib.GetFeeTiers(lib.Tokens.MATIC, lib.Tokens.USDC);
  console.log(result, `\n`);

  if (lib.Tokens.hasOwnProperty('ETH')) {
    console.log('ETH/USDC fee tiers:');
    var result = await lib.GetFeeTiers(lib.Tokens.ETH, lib.Tokens.USDC);
    console.log(result, `\n`);
  }

  console.log('WBTC/USDC fee tiers:');
  var result = await lib.GetFeeTiers(lib.Tokens.WBTC, lib.Tokens.USDC);
  console.log(result, `\n`);

  console.log('WETH/USDC fee tiers:');
  var result = await lib.GetFeeTiers(lib.Tokens.WETH, lib.Tokens.USDC);
  console.log(result, `\n`);

  console.log('USDT/USDC fee tiers:');
  var result = await lib.GetFeeTiers(lib.Tokens.USDT, lib.Tokens.USDC);
  console.log(result, `\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
