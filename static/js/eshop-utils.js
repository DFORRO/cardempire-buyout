// eshop-utils.js
import { debugLog } from './debug.js';
import { loadEshopProducts } from './api.js';

export { loadEshopProducts };

export function subtractEshopProduct(productPrice) {
    const balanceElement = document.getElementById("balance-display");
    if (!balanceElement) {
        console.error("❌ Element #balance-display not found!");
        return;
    }
    let currentBalance = parseFloat(balanceElement.textContent.replace("€", "").trim()) || 0;
    let newBalance = currentBalance - productPrice;
    balanceElement.textContent = newBalance.toFixed(2) + " €";
    debugLog(`💰 Remaining Balance after e-shop product: ${newBalance.toFixed(2)} €`);
}

export function addEshopProductToTable(productName, productCode, productPrice, quantity) {
    const tableBody = document.getElementById('eshop-products-table').querySelector('tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="checkbox"></td>
        <td data-product-id="${productCode}">${productName}</td>
        <td>${quantity}</td>
        <td>${productPrice.toFixed(2)} €</td>
    `;
    tableBody.appendChild(row);
    updateBalanceDisplay();
}

export function updateSelectedTotal() {
    let total = 0;
    document.querySelectorAll("#eshop-products-table tbody tr").forEach(row => {
        const price = parseFloat(row.children[3].textContent.replace("€", "").trim()) || 0;
        total += price;
    });
    document.getElementById("total-selected-amount").textContent = total.toFixed(2) + "€";
    updateBalanceDisplay();
}

export function updateBalanceDisplay() {
    const totalBuyoutAmount = parseFloat(document.getElementById('total-buyout-amount').textContent.replace('€', '').trim()) || 0;
    let totalSelectedAmount = 0;
    document.querySelectorAll("#eshop-products-table tbody tr").forEach(row => {
        const price = parseFloat(row.cells[3].textContent.replace('€', '').trim()) || 0;
        const quantity = parseInt(row.cells[2].textContent.trim()) || 1;
        totalSelectedAmount += price * quantity;
    });
    const balance = totalBuyoutAmount - totalSelectedAmount;
    debugLog(`🔄 Balance update: Buyout=${totalBuyoutAmount}, Selected=${totalSelectedAmount}, Balance=${balance}€`);
    document.getElementById('total-selected-amount').textContent = `${totalSelectedAmount.toFixed(2)}€`;
    document.getElementById('balance-display').textContent = `Remaining Balance: ${balance.toFixed(2)}€`;
}

export function deleteSelectedEshopItems() {
    const tableBody = document.querySelector("#eshop-products-table tbody");
    if (!tableBody) {
        debugLog("⚠️ Table #eshop-products-table not found!");
        return;
    }
    const checkboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");
    checkboxes.forEach(checkbox => checkbox.closest("tr").remove());
    updateSelectedTotal();
    debugLog("🗑️ Deleted e-shop products.");
}

export function clearTradeList() {
    const tableBody = document.querySelector("#eshop-products-table tbody");
    if (tableBody) tableBody.innerHTML = "";
    document.getElementById("total-selected-amount").textContent = "0€";
    updateBalanceDisplay();
}