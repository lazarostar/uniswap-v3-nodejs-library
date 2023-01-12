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

  // 7. Test CollectUnclaimedFees function

  const poolID = 621842;

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

  console.log(`Collecting unclaimed fees from pool#${poolID}`);
  let result = await lib.CollectUnclaimedFees(poolID)
  console.log("Result:");
  console.log(result, "\n");

  console.log("After:\n");
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
