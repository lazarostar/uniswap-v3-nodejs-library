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
  // const result = await lib.CreatePoolPosition(
  //   lib.Tokens.WETH,
  //   lib.Tokens.USDC,
  //   0.05,
  //   1260,
  //   1300,
  //   0.00008,
  //   2.3
  // );
  // console.log(`Token id: ${result}`);

  // 5. Test ClosePoolPosition function
  // const result = await lib.ClosePoolPosition(541869);
  // console.log(result);
  // 541866, 541869

  // 6. Test GetNFTList function
  // const result = await lib.GetNFTList(true);
  // console.log(result);
  // console.log("===========");
  // console.log(`Total: ${result.length}`);

  // 7. Test CollectUnclaimedFees function
  // const result = await lib.CollectUnclaimedFees(547177);
  // console.log(result);

  // 8. Test GetUnclaimedFeeAmounts function
  // const result = await lib.GetUnclaimedFeeAmounts(547177);
  // console.log(result);

  // 9. Test GetFeeTiers function
  // const result = await lib.GetFeeTiers(lib.Tokens.USDT, lib.Tokens.USDC);
  // console.log(result);\

  // 10. Test GetCurrentPriceTick function
  const currentTick = await lib.GetCurrentPriceTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05);
  console.log(currentTick);

  // 11. Test CreatePoolPositionMax function
  // const result = await lib.CreatePoolPositionMax(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, 1150, 1200);
  // console.log(result);

  // 12. Test GetNearestTickRangeFromPrice function
  // const [tickLower, tickUpper] = await lib.GetNearestTickRangeFromPrice(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, 1150);
  // console.log(tickLower, tickUpper);

  // 13. Test GetNearestTickRangeFromTick function
  const [tickLower, tickUpper] = await lib.GetNearestTickRangeFromTick(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, currentTick);
  console.log(tickLower, tickUpper);

  // 14. Test CreatePoolPositionTicks function
  const result = await lib.CreatePoolPositionTicks(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, tickLower, tickUpper, 0.00001, 1)
  console.log(result)

  return 0;
}

main().then((code) => {
  process.exit(code);
});
