// admin-panel.js (updated with fixes)
import { handleImageDisplay } from './image-utils.js'; // Ensure this import is correct
import { debugLog } from './debug.js';
import { elements } from './dom.js';
import { loadAssignedOrders, loadOrderDetails, loadTradeProducts, assignOrder, updateOrderItems } from './api.js';

export let pendingUpdates = []; // Module-scoped state
export let tradeUpdates = []; // State for trade product updates

export function initializeAdminPanel() {
    if (!elements.orderSelect) {
        debugLog("⚠️ #order_select not found – skipping initialization.");
        return;
    }

    loadAssignedOrders()
        .then(orders => {
            debugLog("Assigned orders fetched:", orders);
            const select = elements.orderSelect;
            select.innerHTML = '<option value="">-- Select Order --</option>';
            if (Array.isArray(orders) && orders.length > 0) {
                orders.forEach(order => {
                    if (order.OrderId && order.email) { // Ensure required fields exist
                        const option = document.createElement('option');
                        option.value = order.OrderId;
                        option.textContent = `Order #${order.OrderId} (${order.email})`;
                        select.appendChild(option);
                    } else {
                        debugLog("⚠️ Invalid order data:", order);
                    }
                });
                // Automatically load the first order if one exists
                if (orders.length > 0) {
                    select.value = orders[0].OrderId;
                    select.dispatchEvent(new Event('change'));
                }
            } else {
                debugLog("⚠️ No assigned orders found.");
                select.disabled = true; // Disable if no orders
            }
        })
        .catch(error => {
            debugLog("❌ Error initializing assigned orders:", error);
            elements.orderSelect.innerHTML = '<option value="">-- No assigned orders --</option>';
            elements.orderSelect.disabled = true; // Disable on error
        });

    elements.orderSelect.addEventListener('change', () => {
        const orderId = elements.orderSelect.value;
        if (orderId) {
            loadOrderDetails(orderId)
                .then(data => {
                    debugLog("Order details fetched:", data);
                    renderOrderDetails(data || { order_details: [] }); // Ensure data is an object with order_details
                })
                .catch(error => {
                    debugLog("❌ Error loading order details:", error);
                    renderOrderDetails({ order_details: [] }); // Render empty table on error
                });
            loadTradeProducts(orderId)
                .then(data => {
                    debugLog("Trade products fetched:", data);
                    renderTradeProducts(data || []); // Ensure data is an array
                })
                .catch(error => {
                    debugLog("❌ Error loading trade products:", error);
                    renderTradeProducts([]); // Render empty trade section on error
                });
        } else {
            // Clear table and trade section if no order is selected
            renderOrderDetails({ order_details: [] });
            renderTradeProducts([]);
        }
    });

    // Check and add event listeners for buttons, with fallback if not found
    const assignButton = document.getElementById('assignOrderButton') || elements.assignButton;
    if (assignButton) {
        assignButton.addEventListener('click', assignOrderHandler);
    } else {
        debugLog("⚠️ #assignOrderButton not found – skipping.");
    }

    const submitButton = document.getElementById('submitChangesButton') || elements.submitButton;
    if (submitButton) {
        submitButton.addEventListener('click', updateOrderItemsHandler);
    } else {
        debugLog("⚠️ #submitChangesButton not found – skipping.");
    }

    const recalculateButton = document.getElementById('RecalculatePrices');
    if (recalculateButton) {
        recalculateButton.addEventListener('click', recalculatePrices);
    } else {
        debugLog("⚠️ #RecalculatePrices not found – skipping.");
    }

    const updateTradeButton = document.getElementById('updateTradeProductsButton');
    if (updateTradeButton) {
        updateTradeButton.addEventListener('click', updateTradeProductsHandler);
    } else {
        debugLog("⚠️ #updateTradeProductsButton not found – skipping.");
    }
}

