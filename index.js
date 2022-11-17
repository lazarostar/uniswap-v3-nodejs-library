const Init = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    process.env.RPC_URL
  );
  const balance = await lib.GetAmount("ETH");
  console.log(balance);
}

main();
