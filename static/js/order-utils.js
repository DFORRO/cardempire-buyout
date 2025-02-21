// order-utils.js
import { debugLog } from './debug.js';

export function totalBuyoutAmount() {
    const selectedProducts = document.querySelectorAll(".selected-product");
    let totalAmount = 0;

    selectedProducts.forEach(product => {
        const price = parseFloat(product.getAttribute("data-price")) || 0;
        const quantity = parseInt(product.getAttribute("data-quantity")) || 1;
        totalAmount += price * quantity;
    });

    const totalBuyoutElement = document.getElementById("total-buyout-amount");
    if (totalBuyoutElement) {
        totalBuyoutElement.textContent = totalAmount.toFixed(2) + " €";
        debugLog(`✅ Total Buyout Amount Updated: ${totalAmount.toFixed(2)} €`);
    }

    updateRemainingBalance();
}

export function updateRemainingBalance() {
    const totalBuyoutElement = document.getElementById("total-buyout-amount");
    const totalSelectedElement = document.getElementById("total-selected-amount");
    const balanceElement = document.getElementById("balance-display");

    if (!totalBuyoutElement || !totalSelectedElement || !balanceElement) {
        console.error("❌ Missing elements for balance calculation!");
        return;
    }

    const totalBuyout = parseFloat(totalBuyoutElement.textContent.replace("€", "").trim()) || 0;
    const totalSelected = parseFloat(totalSelectedElement.textContent.replace("€", "").trim()) || 0;
    const remainingBalance = totalBuyout - totalSelected;

    balanceElement.textContent = `Remaining Balance: ${remainingBalance.toFixed(2)} €`;
    debugLog(`💰 Remaining Balance Updated: ${remainingBalance.toFixed(2)} €`);
}