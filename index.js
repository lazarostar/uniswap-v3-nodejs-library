const Init = require("./lib");

async function main() {
  const lib = Init(
    // "0x4FE8ebd19A0b09fc6efCAB98B17178Bb431B161C",
    // "0xadbf1854e5883eb8aa7baf50705338739e558e5b",
    "0x4271c0c1B7278B9Dfb2a58D72eA17145e5244518",
    "PRIVATE_KEY",
    // "https://goerli.infura.io/v3/3725b022557644ad8fa5e22472082ed4"
    // "https://eth-goerli.g.alchemy.com/v2/8QxaT6rGRC69n9TMgXUle3R60ss3tCPR"
    "https://polygon-mainnet.g.alchemy.com/v2/tT46QuCo-vZYOZ-bgpMMW2q7-iMz-Sm7"
  );
  const balance = await lib.GetAmount("MATIC");
  console.log(balance);
}

main();
