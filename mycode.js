const { Init, Networks } = require("./lib");
require("dotenv").config();

// Run it like this:
// cd /t/uniswap && nohup node mycode.js >mycode.log 2>&1 &

async function main() {
  const lib = Init(
    process.env.WALLET_ADDRESS,
    process.env.PRIVATE_KEY,
    Networks[process.env.NETWORK],
    process.env.RPC_URL,
    true // debug on
  );

  const nativeTokenSymbol = 'MATIC';
  const wideningMultiplier = 1; // this must be 0 or higher!
  const checkFrequency = 60; // every 60 seconds
  const delayAfterClosePool = 90; // 90 seconds
  const delayAfterCreatePool = 60; // 60 seconds
  const delayAfterAddLiquidity = 45; // 45 seconds

  function wait(seconds){
    return new Promise(resolve => {
        setTimeout(resolve, 1000 * seconds);
    });
  }

  console.log("UnwrapAll");
  let result = await lib.UnwrapAll();
  console.log(`Result: ${result}\n`);

  let nfts = false;

  function findAPoolToClose() {
    let poolToClose = false;
    nfts.some(function(p) {
      console.log(`Checking pool id: ${p.id} (${p.isActivePosition} ${p.isInRange})`);
      if (p.isActivePosition && !p.isInRange) {
        poolToClose = p;
        return true;
      }
    });
    return poolToClose;
  }

  function findExistingPool(token0, token1, feeTier, tickLower, tickUpper) {
    let existingPoolId = false;
    // console.log(`Looking for pool with ${token0}/${token1} feeTier: ${feeTier}%, range: ${tickLower} -- ${tickUpper}`);
    nfts.forEach(function(p) {
      // console.log(`Checking pool id ${p.id}: ${p.token0}/${p.token1} feeTier: ${p.feeTier}%, range:  ${p.minTick} -- ${p.maxTick}`);
      if (p.token0 === token0 && p.token1 === token1 && p.feeTier === feeTier && p.minTick === tickLower && p.maxTick === tickUpper) {
        existingPoolId = p.id;
        return true;
      }
    });
    return existingPoolId;
  }

  async function mainStrategy() {
    console.log("Getting the list of pool positions we have\n");
    nfts = await lib.GetNFTList(false);
    if (nfts === false || nfts.length == 0) {
      console.log("There are no pool positions. Nothing to do.\n")
      return 0;
    }

    const pool = findAPoolToClose(nfts);
    if (pool === false) {
      console.log("There are no active pool positions that are out of range. Nothing to do.\n")
      return 0;
    }

    console.log(`Closing pool id ${pool.id} :`);
    console.log(pool);

    const token0 = pool.token0;
    const token1 = pool.token1;

    nftsNeedUpdate = true; // If we reached this point here then the nfts list need to be updated before we the next periodic check

    let status = await lib.ClosePoolPosition(pool.id);
    if (status === false) return 2;

    console.log(`Waiting for ${delayAfterClosePool} seconds`);
    await wait(delayAfterClosePool);
    console.log("Waiting is over!");

    console.log(`Pool id ${pool.id} should be closed now\n`);

    const origAmount0 = await lib.GetAmount(lib.Tokens[token0]);
    if (origAmount0 === false) return 3;
    let amount0 = origAmount0.value;
    if (token0 === nativeTokenSymbol) amount0 = amount0 < 3 ? 0 : amount0 - 3;

    const origAmount1 = await lib.GetAmount(lib.Tokens[token1]);
    if (origAmount0 === false) return 4;
    let amount1 = origAmount1.value;
    if (token1 === nativeTokenSymbol) amount1 = amount1 < 3 ? 0 : amount1 - 3;

    console.log(`${token0} amount: ${amount0}`);
    console.log(`${token1} amount: ${amount1}\n`);

    console.log(`Getting pool data for the ${token0}/${token1} feeTier: 0.05 pool`);
    let result = await lib.GetPoolData(lib.Tokens[token0], lib.Tokens[token1], 0.05);
    if (result === false) return 5;
    const spacing = result.spacing;
    console.log(`Pool spacing: ${spacing}\n`);

    console.log(`Getting the current price of ${token0} in ${token1}`);
    const price = await lib.GetCurrentPrice(lib.Tokens[token0], lib.Tokens[token1]);
    if (price === false) return 6;
    console.log(`1 ${token0} is ${price} ${token1}\n`);

    console.log(`Getting the nearest "${token0}/${token1} feeTier 0.05" tick range from price ${price}`);
    result = await lib.GetNearestTickRangeFromPrice(lib.Tokens[token0], lib.Tokens[token1], 0.05, price);
    if (result === false) return 7;
    console.log(`The minimum tick range is: ${result[0]} to ${result[1]}`);
    // Widening the smallest possible range:
    const tickLower = result[0] - (spacing * wideningMultiplier);
    const tickUpper = result[1] + (spacing * wideningMultiplier);
    console.log(`My target tick range is: ${tickLower} to ${tickUpper}\n`);

    console.log("Before:\n");
    console.log(`Balance: ${origAmount0.value} ${token0}`);
    console.log(`Balance: ${origAmount1.value} ${token1}\n`);

    existingPoolId = findExistingPool(pool.token0, pool.token1, 0.05, tickLower, tickUpper);
    console.log(`Existing pool id: ${existingPoolId}`);
    if (existingPoolId === false) { // no existing pool found, must mint a new pool NFT
      console.log(`Creating new pool ${token0}/${token1} feeTier: 0.05, tick range: ${tickLower} - ${tickUpper}, ${token0} amount: ${amount0}, ${token1} amount: ${amount1}`);
      result = await lib.CreatePoolPositionTicks(
        lib.Tokens[token0],
        lib.Tokens[token1],
        0.05,
        tickLower,
        tickUpper,
        amount0,
        amount1
      );
      console.log(`Pool id: ${result}\n`);
      if (typeof result === 'number') {
        console.log(`Waiting for ${delayAfterCreatePool} seconds`);
        await wait(delayAfterCreatePool);
        console.log("Waiting is over!");
      }
    } else {
      console.log(`Adding Liquidity to existing pool #${existingPoolId}`);
      result = await lib.AddLiquidity(existingPoolId, amount0, amount1);
      console.log(`Result: ${result}\n`);
      if (result !== false) {
        console.log(`Waiting for ${delayAfterAddLiquidity} seconds`);
        await wait(delayAfterAddLiquidity);
        console.log("Waiting is over!");
      }
    }

    console.log(`After (we should have ${amount0} ${token0} less and ${amount1} ${token1} less in the wallet) :\n`);
    let balance = await lib.GetAmount(lib.Tokens[token0]);
    if (balance !== false) {
      console.log(`Balance: ${balance.value} ${token0}`);
    }
    balance = await lib.GetAmount(lib.Tokens[token1]);
    if (balance !== false) {
      console.log(`Balance: ${balance.value} ${token1}\n`);
    }

    return 0;
  }

  var loop = async function() {
    do {
      console.log("Periodic check started\n");
      let code = await mainStrategy();
      console.log(`Periodic check finished with exit code: ${code}\n`);
      console.log(`Sleeping for ${checkFrequency} seconds ...`);
      await wait(checkFrequency);
      console.log("Sleeping is over!\n");
    } while(true);
  }
  loop();

  return 0;
}

main();
// main().then((code) => {
//   process.exit(code);
// });
