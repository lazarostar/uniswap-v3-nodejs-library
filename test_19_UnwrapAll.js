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

  // 19. Test UnwrapAll function

  console.log(`UnwrapAll`);
  const result = await lib.UnwrapAll();
  console.log(`Result: ${result}\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
