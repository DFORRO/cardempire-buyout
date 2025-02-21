// api.js
import { debugLog } from './debug.js';
import { populateDropdown, updateDropdown } from './ui-utils.js';

export async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error(`❌ API Error: ${error}`);
        throw error;
    }
}

export function loadGames() {
    fetchAPI('/api/games')
        .then(data => populateDropdown('game', data, 'game'))
        .catch(error => console.error('Error loading games:', error));
}

export function loadEditions() {
    const game = document.getElementById('game').value;
    if (!game) return resetDropdown('edition');
    fetchAPI(`/api/editions?game=${encodeURIComponent(game)}`)
        .then(data => updateDropdown('edition', data, 'edition'))
        .catch(error => console.error('Error loading editions:', error));
}

export function setupProductDropdown() {
    const productSelect = document.getElementById('product');
    
    function loadProducts() {
        const game = document.getElementById('game').value;
        const edition = document.getElementById('edition').value;

        if (!edition) {
            debugLog("⚠️ No edition selected.");
            productSelect.innerHTML = '<option value="">-- Vyberte produkt --</option>';
            productSelect.disabled = true;
            return;
        }

        fetchAPI(`/api/products?game=${encodeURIComponent(game)}&edition=${encodeURIComponent(edition)}`)
            .then(data => {
                productSelect.innerHTML = '<option value="">-- Vyberte produkt --</option>';
                if (!data || data.length === 0) {
                    debugLog("⚠️ No products for this edition.");
                    productSelect.disabled = true;
                    return;
                }

                data.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = product.name;
                    option.setAttribute('data-product-id', product.id);
                    option.setAttribute('data-name', product.name);
                    productSelect.appendChild(option);
                });

                productSelect.disabled = false;
                productSelect.dispatchEvent(new Event('change')); // Trigger change to load rarity
            })
            .catch(error => {
                console.error("❌ Error loading products:", error);
                productSelect.disabled = true;
            });
    }

    document.getElementById('edition').addEventListener('change', () => {
        debugLog("📌 Edition changed, reloading products...");
        loadProducts();
    });

    loadProducts();
}

export function loadRarities() {
    const game = document.getElementById('game').value;
    const edition = document.getElementById('edition').value;
    const productElement = document.getElementById('product');
    if (!game || !edition || !productElement) {
        debugLog("⚠️ Missing fields for rarities; resetting rarity dropdown.");
        resetDropdown('rarity');
        resetDropdown('isReverseHolo');
        return;
    }
    const productName = productElement.options[productElement.selectedIndex].dataset.name;

    fetchAPI(`/api/rarities?game=${encodeURIComponent(game)}&edition=${encodeURIComponent(edition)}&product=${encodeURIComponent(productName)}`)
        .then(data => {
            updateDropdown('rarity', data, 'rarity');
            autoSelectIfSingleOption('rarity');
        })
        .catch(error => {
            console.error('Error loading rarities:', error);
            resetDropdown('rarity');
        });
}

export function loadReverseHolo() {
    const game = document.getElementById('game').value;
    const edition = document.getElementById('edition').value;
    const productElement = document.getElementById('product');
    const rarity = document.getElementById('rarity').value;
    if (!game || !edition || !productElement || !rarity) return resetDropdown('isReverseHolo');
    const productName = productElement.options[productElement.selectedIndex].dataset.name;

    fetchAPI(`/api/reverse_holo?game=${encodeURIComponent(game)}&edition=${encodeURIComponent(edition)}&product=${encodeURIComponent(productName)}&rarity=${encodeURIComponent(rarity)}`)
        .then(data => {
            updateDropdown('isReverseHolo', data, 'isReverseHolo');
            autoSelectIfSingleOption('isReverseHolo');
        })
        .catch(error => console.error('Error loading reverse holo:', error));
}

