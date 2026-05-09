const { ethers } = require("ethers");
require("dotenv").config();

const ARC_RPC = "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const USDC_ADDRESS = process.env.USDC_ADDRESS;

const ABI = [
  "function createOrder(address supplier, uint256 amount, string calldata itemDescription, string calldata deliveryCondition) external returns (uint256)",
  "function fundOrder(uint256 orderId) external",
  "function confirmDelivery(uint256 orderId) external",
  "function orderCount() external view returns (uint256)",
  "function getCreditProfile(address account) external view returns (uint256 score, uint256 volume)"
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

function log(msg, type="INFO") {
  const colors={INFO:"\x1b[36m",SUCCESS:"\x1b[32m",WARN:"\x1b[33m",ERROR:"\x1b[31m"};
  console.log(`${colors[type]}[${type}]\x1b[0m ${new Date().toISOString()} - ${msg}`);
}

async function runDemo() {
  log("TradeProof Demo Starting...", "INFO");
  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

  const buyer = signer.address;
  const supplier = "0x000000000000000000000000000000000000dEaD";

  log(`Buyer: ${buyer}`, "INFO");
  log(`Supplier: ${supplier}`, "INFO");

  const balance = await usdc.balanceOf(buyer);
  log(`USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`, "INFO");

  log("STEP 1: Creating PO on Arc...", "INFO");
  const amount = ethers.parseUnits("1", 6);
  const createTx = await contract.createOrder(supplier, amount, "100kg Nigerian sesame seeds for export", "GPS confirmed delivery to Lagos warehouse - auto-release");
  const createReceipt = await createTx.wait();
  log(`PO Created! TX: ${createReceipt.hash}`, "SUCCESS");
  log(`https://testnet.arcscan.app/tx/${createReceipt.hash}`, "SUCCESS");

  const orderId = await contract.orderCount();
  log(`Order ID: #${orderId}`, "SUCCESS");

  log("STEP 2: Funding escrow on Arc...", "INFO");
  const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
  await approveTx.wait();
  const fundTx = await contract.fundOrder(orderId);
  const fundReceipt = await fundTx.wait();
  log(`Escrow funded! 1 USDC locked on Arc.`, "SUCCESS");
  log(`https://testnet.arcscan.app/tx/${fundReceipt.hash}`, "SUCCESS");

  log("STEP 3: Agent confirming delivery...", "INFO");
  const confirmTx = await contract.confirmDelivery(orderId);
  const confirmReceipt = await confirmTx.wait();
  log(`Payment released!`, "SUCCESS");
  log(`https://testnet.arcscan.app/tx/${confirmReceipt.hash}`, "SUCCESS");

  const [score, volume] = await contract.getCreditProfile(buyer);
  const level = Number(score)>=50?"GOLD":Number(score)>=20?"SILVER":Number(score)>=5?"BRONZE":"NEW";

  console.log("==========================================");
  log("DEMO COMPLETE.", "SUCCESS");
  log(`TradeProof Score: ${score} (${level})`, "SUCCESS");
  log(`Volume Settled: ${ethers.formatUnits(volume, 6)} USDC on Arc`, "SUCCESS");
  log(`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`, "SUCCESS");
}

runDemo().catch(err => { log(`Error: ${err.message}`, "ERROR"); process.exit(1); });
