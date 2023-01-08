const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 6. Test GetNFTList function

  const result = await lib.GetNFTList(false);
  console.log(result);
  console.log("===========");
  console.log(`Total: ${result.length}`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
