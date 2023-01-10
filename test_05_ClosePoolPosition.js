const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 5. Test ClosePoolPosition function

  const poolID = 613794;

  var result = await lib.GetUnclaimedFeeAmounts(poolID);
  console.log(result);

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  console.log(`Closing pool position`)
  result = await lib.ClosePoolPosition(poolID);
  console.log(`Result: ${result}\n`);

  console.log(`After:\n`)
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
