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

  // 8. Test GetUnclaimedFeeAmounts function

  const result = await lib.GetUnclaimedFeeAmounts(623961);
  console.log(result);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
