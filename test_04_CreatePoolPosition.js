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
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool WETH/USDC feeTier: 0.05, price range: 1215 - 1225, WETH amount: 0.001, USDC amount: 1`)
  var result = await lib.CreatePoolPosition(
    lib.Tokens.WETH,
    lib.Tokens.USDC,
    0.05,
    1260,
    1300,
    0.001,
    1
  );
  console.log(`Pool id: ${result}\n`);

  console.log("\nAfter (we should have 0.001 less WETH and 1 less USDC in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  // ---

  console.log(`Before:\n`)
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  console.log(`Creating new pool USDC/WETH feeTier: 0.05, price range: 0.00081633 - 0.00082645, USDC amount: 1, WETH amount: 0.001`)
  var result = await lib.CreatePoolPosition(
    lib.Tokens.USDC,
    lib.Tokens.WETH,
    0.05,
    0.00081633,
    0.00082645,
    1,
    0.001
  );
  console.log(`Pool id: ${result}\n`);

  console.log("\nAfter (we should have 1 less USDC and 0.001 less WETH in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.WETH);
  console.log(`Balance: ${balance} WETH\n`);

  // ---

  console.log(`Before:\n`)
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  console.log(`Creating new pool MATIC/USDC feeTier: 0.05, price range: 0.75 - 0.85, MATIC amount: 2, USDC amount: 1`)
  var result = await lib.CreatePoolPosition(
    lib.Tokens.MATIC,
    lib.Tokens.USDC,
    0.05,
    0.75,
    0.80,
    2,
    1
  );
  console.log(`Pool id: ${result}\n`);

  console.log("\nAfter (we should have 2 less MATIC and 1 less USDC in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC`);
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC\n`);

  // ---

  console.log(`Before:\n`)
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  console.log(`Creating new pool USDC/MATIC feeTier: 0.05, price range: 1.1765 - 1.3334, USDC amount: 1, MATIC amount: 2`)
  var result = await lib.CreatePoolPosition(
    lib.Tokens.USDC,
    lib.Tokens.MATIC,
    0.05,
    1.1765,
    1.3334,
    1,
    2
  );
  console.log(`Pool id: ${result}\n`);

  console.log("\nAfter (we should have 1 less USDC and 2 less MATIC in the wallet):\n")
  balance = await lib.GetAmount(lib.Tokens.USDC);
  console.log(`Balance: ${balance} USDC`);
  balance = await lib.GetAmount(lib.Tokens.MATIC);
  console.log(`Balance: ${balance} MATIC\n`);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
