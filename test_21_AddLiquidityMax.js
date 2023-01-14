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

  // 21. Test AddLiquidityMax function

  const poolID = 627257;

  const pool = await lib.GetPoolPositionInfo(poolID)
  console.log(pool, `\n`);

  console.log("Before:\n");
  let balance = await lib.GetAmount(lib.Tokens[pool.token0]);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} ${pool.token0}`);
  }
  balance = await lib.GetAmount(lib.Tokens[pool.token1]);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} ${pool.token1}\n`);
  }

  console.log(`Adding Liquidity to pool #${poolID}`);
  let result = await lib.AddLiquidityMax(poolID)
  console.log(`Result: ${result}\n`);

  console.log(`After (we should have 0 ${pool.token0} and 0 ${pool.token1} in the wallet because we just added all those to the existing pool) :\n`);
  balance = await lib.GetAmount(lib.Tokens[pool.token0]);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} ${pool.token0}`);
  }
  balance = await lib.GetAmount(lib.Tokens[pool.token1]);
  if (balance !== false) {
    console.log(`Balance: ${balance.value} ${pool.token1}\n`);
  }

  return 0;
}

main().then((code) => {
  process.exit(code);
});
