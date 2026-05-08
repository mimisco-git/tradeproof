/**
 * TradeProof Autonomous Procurement Agent
 * Mimisco Technologies
 */

const { ethers } = require("ethers");
require("dotenv").config();

const ARC_RPC = "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const POLL_INTERVAL = 15000;

const ABI = [
  "function orderCount() external view returns (uint256)",
  "function getOrder(uint256 orderId) external view returns (tuple(uint256 id, address buyer, address supplier, uint256 amount, string itemDescription, string deliveryCondition, uint8 status, uint256 createdAt, uint256 completedAt))",
  "function confirmDelivery(uint256 orderId) external",
  "function getCreditProfile(address account) external view returns (uint256 score, uint256 volume)"
];

const STATUS = ["Created","Funded","Delivered","Completed","Disputed","Cancelled"];

const AGENT_RULES = {
  autoConfirmAfterSeconds: 0,
  autoConfirmKeywords: ["GPS confirmed", "auto-release", "test"],
  maxAutoConfirmUSDC: 50,
};

function log(msg, type = "INFO") {
  const time = new Date().toISOString();
  const colors = { INFO:"\x1b[36m", SUCCESS:"\x1b[32m", WARN:"\x1b[33m", ERROR:"\x1b[31m", AGENT:"\x1b[35m" };
  console.log(`${colors[type]}[${type}]\x1b[0m ${time} - ${msg}`);
}

class TradeProofAgent {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(ARC_RPC);
    this.signer = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, this.signer);
    this.agentAddress = this.signer.address;
    this.knownOrders = new Map();
    this.cycleCount = 0;
  }

  async start() {
    log("TradeProof Procurement Agent starting...", "AGENT");
    log(`Agent wallet: ${this.agentAddress}`, "AGENT");
    log(`Contract: ${CONTRACT_ADDRESS}`, "AGENT");
    log(`Network: Arc Testnet (Chain ID: 5042002)`, "AGENT");
    log(`Polling every ${POLL_INTERVAL/1000}s`, "AGENT");
    console.log("==========================================");
    await this.poll();
    setInterval(() => this.poll(), POLL_INTERVAL);
  }

  async poll() {
    this.cycleCount++;
    log(`Cycle #${this.cycleCount} - Scanning Arc Testnet...`, "INFO");
    try {
      const count = await this.contract.orderCount();
      const total = Number(count);
      log(`Total orders on Arc: ${total}`, "INFO");
      for (let i = 1; i <= total; i++) await this.processOrder(i);
      if (total === 0) log("No orders yet. Waiting for new Smart POs...", "INFO");
    } catch (err) {
      log(`Poll error: ${err.message}`, "ERROR");
    }
  }

  async processOrder(orderId) {
    try {
      const order = await this.contract.getOrder(orderId);
      const status = STATUS[Number(order.status)];
      const amount = ethers.formatUnits(order.amount, 6);
      const isBuyer = order.buyer.toLowerCase() === this.agentAddress.toLowerCase();
      const prevStatus = this.knownOrders.get(orderId);

      if (prevStatus !== status) {
        log(`Order #${orderId}: ${prevStatus ? prevStatus+" -> "+status : status} | $${amount} USDC | ${order.itemDescription.slice(0,40)}`, "SUCCESS");
        this.knownOrders.set(orderId, status);
      }

      if (status === "Funded" && isBuyer) await this.evaluateAutoConfirm(order);
    } catch (err) {
      log(`Error on order ${orderId}: ${err.message}`, "ERROR");
    }
  }

  async evaluateAutoConfirm(order) {
    const orderId = Number(order.id);
    const amount = parseFloat(ethers.formatUnits(order.amount, 6));
    const ageSeconds = Math.floor(Date.now()/1000) - Number(order.createdAt);
    log(`Evaluating Order #${orderId} for auto-confirm...`, "AGENT");

    if (amount > AGENT_RULES.maxAutoConfirmUSDC) {
      log(`Order #${orderId}: $${amount} exceeds limit. Human review required.`, "WARN");
      return;
    }

    const keywordMatch = AGENT_RULES.autoConfirmKeywords.some(kw =>
      order.deliveryCondition.toLowerCase().includes(kw.toLowerCase())
    );

    if (keywordMatch) {
      log(`Order #${orderId}: Keyword matched. Auto-confirming payment...`, "AGENT");
      await this.executeConfirm(orderId);
      return;
    }

    if (AGENT_RULES.autoConfirmAfterSeconds > 0 && ageSeconds >= AGENT_RULES.autoConfirmAfterSeconds) {
      log(`Order #${orderId}: Time threshold reached. Auto-confirming...`, "AGENT");
      await this.executeConfirm(orderId);
      return;
    }

    log(`Order #${orderId}: Awaiting manual confirmation.`, "INFO");
  }

  async executeConfirm(orderId) {
    try {
      const tx = await this.contract.confirmDelivery(orderId);
      log(`TX submitted: ${tx.hash}`, "AGENT");
      const receipt = await tx.wait();
      log(`Payment released for Order #${orderId}. TX: ${receipt.hash}`, "SUCCESS");
      log(`https://testnet.arcscan.app/tx/${receipt.hash}`, "SUCCESS");
    } catch (err) {
      log(`Failed to confirm Order #${orderId}: ${err.message}`, "ERROR");
    }
  }
}

const agent = new TradeProofAgent();
agent.start().catch(err => { log(`Fatal: ${err.message}`, "ERROR"); process.exit(1); });
