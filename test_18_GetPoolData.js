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

  // 18. Test GetPoolData() function

  console.log("Getting pool data for the WETH/USDC feeTier: 0.05 pool");
  let result = await lib.GetPoolData(lib.Tokens.WETH, lib.Tokens.USDC, 0.05);
  console.log(result, "\n");

  console.log("Getting pool data for the USDC/WETH feeTier: 0.05 pool");
  result = await lib.GetPoolData(lib.Tokens.USDC, lib.Tokens.WETH, 0.05);
  console.log(result, "\n");

  // ---

  console.log("Getting pool data for the MATIC/USDC feeTier: 0.05 pool");
  result = await lib.GetPoolData(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05);
  console.log(result, "\n");

  console.log("Getting pool data for the USDC/MATIC feeTier: 0.05 pool");
  result = await lib.GetPoolData(lib.Tokens.USDC, lib.Tokens.MATIC, 0.05);
  console.log(result, "\n");

  return 0;
}

main().then((code) => {
  process.exit(code);
});
