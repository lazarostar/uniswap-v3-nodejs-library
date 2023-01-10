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

  // 3. Test Swap function

  console.log(`Before:\n`)
  var balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  console.log(`Swapping "0.001 WETH worth of MATIC" to WETH`)
  var result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.WETH, 0.001, true);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have less MATIC and 0.001 WETH more in the wallet): \n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  // ---

  console.log(`Swapping 2 MATIC to WETH`)
  result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.WETH, 2, false);
  console.log(`Result: ${result}\n`);

  console.log("After (we should have 2 MATIC less and more WETH in the wallet) :\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