export function assignOrderHandler() {
    const orderId = document.getElementById('OrderId')?.value;
    if (!orderId) {
        alert("Please select an order!");
        return;
    }
    assignOrder(orderId)
        .then(data => {
            if (data && typeof data.message === 'string') {
                alert(data.message);
                if (data.success) location.reload();
            } else {
                debugLog("⚠️ Invalid response from assignOrder:", data);
                alert("Error assigning order. Please try again.");
            }
        })
        .catch(error => console.error("❌ Error assigning order:", error));
}

export function updateOrderItemsHandler() {
    if (pendingUpdates.length === 0 && tradeUpdates.length === 0) {
        alert("No changes to submit!");
        return;
    }

    const payload = {
        items: pendingUpdates.length > 0 ? pendingUpdates.map(update => {
            if (!update.id) {
                debugLog("⚠️ Invalid update object, missing id:", update);
                return null;
            }
            return {
                id: Number(update.id),
                condition: update.condition || 'Near Mint',
                price: parseFloat(update.price) || 0.00,
                quantity: parseInt(update.quantity, 10) || 1,
                IsAcceptedSingle: update.IsAcceptedSingle === 1 || update.IsAcceptedSingle === true ? 1 : 0
            };
        }).filter(update => update !== null) : [],
        trade_updates: tradeUpdates.length > 0 ? tradeUpdates.map(update => {
            if (!update.id) {
                debugLog("⚠️ Invalid trade update object, missing id:", update);
                return null;
            }
            return {
                id: Number(update.id),
                quantity: parseInt(update.quantity, 10) || 1,
                IsAccepted: update.IsAccepted === 1 || update.IsAccepted === true ? 1 : 0
            };
        }).filter(update => update !== null) : []
    };

    debugLog("🚀 FINAL PAYLOAD:", JSON.stringify(payload, null, 2));

    updateOrderItems(payload)
        .then(data => {
            debugLog("✅ Update response:", data);
            if (data && typeof data.success === 'boolean') {
                if (!data.success) {
                    alert("Error updating items: " + (data.message || "Unknown error"));
                } else {
                    alert("✅ Updates successfully submitted!");
                    location.reload();
                }
            } else {
                debugLog("⚠️ Invalid response from updateOrderItems:", data);
                alert("Error updating items. Please try again.");
            }
            pendingUpdates = []; // Reset after successful submission
            tradeUpdates = [];   // Reset trade updates
        })
        .catch(error => console.error("❌ Error updating order item:", error));
}

