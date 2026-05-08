// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TradeProof
 * @notice Agentic Procure-to-Pay protocol for African SMEs on Arc
 * @dev Creates programmable Purchase Orders with USDC escrow and onchain credit history
 */
contract TradeProof is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public orderCount;

    enum OrderStatus { Created, Funded, Delivered, Completed, Disputed, Cancelled }

    struct PurchaseOrder {
        uint256 id;
        address buyer;
        address supplier;
        uint256 amount;
        string itemDescription;
        string deliveryCondition;
        OrderStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }

    mapping(uint256 => PurchaseOrder) public orders;
    mapping(address => uint256) public tradeScore;
    mapping(address => uint256) public totalVolume;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 amount, string itemDescription);
    event OrderFunded(uint256 indexed orderId, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId, address confirmedBy);
    event OrderCompleted(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 amount, uint256 completedAt);
    event OrderDisputed(uint256 indexed orderId, address raisedBy);
    event OrderCancelled(uint256 indexed orderId);

    modifier onlyBuyer(uint256 orderId) { require(msg.sender == orders[orderId].buyer, "Only buyer"); _; }
    modifier onlySupplier(uint256 orderId) { require(msg.sender == orders[orderId].supplier, "Only supplier"); _; }
    modifier inStatus(uint256 orderId, OrderStatus status) { require(orders[orderId].status == status, "Invalid order status"); _; }

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    function createOrder(address supplier, uint256 amount, string calldata itemDescription, string calldata deliveryCondition) external returns (uint256) {
        require(supplier != address(0), "Invalid supplier");
        require(supplier != msg.sender, "Buyer cannot be supplier");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(itemDescription).length > 0, "Description required");

        orderCount++;
        uint256 orderId = orderCount;

        orders[orderId] = PurchaseOrder({
            id: orderId,
            buyer: msg.sender,
            supplier: supplier,
            amount: amount,
            itemDescription: itemDescription,
            deliveryCondition: deliveryCondition,
            status: OrderStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit OrderCreated(orderId, msg.sender, supplier, amount, itemDescription);
        return orderId;
    }

    function fundOrder(uint256 orderId) external onlyBuyer(orderId) inStatus(orderId, OrderStatus.Created) nonReentrant {
        PurchaseOrder storage order = orders[orderId];
        usdc.safeTransferFrom(msg.sender, address(this), order.amount);
        order.status = OrderStatus.Funded;
        emit OrderFunded(orderId, order.amount);
    }

    function confirmDelivery(uint256 orderId) external onlyBuyer(orderId) inStatus(orderId, OrderStatus.Funded) nonReentrant {
        PurchaseOrder storage order = orders[orderId];
        order.status = OrderStatus.Completed;
        order.completedAt = block.timestamp;

        tradeScore[order.buyer]++;
        tradeScore[order.supplier]++;
        totalVolume[order.buyer] += order.amount;
        totalVolume[order.supplier] += order.amount;

        usdc.safeTransfer(order.supplier, order.amount);

        emit DeliveryConfirmed(orderId, msg.sender);
        emit OrderCompleted(orderId, order.buyer, order.supplier, order.amount, block.timestamp);
    }

    function raiseDispute(uint256 orderId) external inStatus(orderId, OrderStatus.Funded) {
        PurchaseOrder storage order = orders[orderId];
        require(msg.sender == order.buyer || msg.sender == order.supplier, "Not a party to this order");
        order.status = OrderStatus.Disputed;
        emit OrderDisputed(orderId, msg.sender);
    }

    function cancelOrder(uint256 orderId) external onlyBuyer(orderId) inStatus(orderId, OrderStatus.Created) {
        orders[orderId].status = OrderStatus.Cancelled;
        emit OrderCancelled(orderId);
    }

    function getCreditProfile(address account) external view returns (uint256 score, uint256 volume) {
        return (tradeScore[account], totalVolume[account]);
    }

    function getOrder(uint256 orderId) external view returns (PurchaseOrder memory) {
        return orders[orderId];
    }
}
