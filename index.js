const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL
  );
  // 1. Test GetAmount function
  // const balance = await lib.GetAmount(lib.Tokens.MATIC);
  // console.log(`Balance: ${balance} MATIC`);

  // 2. Test GetCurrentPrice function
  // const price = await lib.GetCurrentPrice(lib.Tokens.MATIC, lib.Tokens.USDC);
  // console.log(`1 MATIC is ${price} USDC`);

  // 3. Test Swap function
  // const result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.USDC, 1, true);
  // console.log(result);

  // 4. Test CreatePoolPosition function
  const result = await lib.CreatePoolPosition(
    lib.Tokens.WETH,
    lib.Tokens.USDC,
    0.3,
    0.00076929,
    32936000000000,
    1260,
    1270
  );
  console.log(`Token id: ${result}`);

  // 5. Test ClosePoolPosition function
  // const result = await lib.ClosePoolPosition(541473);
  // console.log(result);

  // 6. Test GetNFTList function
  // const result = await lib.GetNFTList(true);
  // console.log(result);
  // console.log("===========");
  // console.log(`Total: ${result.length}`);

  // 7. Test CollectUnclaimedFees function
  // const result = await lib.CollectUnclaimedFees(539151);
  // console.log(result);

  return 0;
}

main().then((code) => {
  process.exit(code);
});
