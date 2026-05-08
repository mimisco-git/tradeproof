const { ethers } = require("hardhat");

const ARC_TESTNET_USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

async function main() {
  console.log("Deploying TradeProof to Arc Testnet...");
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with wallet:", deployer.address);

  const TradeProof = await ethers.getContractFactory("TradeProof");
  const tradeproof = await TradeProof.deploy(ARC_TESTNET_USDC);
  await tradeproof.waitForDeployment();

  const address = await tradeproof.getAddress();
  console.log("TradeProof deployed to:", address);
  console.log(`https://testnet.arcscan.app/address/${address}`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
