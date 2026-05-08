# TradeProof API

REST API for the TradeProof Agentic Procure-to-Pay Protocol on Arc.

Built by Mimisco Technologies.

---

## Base URL

```
http://localhost:3000
```

---

## Endpoints

### Health Check
```
GET /
```
Returns API info and contract details.

---

### Create a Purchase Order
```
POST /orders/create
```
Body:
```json
{
  "supplier": "0xSupplierWalletAddress",
  "amount": "100",
  "itemDescription": "500kg of raw cashew nuts",
  "deliveryCondition": "GPS confirmed delivery to Lagos warehouse"
}
```
Amount is in USDC. 100 = 100 USDC.

---

### Get Order Details
```
GET /orders/:id
```
Returns full order details including status and parties.

---

### Fund a Purchase Order
```
POST /orders/:id/fund
```
Locks USDC in escrow on Arc. Payment is held until delivery is confirmed.

---

### Confirm Delivery
```
POST /orders/:id/confirm
```
Releases USDC to supplier. Updates TradeProof Score for both buyer and supplier.

---

### Raise a Dispute
```
POST /orders/:id/dispute
```
Flags the order for review. USDC remains in escrow.

---

### Get Credit Profile
```
GET /credit/:address
```
Returns the TradeProof Score and total USDC volume settled for any wallet address.

Response:
```json
{
  "success": true,
  "address": "0x...",
  "tradeProofScore": "12",
  "totalVolumeSettled": "15000.00 USDC",
  "creditLevel": "Silver",
  "message": "This address has completed 12 verified trades on Arc."
}
```

Credit Levels:
- New: 0 to 4 completed orders
- Bronze: 5 to 19 completed orders
- Silver: 20 to 49 completed orders
- Gold: 50+ completed orders

---

## Quick Start

```bash
git clone https://github.com/mimisco-git/tradeproof
cd tradeproof
npm install express ethers dotenv
cp .env.example .env
# Fill in your .env values
node server.js
```

---

## Environment Variables

```
PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=0x8400f55e0544c02e85d870FfB1ABf9c120CF4484
USDC_ADDRESS=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
PORT=3000
```

---

## Built On

- Arc Testnet (Chain ID: 5042002)
- USDC as settlement currency
- Circle Wallets, CCTP, Gateway, Nanopayments, Paymaster
- Contract: 0x8400f55e0544c02e85d870FfB1ABf9c120CF4484
- Explorer: https://testnet.arcscan.app