export function loadPrice() {
    const game = document.getElementById('game')?.value;
    const edition = document.getElementById('edition')?.value;
    const productElement = document.getElementById('product');
    const rarity = document.getElementById('rarity')?.value;
    const isReverseHolo = document.getElementById('isReverseHolo')?.value;
    if (!game || !edition || !productElement || !rarity || !isReverseHolo) {
        debugLog("⚠️ Missing fields for price lookup.");
        return;
    }
    const productName = productElement.options[productElement.selectedIndex]?.dataset.name;
    if (!productName) {
        debugLog("⚠️ Product name missing.");
        return;
    }

    fetchAPI(`/api/price?game=${encodeURIComponent(game)}&edition=${encodeURIComponent(edition)}&product=${encodeURIComponent(productName)}&rarity=${encodeURIComponent(rarity)}&isReverseHolo=${encodeURIComponent(isReverseHolo)}`)
        .then(data => {
            const priceField = document.getElementById('price');
            if (!priceField) return debugLog("⚠️ Price field not found.");
            let price = parseFloat(data.price);
            if (isNaN(price)) {
                debugLog("⚠️ Invalid price:", data.price);
                priceField.value = "N/A";
                priceField.disabled = false;
                return;
            }
            priceField.dataset.basePrice = price.toFixed(2);
            priceField.value = price.toFixed(2);
            priceField.disabled = true;
        })
        .catch(error => {
            console.error('❌ Error fetching price:', error);
            const priceField = document.getElementById('price');
            if (priceField) {
                priceField.value = "Error";
                priceField.disabled = false;
            }
        });
}

export function loadEshopProducts() {
    fetchAPI('/api/eshop_products')
        .then(data => {
            const dropdown = document.getElementById("eshop-product-dropdown");
            dropdown.innerHTML = `<option value="">-- Select a product --</option>`;
            data.forEach(product => {
                const option = document.createElement("option");
                option.value = product.product_code;
                option.textContent = `${product.name} - ${product.price} €`;
                option.setAttribute("data-price", product.price);
                dropdown.appendChild(option);
            });
            debugLog("✅ E-shop products loaded.");
        })
        .catch(error => console.error("❌ Error loading e-shop products:", error));
}

export function assignOrder(orderId) {
    return fetchAPI('/api/assign_order_to_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ OrderId: orderId })
    });
}

export function loadAssignedOrders() {
    return fetchAPI('/api/assigned_orders')
        .then(data => {
            debugLog("✅ Assigned orders loaded (raw):", data);
            // Deduplicate orders by OrderId on the client side if necessary
            const orders = data.orders || [];
            const uniqueOrders = Array.from(new Map(orders.map(order => [order.OrderId, order])).values());
            debugLog("Deduplicated assigned orders:", uniqueOrders);
            return uniqueOrders; // Ensure we return unique orders
        })
        .catch(error => {
            console.error("❌ Error loading assigned orders:", error);
            return [];
        });
}

export function loadOrderDetails(OrderId) {
    return fetchAPI(`/api/order_details?OrderId=${encodeURIComponent(OrderId)}`)
        .then(data => {
            debugLog("Raw order details from API:", data);
            const orderDetails = data.order_details || [];
            // Deduplicate order details by Id on the client side if necessary
            const uniqueOrderDetails = Array.from(new Map(orderDetails.map(item => [item.Id, item])).values());
            debugLog("Deduplicated order details:", uniqueOrderDetails);
            return { order_details: uniqueOrderDetails }; // Return deduplicated data
        })
        .catch(error => {
            console.error("❌ Error loading order details:", error);
            return { order_details: [] };
        });
}

export function loadTradeProducts(orderId) {
    return fetchAPI(`/api/trade_details?OrderId=${orderId}`)
        .then(data => {
            debugLog("Raw trade products from API:", data);
            // Deduplicate trade products by id or product_code on the client side
            const uniqueTradeDetails = Array.from(new Map(data.map(item => [item.id || item.product_code, item])).values());
            debugLog("Deduplicated trade products:", uniqueTradeDetails);
            return uniqueTradeDetails; // Return deduplicated data
        })
        .catch(error => {
            console.error("❌ Error loading trade products:", error);
            return [];
        });
}

export function updateOrderItems(items) {
    return fetchAPI('/api/update_order_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
    });
}

// Helper (not exported)
function resetDropdown(elementId) {
    const dropdown = document.getElementById(elementId);
    dropdown.innerHTML = "<option value=''>-- Select --</option>";
    dropdown.disabled = true;
}

// Helper (not exported, imported from ui-utils.js)
function autoSelectIfSingleOption(elementId) {
    const dropdown = document.getElementById(elementId);
    if (dropdown && dropdown.options.length === 2) {
        dropdown.selectedIndex = 1;
        dropdown.dispatchEvent(new Event('change'));
    }
}