function renderOrderDetails(data) {
    const orderDetails = Array.isArray(data) ? data : (data.order_details || []);
    if (!Array.isArray(orderDetails)) {
        debugLog("⚠️ Invalid order details format, rendering empty table:", data);
        orderDetails = [];
    }

    const orderTable = document.getElementById("order_table")?.querySelector("tbody");
    if (!orderTable) {
        console.error("❌ Order details table not found.");
        return;
    }

    orderTable.innerHTML = ""; // Clear previous content to prevent duplication
    pendingUpdates = [];

    if (orderDetails.length === 0) {
        const noDataRow = `
            <tr>
                <td colspan="10" style="text-align: center;">No order details available.</td>
            </tr>
        `;
        orderTable.innerHTML = noDataRow;
        return;
    }

    orderDetails.forEach(item => {
        if (!item || !item.Id) {
            debugLog("⚠️ Skipping row with missing or invalid item:", item);
            return;
        }

        const conditionOptions = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"]
            .map(option => `<option value="${option}" ${item.Condition === option ? "selected" : ""}>${option}</option>`)
            .join("");

        const imageButton = `<button class="show-image-btn" data-product-id="${item.ProductId || ''}" title="Show Image">📷 Show</button>`;

        const row = `
            <tr data-item-id="${item.Id}">
                <td>${item.Game || 'N/A'}</td>
                <td>${item.Set || 'undefined'}</td>
                <td>${item.ProductName || 'N/A'}</td>
                <td class="image-btn-cell">${imageButton}</td>
                <td>${item.Rarity || 'N/A'}</td>
                <td>${item.ReverseHolo ? "Yes" : "No"}</td>
                <td><select class="editable-dropdown" data-field="condition">${conditionOptions}</select></td>
                <td contenteditable="true" class="editable highlight-editable" data-field="price">${item.Price || '0.00'}</td>
                <td contenteditable="true" class="editable highlight-editable" data-field="quantity">${item.Quantity || '0'}</td>
                <td>
                    <input type="checkbox" class="toggle-accepted" data-field="IsAcceptedSingle" ${item.Accepted ? "checked" : ""}>
                </td>
            </tr>
        `;
        orderTable.innerHTML += row;
    });

    document.querySelectorAll(".editable")?.forEach(cell => {
        cell.addEventListener("blur", function () {
            const row = this.closest("tr");
            if (!row) return debugLog("⚠️ Row not found for editable cell.");
            storePendingUpdate(row.getAttribute("data-item-id"), this.getAttribute("data-field"), this.innerText.trim());
        });
    });

    document.querySelectorAll(".editable-dropdown")?.forEach(select => {
        select.addEventListener("change", function () {
            const row = this.closest("tr");
            if (!row) return debugLog("⚠️ Row not found for dropdown.");
            storePendingUpdate(row.getAttribute("data-item-id"), this.getAttribute("data-field"), this.value);
        });
    });

    document.querySelectorAll(".toggle-accepted")?.forEach(checkbox => {
        checkbox.addEventListener("change", function () {
            const row = this.closest("tr");
            if (!row) return debugLog("⚠️ Row not found for toggle.");
            storePendingUpdate(row.getAttribute("data-item-id"), "IsAcceptedSingle", this.checked ? 1 : 0);
        });
    });

    // Ensure image buttons use handleImageDisplay with proper error handling and prevent duplication
    document.querySelectorAll(".show-image-btn")?.forEach(btn => {
        const newHandler = (e) => handleImageDisplay(e);
        btn.removeEventListener("click", newHandler); // Remove any previous listener with this handler
        btn.addEventListener("click", newHandler, { once: false }); // Add single listener
        debugLog(`✅ Added click listener to button with data-product-id: ${btn.getAttribute('data-product-id')}`);
    });
}

