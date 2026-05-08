const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();
app.use(express.json());

// Arc Testnet config
const ARC_RPC = "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// TradeProof ABI (only the functions we need)
const ABI = [
  "function createOrder(address supplier, uint256 amount, string calldata itemDescription, string calldata deliveryCondition) external returns (uint256)",
  "function fundOrder(uint256 orderId) external",
  "function confirmDelivery(uint256 orderId) external",
  "function raiseDispute(uint256 orderId) external",
  "function cancelOrder(uint256 orderId) external",
  "function getCreditProfile(address account) external view returns (uint256 score, uint256 volume)",
  "function getOrder(uint256 orderId) external view returns (tuple(uint256 id, address buyer, address supplier, uint256 amount, string itemDescription, string deliveryCondition, uint8 status, uint256 createdAt, uint256 completedAt))",
  "function orderCount() external view returns (uint256)",
  "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 amount, string itemDescription)",
  "event OrderCompleted(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 amount, uint256 completedAt)"
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

const USDC_ADDRESS = process.env.USDC_ADDRESS;

// Order status map
const STATUS = {
  0: "Created",
  1: "Funded",
  2: "Delivered",
  3: "Completed",
  4: "Disputed",
  5: "Cancelled"
};

// Setup provider and signer
const provider = new ethers.JsonRpcProvider(ARC_RPC);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

// Helper: format order response
function formatOrder(order) {
  return {
    id: order.id.toString(),
    buyer: order.buyer,
    supplier: order.supplier,
    amount: ethers.formatUnits(order.amount, 6) + " USDC",
    amountRaw: order.amount.toString(),
    itemDescription: order.itemDescription,
    deliveryCondition: order.deliveryCondition,
    status: STATUS[order.status] || "Unknown",
    createdAt: new Date(Number(order.createdAt) * 1000).toISOString(),
    completedAt: order.completedAt > 0
      ? new Date(Number(order.completedAt) * 1000).toISOString()
      : null
  };
}

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "TradeProof API",
    version: "1.0.0",
    description: "Agentic Procure-to-Pay Protocol for African SMEs on Arc",
    network: "Arc Testnet",
    contract: CONTRACT_ADDRESS,
    explorer: `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`,
    built_by: "Mimisco Technologies"
  });
});

// GET /orders/:id - Get a single order
app.get("/orders/:id", async (req, res) => {
  try {
    const order = await contract.getOrder(req.params.id);
    res.json({ success: true, order: formatOrder(order) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /orders - Get total order count
app.get("/orders", async (req, res) => {
  try {
    const count = await contract.orderCount();
    res.json({ success: true, totalOrders: count.toString() });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /orders/create - Create a new Purchase Order
app.post("/orders/create", async (req, res) => {
  try {
    const { supplier, amount, itemDescription, deliveryCondition } = req.body;

    if (!supplier || !amount || !itemDescription || !deliveryCondition) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: supplier, amount, itemDescription, deliveryCondition"
      });
    }

    // Convert USDC amount to 6 decimals
    const amountInUnits = ethers.parseUnits(amount.toString(), 6);

    const tx = await contract.createOrder(
      supplier,
      amountInUnits,
      itemDescription,
      deliveryCondition
    );

    const receipt = await tx.wait();

    res.json({
      success: true,
      message: "Purchase Order created on Arc",
      txHash: receipt.hash,
      explorer: `https://testnet.arcscan.app/tx/${receipt.hash}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /orders/:id/fund - Fund a Purchase Order (locks USDC in escrow)
app.post("/orders/:id/fund", async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await contract.getOrder(orderId);

    // Approve USDC spend first
    const approveTx = await usdc.approve(CONTRACT_ADDRESS, order.amount);
    await approveTx.wait();

    // Fund the order
    const tx = await contract.fundOrder(orderId);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: `Order #${orderId} funded. ${ethers.formatUnits(order.amount, 6)} USDC locked in escrow on Arc.`,
      txHash: receipt.hash,
      explorer: `https://testnet.arcscan.app/tx/${receipt.hash}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /orders/:id/confirm - Confirm delivery and release USDC to supplier
app.post("/orders/:id/confirm", async (req, res) => {
  try {
    const orderId = req.params.id;
    const tx = await contract.confirmDelivery(orderId);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: `Delivery confirmed. USDC released to supplier. TradeProof Score updated.`,
      txHash: receipt.hash,
      explorer: `https://testnet.arcscan.app/tx/${receipt.hash}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /orders/:id/dispute - Raise a dispute
app.post("/orders/:id/dispute", async (req, res) => {
  try {
    const tx = await contract.raiseDispute(req.params.id);
    const receipt = await tx.wait();

    res.json({
      success: true,
      message: "Dispute raised. Order is now under review.",
      txHash: receipt.hash,
      explorer: `https://testnet.arcscan.app/tx/${receipt.hash}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /credit/:address - Get TradeProof credit profile
app.get("/credit/:address", async (req, res) => {
  try {
    const [score, volume] = await contract.getCreditProfile(req.params.address);

    res.json({
      success: true,
      address: req.params.address,
      tradeProofScore: score.toString(),
      totalVolumeSettled: ethers.formatUnits(volume, 6) + " USDC",
      creditLevel: score >= 50 ? "Gold" : score >= 20 ? "Silver" : score >= 5 ? "Bronze" : "New",
      message: score > 0
        ? `This address has completed ${score} verified trade(s) on Arc.`
        : "No trade history yet on Arc."
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("==========================================");
  console.log("TradeProof API running on port", PORT);
  console.log("Network: Arc Testnet");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("==========================================");
});
