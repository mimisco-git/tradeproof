/**
 * TradeProof Test Transaction Script
 * Creates a real Purchase Order on Arc Testnet
 * Run this to show Circle live activity on your contract
 */

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
  "function getOrder(uint256 orderId) external view returns (tuple(uint256 id, address buyer, address supplier, uint256 amount, string itemDescription, string deliveryCondition, uint8 status, uint256 createdAt, uint256 completedAt))",
  "function orderCount() external view returns (uint256)",
  "function getCreditProfile(address account) external view returns (uint256 score, uint256 volume)"
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

const STATUS = ["Created", "Funded", "Delivered", "Completed", "Disputed", "Cancelled"];

function log(msg, type = "INFO") {
  const colors = { INFO: "\x1b[36m", SUCCESS: "\x1b[32m", WARN: "\x1b[33m", ERROR: "\x1b[31m" };
  console.log(`${colors[type]}[${type}]\x1b[0m ${new Date().toISOString()} - ${msg}`);
}

async function runDemo() {
  log("TradeProof Demo Transaction Starting...", "INFO");
  log(`Contract: ${CONTRACT_ADDRESS}`, "INFO");
  log(`Network: Arc Testnet`, "INFO");
  console.log("==========================================");

  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

  const buyer = signer.address;
  // For demo we use the same wallet as supplier
  // In production buyer and supplier are different wallets
  const supplier = buyer;

  log(`Buyer/Supplier wallet: ${buyer}`, "INFO");

  // Check USDC balance
  const balance = await usdc.balanceOf(buyer);
  log(`USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`, "INFO");

  if (balance === 0n) {
    log("No USDC balance. Get testnet USDC from faucet.circle.com", "WARN");
    return;
  }

  // STEP 1: Create a Purchase Order
  log("STEP 1: Creating Smart Purchase Order on Arc...", "INFO");

  const amount = ethers.parseUnits("1", 6); // 1 USDC for demo
  const itemDesc = "Demo: 100kg Nigerian sesame seeds for export";
  const deliveryCond = "GPS confirmed delivery to Lagos warehouse - auto-release";

  const createTx = await contract.createOrder(supplier, amount, itemDesc, deliveryCond);
  log(`TX submitted: ${createTx.hash}`, "INFO");
  const createReceipt = await createTx.wait();
  log(`PO Created! TX: ${createReceipt.hash}`, "SUCCESS");
  log(`Explorer: https://testnet.arcscan.app/tx/${createReceipt.hash}`, "SUCCESS");

  // Get order ID
  const orderCount = await contract.orderCount();
  const orderId = orderCount;
  log(`Order ID: #${orderId}`, "SUCCESS");

  // STEP 2: Fund the order
  log("STEP 2: Approving USDC and funding escrow on Arc...", "INFO");

  const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
  await approveTx.wait();
  log("USDC approved.", "SUCCESS");

  const fundTx = await contract.fundOrder(orderId);
  log(`TX submitted: ${fundTx.hash}`, "INFO");
  const fundReceipt = await fundTx.wait();
  log(`Escrow funded! ${ethers.formatUnits(amount, 6)} USDC locked on Arc.`, "SUCCESS");
  log(`Explorer: https://testnet.arcscan.app/tx/${fundReceipt.hash}`, "SUCCESS");

  // STEP 3: Confirm delivery (AI agent action)
  log("STEP 3: Agent confirming delivery and releasing payment...", "INFO");

  const confirmTx = await contract.confirmDelivery(orderId);
  log(`TX submitted: ${confirmTx.hash}`, "INFO");
  const confirmReceipt = await confirmTx.wait();
  log(`Payment released! USDC sent to supplier.`, "SUCCESS");
  log(`Explorer: https://testnet.arcscan.app/tx/${confirmReceipt.hash}`, "SUCCESS");

  // Check credit profile
  const [score, volume] = await contract.getCreditProfile(buyer);
  const level = Number(score) >= 50 ? "GOLD" : Number(score) >= 20 ? "SILVER" : Number(score) >= 5 ? "BRONZE" : "NEW";

  console.log("==========================================");
  log("DEMO COMPLETE. FULL PROCURE-TO-PAY CYCLE ON ARC.", "SUCCESS");
  log(`TradeProof Score: ${score} (${level})`, "SUCCESS");
  log(`Total Volume Settled: ${ethers.formatUnits(volume, 6)} USDC`, "SUCCESS");
  log(`View contract: https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`, "SUCCESS");
  console.log("==========================================");
}

runDemo().catch(err => {
  log(`Error: ${err.message}`, "ERROR");
  process.exit(1);
});