function renderTradeProducts(data) {
    const tradeSection = document.getElementById('trade-products-section');
    const tradeTableBody = document.getElementById('trade-products-table')?.querySelector('tbody');
    const totalBuyoutAmountElement = document.getElementById('total-buyout-amount');
    const totalTradeAmountElement = document.getElementById('total-trade-amount');
    const remainingBalanceElement = document.getElementById('remaining-balance');

    if (!tradeTableBody) {
        console.error("❌ Trade products table not found.");
        return;
    }

    tradeTableBody.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
        debugLog("⚠️ No trade products for this order.");
        if (tradeSection) tradeSection.style.display = 'none';
        return;
    }

    let totalTradeAmount = 0;
    let totalBuyoutAmount = 0;

    const orderTable = document.getElementById('order_table')?.querySelector('tbody');
    if (orderTable) {
        orderTable.querySelectorAll('tr').forEach(row => {
            const price = parseFloat(row.cells[7]?.textContent) || 0; // Price is in column 8 (0-based)
            const quantity = parseInt(row.cells[8]?.textContent) || 0; // Quantity is in column 9
            totalBuyoutAmount += price * quantity;
        });
    } else {
        debugLog("⚠️ Order table not found for buyout calculation.");
    }

    debugLog("💰 Total Buyout Amount:", totalBuyoutAmount);
    if (totalBuyoutAmountElement) totalBuyoutAmountElement.textContent = `${totalBuyoutAmount.toFixed(2)} €`;

    totalTradeAmount = data.reduce((sum, item) => {
        const amount = parseFloat(item.amount) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (amount * quantity);
    }, 0);
    debugLog("💰 Total Trade Amount:", totalTradeAmount);
    if (totalTradeAmountElement) totalTradeAmountElement.textContent = `${totalTradeAmount.toFixed(2)} €`;

    const balance = totalBuyoutAmount - totalTradeAmount;
    debugLog("⚖️ Balance:", balance);
    if (remainingBalanceElement) remainingBalanceElement.textContent = `${balance.toFixed(2)} €`;

    data.forEach(item => {
        if (!item || !item.id) {
            debugLog("⚠️ Skipping invalid trade item:", item);
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.product_code || '-'}</td>
            <td>${item.product_name || item.product || 'N/A'}</td>
            <td contenteditable="true" class="editable highlight-editable" data-field="quantity" data-trade-id="${item.id || ''}">${item.quantity || '1'}</td>
            <td>${(parseFloat(item.amount) || 0).toFixed(2)} €</td>
            <td><input type="checkbox" class="toggle-accepted" data-field="IsAccepted" ${item.IsAccepted ? "checked" : ""}></td>
        `;
        tradeTableBody.appendChild(row);
    });

    if (tradeSection) tradeSection.style.display = 'block';
    debugLog("✅ Trade products loaded successfully. Debug: IsAccepted values:", data.map(item => item.IsAccepted));

    // Add event listeners for quantity updates
    document.querySelectorAll('.editable.highlight-editable')?.forEach(cell => {
        cell.addEventListener('blur', function () {
            const row = this.closest('tr');
            if (!row) return debugLog("⚠️ Row not found for editable cell.");
            const tradeId = this.getAttribute('data-trade-id');
            const quantity = parseInt(this.innerText.trim()) || 1;
            if (quantity < 1) {
                alert("Quantity must be at least 1.");
                this.innerText = '1';
                return;
            }
            updateTradeItem(tradeId, quantity);
            updateTradeTotals();
        });
    });

    // Add event listeners for Accepted checkbox changes
    document.querySelectorAll('.toggle-accepted')?.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const row = this.closest('tr');
            if (!row) return debugLog("⚠️ Row not found for toggle.");
            const tradeId = row.querySelector('.editable.highlight-editable')?.getAttribute('data-trade-id');
            if (!tradeId) return debugLog("⚠️ Trade ID not found for toggle.");
            const isAccepted = this.checked ? 1 : 0;
            updateTradeItem(tradeId, null, isAccepted);
            updateTradeTotals();
        });
    });
}

function storePendingUpdate(Id, field, newValue) {
    if (!Id) return console.error("❌ Missing ID for update");
    let existingItem = pendingUpdates.find(item => item.id === parseInt(Id));
    if (existingItem) {
        existingItem[field] = newValue;
    } else {
        let newItem = { id: parseInt(Id) };
        newItem[field] = newValue;
        pendingUpdates.push(newItem);
    }
}

export async function recalculatePrices() {
    const orderId = elements.orderSelect?.value;
    if (!orderId) {
        alert("Please select an order first!");
        return;
    }

    try {
        const response = await fetch('/api/recalculate_active_trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (data && typeof data.success === 'boolean') {
            if (data.success) {
                debugLog("✅ Prices recalculated successfully:", data);
                alert(data.message || "Prices recalculated successfully!");
                await loadOrderDetails(orderId).then(renderOrderDetails);
                await loadTradeProducts(orderId).then(renderTradeProducts);
            } else {
                alert(`❌ Error: ${data.message || "Failed to recalculate prices"}`);
                console.error("Error recalculating prices:", data.message);
            }
        } else {
            debugLog("⚠️ Invalid response from recalculate_active_trades:", data);
            alert("❌ Error processing recalculation. Please try again.");
        }
    } catch (error) {
        console.error("❌ Network error recalculating prices:", error);
        alert("❌ Error processing recalculation. Please try again.");
    }
}

async function updateTradeItem(tradeId, newQuantity = null, newIsAccepted = null) {
    if (!tradeId) {
        console.error("❌ Missing trade ID for update");
        return;
    }

    const orderId = elements.orderSelect?.value;
    if (!orderId) {
        alert("Please select an order first!");
        return;
    }

    const payload = {};
    if (newQuantity !== null) payload.quantity = newQuantity;
    if (newIsAccepted !== null) payload.IsAccepted = newIsAccepted;

    try {
        const response = await fetch(`/api/update_trade_item/${tradeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ OrderId: orderId, ...payload })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (data && typeof data.success === 'boolean') {
            if (data.success) {
                debugLog("✅ Trade item updated successfully:", data);
                const existingUpdate = tradeUpdates.find(update => update.id === parseInt(tradeId));
                if (existingUpdate) {
                    if (newQuantity !== null) existingUpdate.quantity = newQuantity;
                    if (newIsAccepted !== null) existingUpdate.IsAccepted = newIsAccepted;
                } else if (Object.keys(payload).length > 0) {
                    tradeUpdates.push({ id: parseInt(tradeId), ...payload });
                }
            } else {
                alert(`❌ Error: ${data.message || "Failed to update trade item"}`);
                console.error("Error updating trade item:", data.message);
            }
        } else {
            debugLog("⚠️ Invalid response from update_trade_item:", data);
            alert("❌ Error processing trade item update. Please try again.");
        }
    } catch (error) {
        console.error("❌ Network error updating trade item:", error);
        alert("❌ Error processing trade item update. Please try again.");
    }
}

