// Fixed deploy script with correct Arc USDC address
const { ethers } = require("hardhat");

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  console.log("Deploying TradeProof to Arc Testnet...");
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with wallet:", deployer.address);

  const TradeProof = await ethers.getContractFactory("TradeProof");
  const tradeproof = await TradeProof.deploy(ARC_TESTNET_USDC);
  await tradeproof.waitForDeployment();

  const address = await tradeproof.getAddress();
  console.log("==========================================");
  console.log("TradeProof deployed to:", address);
  console.log("USDC address used:", ARC_TESTNET_USDC);
  console.log("==========================================");
  console.log(`https://testnet.arcscan.app/address/${address}`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
