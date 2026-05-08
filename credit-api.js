/**
 * TradeProof Credit and Lending API
 * Connects TradeProof Score to credit decision engines
 * Banks and lenders use this to evaluate African SMEs
 */

const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const ARC_RPC = "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const ABI = [
  "function getCreditProfile(address account) external view returns (uint256 score, uint256 volume)",
  "function getOrder(uint256 orderId) external view returns (tuple(uint256 id, address buyer, address supplier, uint256 amount, string itemDescription, string deliveryCondition, uint8 status, uint256 createdAt, uint256 completedAt))",
  "function orderCount() external view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(ARC_RPC);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Credit scoring model
function calculateCreditScore(tradeScore, volumeUSDC, orderHistory) {
  const completedOrders = orderHistory.filter(o => Number(o.status) === 3).length;
  const disputedOrders = orderHistory.filter(o => Number(o.status) === 4).length;
  const onTimeRate = completedOrders > 0
    ? ((completedOrders - disputedOrders) / completedOrders * 100).toFixed(1)
    : 0;

  const level = tradeScore >= 50 ? "GOLD"
    : tradeScore >= 20 ? "SILVER"
    : tradeScore >= 5 ? "BRONZE"
    : "NEW";

  // Max credit limit based on score and volume
  const maxCreditMultiplier = { GOLD: 3, SILVER: 2, BRONZE: 1.5, NEW: 0.5 };
  const maxCreditLimit = parseFloat(volumeUSDC) * maxCreditMultiplier[level];

  // Interest rate based on level
  const interestRate = { GOLD: 8, SILVER: 12, BRONZE: 18, NEW: 24 };

  // Risk rating
  const riskRating = tradeScore >= 50 ? "LOW"
    : tradeScore >= 20 ? "MEDIUM-LOW"
    : tradeScore >= 5 ? "MEDIUM"
    : "HIGH";

  return {
    level,
    riskRating,
    onTimePaymentRate: onTimeRate + "%",
    maxCreditLimit: maxCreditLimit.toFixed(2) + " USDC",
    suggestedInterestRate: interestRate[level] + "% APR",
    recommendation: tradeScore >= 5 ? "APPROVE" : "REVIEW",
  };
}

// ==========================================
// ENDPOINTS
// ==========================================

// Health
app.get("/", (req, res) => {
  res.json({
    name: "TradeProof Credit API",
    version: "1.0.0",
    description: "Onchain credit scoring for African SMEs via TradeProof Protocol on Arc",
    contract: CONTRACT_ADDRESS,
    network: "Arc Testnet",
    built_by: "Mimisco Technologies",
    endpoints: {
      credit_report: "GET /credit/:address",
      lending_decision: "GET /lending/:address",
      portfolio: "GET /portfolio",
      order_history: "GET /orders/:address"
    }
  });
});

// Full credit report
app.get("/credit/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const [score, volume] = await contract.getCreditProfile(addr);
    const tradeScore = Number(score);
    const volumeUSDC = ethers.formatUnits(volume, 6);

    // Get order history for this address
    const count = await contract.orderCount();
    const orderHistory = [];
    for (let i = 1; i <= Number(count); i++) {
      const o = await contract.getOrder(i);
      if (o[1].toLowerCase() === addr.toLowerCase() ||
          o[2].toLowerCase() === addr.toLowerCase()) {
        orderHistory.push(o);
      }
    }

    const creditScore = calculateCreditScore(tradeScore, volumeUSDC, orderHistory);

    res.json({
      success: true,
      address: addr,
      tradeProofScore: tradeScore,
      totalVolumeSettled: volumeUSDC + " USDC",
      completedOrders: orderHistory.filter(o => Number(o[6]) === 3).length,
      totalOrders: orderHistory.length,
      creditAssessment: creditScore,
      dataSource: "Arc Testnet // TradeProof Protocol",
      verifiedAt: new Date().toISOString(),
      explorerLink: `https://testnet.arcscan.app/address/${addr}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Lending decision endpoint for banks
app.get("/lending/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const requestedAmount = parseFloat(req.query.amount || "1000");
    const [score, volume] = await contract.getCreditProfile(addr);
    const tradeScore = Number(score);
    const volumeUSDC = parseFloat(ethers.formatUnits(volume, 6));
    const level = tradeScore >= 50 ? "GOLD" : tradeScore >= 20 ? "SILVER" : tradeScore >= 5 ? "BRONZE" : "NEW";
    const maxMultiplier = { GOLD: 3, SILVER: 2, BRONZE: 1.5, NEW: 0.5 };
    const maxCredit = volumeUSDC * maxMultiplier[level];
    const approved = tradeScore >= 5 && requestedAmount <= maxCredit;

    res.json({
      success: true,
      address: addr,
      requestedAmount: requestedAmount + " USDC",
      decision: approved ? "APPROVED" : tradeScore < 5 ? "INSUFFICIENT_HISTORY" : "EXCEEDS_LIMIT",
      maxCreditAvailable: maxCredit.toFixed(2) + " USDC",
      tradeProofScore: tradeScore,
      creditLevel: level,
      interestRate: { GOLD: "8%", SILVER: "12%", BRONZE: "18%", NEW: "24%" }[level] + " APR",
      collateral: "TradeProof Score // Arc Testnet",
      validFor: "30 days",
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Portfolio overview
app.get("/portfolio", async (req, res) => {
  try {
    const count = await contract.orderCount();
    let totalVolume = 0n;
    let completed = 0;
    let disputed = 0;
    const uniqueAddresses = new Set();

    for (let i = 1; i <= Number(count); i++) {
      const o = await contract.getOrder(i);
      uniqueAddresses.add(o[1]);
      uniqueAddresses.add(o[2]);
      if (Number(o[6]) === 3) { completed++; totalVolume += o[3]; }
      if (Number(o[6]) === 4) disputed++;
    }

    res.json({
      success: true,
      protocol: "TradeProof",
      network: "Arc Testnet",
      totalOrders: Number(count),
      completedOrders: completed,
      disputedOrders: disputed,
      totalVolumeSettled: ethers.formatUnits(totalVolume, 6) + " USDC",
      uniqueParticipants: uniqueAddresses.size,
      settlementRate: Number(count) > 0
        ? ((completed / Number(count)) * 100).toFixed(1) + "%"
        : "0%",
      contract: CONTRACT_ADDRESS,
      explorer: `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Order history for an address
app.get("/orders/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const count = await contract.orderCount();
    const STATUS = ["Created","Funded","Delivered","Completed","Disputed","Cancelled"];
    const orders = [];

    for (let i = 1; i <= Number(count); i++) {
      const o = await contract.getOrder(i);
      if (o[1].toLowerCase() === addr.toLowerCase() ||
          o[2].toLowerCase() === addr.toLowerCase()) {
        orders.push({
          id: o[0].toString(),
          role: o[1].toLowerCase() === addr.toLowerCase() ? "BUYER" : "SUPPLIER",
          counterparty: o[1].toLowerCase() === addr.toLowerCase()
            ? o[2] : o[1],
          amount: ethers.formatUnits(o[3], 6) + " USDC",
          itemDescription: o[4],
          status: STATUS[Number(o[6])],
          createdAt: new Date(Number(o[7]) * 1000).toISOString(),
          completedAt: Number(o[8]) > 0
            ? new Date(Number(o[8]) * 1000).toISOString() : null
        });
      }
    }

    res.json({ success: true, address: addr, totalOrders: orders.length, orders });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("==========================================");
  console.log("TradeProof Credit API running on port", PORT);
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("==========================================");
});
