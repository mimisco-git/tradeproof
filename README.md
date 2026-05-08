# TradeProof

**Agentic Procure-to-Pay Protocol for African SMEs on Arc**

Built by [Mimisco Technologies](https://github.com/mimisco-git)

## What is TradeProof?

TradeProof is a programmable procurement settlement layer built natively on Arc. African SMEs create Smart Purchase Orders onchain. USDC is locked in escrow. AI agents monitor delivery conditions and release payment automatically when confirmed. Every completed settlement builds a verifiable onchain credit profile that unlocks lending from global lenders.

## How It Works

1. Buyer creates a Purchase Order with item, supplier address, USDC amount, and delivery condition.
2. Buyer funds the PO. USDC is locked in escrow on Arc.
3. Supplier delivers goods or services.
4. Buyer or AI agent confirms delivery. USDC releases instantly to supplier.
5. Both parties earn a TradeProof Score.
6. Banks and lenders query the TradeProof Score to make credit decisions.

## Circle Stack Used

| Product | Usage |
|---|---|
| Arc | Settlement layer for all PO transactions |
| USDC | Native escrow and payment currency |
| CCTP | Cross-border supplier payments |
| Circle Wallets | Embedded business wallets |
| Nanopayments | Micro-milestone payments |
| Paymaster | Gas abstraction for SMEs |
| USYC | Yield on idle escrow capital |

## Quick Start

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npm install @openzeppelin/contracts
cp .env.example .env
# Add your private key to .env
npm run compile
npm run deploy
```

## Network

- Arc Testnet, Chain ID: 5042002
- Explorer: https://testnet.arcscan.app
