const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );

  // 4. Test CreatePoolPosition function

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool MATIC/USDC feeTier: 0.05, price range: 0.70 - 0.90, MATIC amount: 1, USDC amount: 1`)
  var result = await lib.CreatePoolPosition(
    lib.Tokens.MATIC,
    lib.Tokens.USDC,
    0.05,
    0.70,
    0.90,
    1,
    1
  );
  console.log(`Pool id: ${result}\n`);

  console.log("After (we should have 1 MATIC less and 1 USDC less in the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