export async function updateTradeProductsHandler() {
    const orderId = elements.orderSelect?.value;
    if (!orderId) {
        alert("Please select an order first!");
        return;
    }

    if (tradeUpdates.length === 0) {
        alert("No trade product changes to update!");
        return;
    }

    try {
        const response = await fetch('/api/update_trade_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ OrderId: orderId, updates: tradeUpdates })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (data && typeof data.success === 'boolean') {
            if (data.success) {
                debugLog("✅ Trade products updated successfully:", data);
                alert(data.message || "Trade products updated successfully!");
                await loadTradeProducts(orderId).then(renderTradeProducts);
                tradeUpdates = []; // Reset after successful submission
            } else {
                alert(`❌ Error: ${data.message || "Failed to update trade products"}`);
                console.error("Error updating trade products:", data.message);
            }
        } else {
            debugLog("⚠️ Invalid response from update_trade_items:", data);
            alert("❌ Error processing trade products update. Please try again.");
        }
    } catch (error) {
        console.error("❌ Network error updating trade products:", error);
        alert("❌ Error processing trade products update. Please try again.");
    }
}

function updateTradeTotals() {
    const orderTable = document.getElementById('order_table')?.querySelector('tbody');
    const tradeTable = document.getElementById('trade-products-table')?.querySelector('tbody');
    const totalBuyoutAmountElement = document.getElementById('total-buyout-amount');
    const totalTradeAmountElement = document.getElementById('total-trade-amount');
    const remainingBalanceElement = document.getElementById('remaining-balance');

    if (!orderTable || !tradeTable || !totalBuyoutAmountElement || !totalTradeAmountElement || !remainingBalanceElement) {
        debugLog("⚠️ Missing elements for recalculation.");
        return;
    }

    let totalBuyoutAmount = 0;
    orderTable.querySelectorAll('tr').forEach(row => {
        const price = parseFloat(row.cells[7]?.textContent) || 0;
        const quantity = parseInt(row.cells[8]?.textContent) || 0;
        totalBuyoutAmount += price * quantity;
    });

    let totalTradeAmount = 0;
    tradeTable.querySelectorAll('tr').forEach(row => {
        const amount = parseFloat(row.cells[3].textContent.replace('€', '').trim()) || 0;
        const quantity = parseInt(row.cells[2].textContent.trim()) || 0;
        totalTradeAmount += amount * quantity;
    });

    totalBuyoutAmountElement.textContent = `${totalBuyoutAmount.toFixed(2)} €`;
    totalTradeAmountElement.textContent = `${totalTradeAmount.toFixed(2)} €`;
    const remainingBalance = totalBuyoutAmount - totalTradeAmount;
    remainingBalanceElement.textContent = `${remainingBalance.toFixed(2)} €`;

    debugLog(`Recalculated: Buyout=${totalBuyoutAmount.toFixed(2)} €, Trade=${totalTradeAmount.toFixed(2)} €, Balance=${remainingBalance.toFixed(2)} €`);
}