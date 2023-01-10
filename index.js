const { Init, Networks } = require("./lib");
require("dotenv").config();

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL,
  );
  // 1. Test GetAmount function
  // const balance = await lib.GetAmount(lib.Tokens.MATIC);
  // console.log(`Balance: ${balance} MATIC`);

  // 2. Test GetCurrentPrice function
  // const price = await lib.GetCurrentPrice(lib.Tokens.MATIC, lib.Tokens.USDC);
  // console.log(`1 MATIC is ${price} USDC`);

  // 3. Test Swap function
  // const result = await lib.Swap(lib.Tokens.MATIC, lib.Tokens.WMATIC, 0.3, true);
  // console.log(result);

  // 4. Test CreatePoolPosition function
  // const result = await lib.CreatePoolPosition(
  //   lib.Tokens.MATIC,
  //   lib.Tokens.USDC,
  //   0.05,
  //   1260,
  //   1300,
  //   0.00001,
  //   1
  // );
  // console.log(`Token id: ${result}`);

  // 5. Test ClosePoolPosition function
  // const result = await lib.ClosePoolPosition(597185);
  // console.log(result);

  // 6. Test GetNFTList function
  // const result = await lib.GetNFTList(true);
  // console.log(result);
  // console.log("===========");
  // console.log(`Total: ${result.length}`);

  // 7. Test CollectUnclaimedFees function
  // const result = await lib.CollectUnclaimedFees(597185);
  // console.log(result);

  // 8. Test GetUnclaimedFeeAmounts function
  // const result = await lib.GetUnclaimedFeeAmounts(547177);
  // console.log(result);

  // 9. Test GetFeeTiers function
  // const result = await lib.GetFeeTiers(lib.Tokens.MATIC, lib.Tokens.USDC);
  // console.log(result);

  // 10. Test GetCurrentPriceTick function
  // const currentTick = await lib.GetCurrentPriceTick(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05);
  // console.log(currentTick);

  // 11. Test CreatePoolPositionMax function
  // const result = await lib.CreatePoolPositionMax(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, 1150, 1200);
  // console.log(result);

  // 12. Test GetNearestTickRangeFromPrice function
  // const [tickLower, tickUpper] = await lib.GetNearestTickRangeFromPrice(lib.Tokens.WETH, lib.Tokens.USDC, 0.05, 1150);
  // console.log(tickLower, tickUpper);

  // 13. Test GetNearestTickRangeFromTick function
  // const [tickLower, tickUpper] = await lib.GetNearestTickRangeFromTick(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, currentTick);
  // console.log(tickLower, tickUpper);

  // 14. Test CreatePoolPositionTicks function
  // const result = await lib.CreatePoolPositionTicks(lib.Tokens.MATIC, lib.Tokens.USDC, 0.05, tickLower, tickUpper, 0.1, 0.5)
  // console.log(result)

  // 15. Test AddLiquidity function
  // const result = await lib.AddLiquidity(592088, 1, 0.00001)
  // console.log(result)

  // 16. Test GetPoolPositionInfo function
  // const result = await lib.GetPoolPositionInfo(592088)
  // console.log(result)

  // 17. Test SwapAll function
  // const result = await lib.SwapAll(lib.Tokens.USDC, lib.Tokens.MATIC)
  // console.log(result)

  // 18. Test GetPoolData() function
  // const result = await lib.GetPoolData(lib.Tokens.USDC, lib.Tokens.WBTC, 0.05)
  // console.log(result)

  // 19. Test UnwrapAll function
  // const result = await lib.UnwrapAll()
  // console.log(result)

  return 0;
}

main().then((code) => {
  process.exit(code);
});
