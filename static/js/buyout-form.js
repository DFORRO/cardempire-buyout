// buyout-form.js
import { debugLog } from './debug.js';
import { elements } from './dom.js';
import { loadGames, loadEditions, setupProductDropdown, loadRarities, loadReverseHolo, loadPrice } from './api.js';
import { showBuyoutProductImage } from './image-utils.js';
import { totalBuyoutAmount } from './order-utils.js';
import { subtractEshopProduct, addEshopProductToTable, updateBalanceDisplay, loadEshopProducts, clearTradeList } from './eshop-utils.js'; // Added clearTradeList
import { toggleAddressFields } from './ui-utils.js';

export function initializeBuyoutForm() {
    loadGames();

    document.getElementById('game').addEventListener('change', loadEditions);
    document.getElementById('edition').addEventListener('change', setupProductDropdown);
    document.getElementById('rarity').addEventListener('change', loadReverseHolo);
    document.getElementById('isReverseHolo').addEventListener('change', loadPrice);
    document.getElementById('condition').addEventListener('change', updatePrice);
    document.getElementById('addToOrderButton').addEventListener('click', addToOrder);
    document.getElementById('deleteSelectedButton').addEventListener('click', deleteSelectedItems);
    document.getElementById('resetFormButton').addEventListener('click', resetForm);
    document.getElementById('submitOrderButton').addEventListener('click', function(event) {
        event.preventDefault();
        const requestData = gatherOrderData();
        submitOrder(requestData);
    });

    $('#product').on('select2:select', function(e) {
        const productId = e.params.data.element?.dataset.productId;
        if (productId) {
            debugLog(`Attempting to show image for product ID: ${productId}`);
            showBuyoutProductImage(productId);
            loadRarities();
        } else {
            debugLog("⚠️ No valid product selected. Clearing image and disabling rarity.");
            const container = document.getElementById('buyout-product-image-container');
            if (container) container.innerHTML = '';
            resetRarityDropdown();
        }
    });

    document.getElementById("eshop-product-dropdown").addEventListener("change", function () {
        const selectedOption = this.options[this.selectedIndex];
        const price = parseFloat(selectedOption.getAttribute("data-price")) || 0;
        if (selectedOption.value) subtractEshopProduct(price);
    });

    document.getElementById("add-eshop-product-btn").addEventListener("click", function () {
        const dropdown = document.getElementById("eshop-product-dropdown");
        const quantityInput = document.getElementById("eshop-product-quantity");
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        if (!selectedOption.value) {
            alert("❌ Please select a product first.");
            return;
        }
        const productName = selectedOption.text.split(" - ")[0];
        const productCode = selectedOption.value;
        const productPrice = parseFloat(selectedOption.getAttribute("data-price")) || 0;
        const productQuantity = parseInt(quantityInput.value) || 1;
        addEshopProductToTable(productName, productCode, productPrice, productQuantity);
        updateBalanceDisplay();
    });

    const tradeTypeElement = document.getElementById('TradeType');
    if (tradeTypeElement) {
        tradeTypeElement.addEventListener('change', toggleTradeFields);
    } else {
        debugLog("⚠️ #TradeType not found.");
    }

    const pickupTypeElement = document.getElementById('PickupType');
    if (pickupTypeElement) {
        pickupTypeElement.addEventListener('change', toggleAddressFields);
    } else {
        debugLog("⚠️ #PickupType not found.");
    }

    loadEshopProducts();
    setTimeout(toggleTradeFields, 100);

    resetRarityDropdown();
}

export function toggleTradeFields() {
    const tradeType = document.getElementById('TradeType');
    const tradeSection = document.getElementById('trade-section');
    if (!tradeType || !tradeSection) return;
    tradeSection.style.display = tradeType.value === 'Tovar' ? 'block' : 'none';
}

export function resetForm() {
    document.querySelectorAll('select, input').forEach(field => {
        field.value = "";
        field.disabled = true;
    });
    document.getElementById('email').value = "";
    document.getElementById('email').disabled = false;
    document.getElementById('game').disabled = false;
    document.getElementById('condition').disabled = false;
    document.getElementById('quantity').disabled = false;
    document.getElementById('orderTable').querySelector('tbody').innerHTML = "";
    resetRarityDropdown();
}

export function resetFormExceptEmail() {
    document.getElementById('game').value = "";
    document.getElementById('edition').innerHTML = "<option value=''> Select Edition </option>";
    document.getElementById('edition').disabled = true;
    document.getElementById('product').innerHTML = "<option value=''> Select Product </option>";
    document.getElementById('product').disabled = true;
    resetRarityDropdown();
    document.getElementById('condition').value = "";
    document.getElementById('price').value = "";
    document.getElementById('quantity').value = "";
}

export function updatePrice() {
    const priceField = document.getElementById('price');
    const conditionField = document.getElementById('condition');
    const basePrice = parseFloat(priceField.dataset.basePrice || 0);
    let conditionMultiplier = 0;

    switch (conditionField.value) {
        case "Near Mint": conditionMultiplier = 0.7; break;
        case "Lightly Played": conditionMultiplier = 0.6; break;
        case "Moderately Played": conditionMultiplier = 0.4; break;
        case "Heavily Played": conditionMultiplier = 0.3; break;
        case "Damaged": conditionMultiplier = 0.1; break;
        default: conditionMultiplier = 0; break;
    }

    if (isNaN(basePrice) || basePrice === 0 || conditionMultiplier === 0) {
        priceField.value = "";
        priceField.disabled = true;
        return;
    }

    const finalPrice = (basePrice * conditionMultiplier).toFixed(2);
    priceField.value = finalPrice;
    priceField.disabled = false;
}

export function addToOrder() {
    const game = document.getElementById('game').value;
    const edition = document.getElementById('edition').value;
    const productElement = document.getElementById('product');
    const product = productElement.selectedOptions[0]?.textContent.trim();
    const ProductId = productElement.selectedOptions[0]?.getAttribute('data-product-id');
    const rarity = document.getElementById('rarity').value;
    const isReverseHolo = document.getElementById('isReverseHolo').value;
    const condition = document.getElementById('condition').value;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;

    if (!game || !edition || !product || !rarity || !isReverseHolo || !condition || price <= 0 || quantity <= 0) {
        alert("❌ Vyplňte všetky polia pred pridaním do objednávky.");
        return;
    }

    const orderTableBody = document.getElementById('orderTable').querySelector('tbody');
    const newRow = document.createElement('tr');
    newRow.classList.add("selected-product");
    newRow.setAttribute('data-product-id', ProductId);
    newRow.setAttribute('data-price', price.toFixed(2));
    newRow.setAttribute('data-quantity', quantity);

    newRow.innerHTML = `
        <td><input type="checkbox" class="delete-checkbox"></td>
        <td>${game}</td>
        <td>${edition}</td>
        <td>${product}</td>
        <td>${rarity}</td>
        <td>${isReverseHolo}</td>
        <td>${condition}</td>
        <td>${quantity}</td>
        <td>${price.toFixed(2)} €</td>
    `;

    orderTableBody.appendChild(newRow);
    totalBuyoutAmount();
    resetFormExceptEmail();
}

export function deleteSelectedItems() {
    const orderTableBody = document.getElementById('orderTable').querySelector('tbody');
    const checkboxes = orderTableBody.querySelectorAll('.delete-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Nie sú vybrané žiadne položky na odstránenie.');
        return;
    }
    checkboxes.forEach(checkbox => checkbox.closest('tr').remove());
    debugLog("Vybrané položky boli odstránené.");
}

export function clearFormFields() {
    document.querySelectorAll('#buyoutForm input, #buyoutForm select').forEach(input => input.value = '');
    document.querySelectorAll('.address-field').forEach(field => field.style.display = 'none');
    document.getElementById('total-buyout-amount').textContent = '0€';
    document.getElementById('total-selected-amount').textContent = '0€';
    document.getElementById('balance-display').textContent = 'Remaining Balance: 0€';
    resetRarityDropdown();
}

export function clearOrderList() {
    debugLog("🗑️ Čistenie zoznamu objednávok...");
    document.querySelector('#orderTable tbody').innerHTML = '';
}

export async function submitOrder(requestData) {
    try {
        const response = await fetch('/api/submit_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        debugLog("✅ Submit order response:", data);

        if (data.success === true || (data.message && data.message.includes("successfully"))) {
            alert("✅ Objednávka bola úspešne odoslaná.");
            clearFormFields();
            clearOrderList();
            clearTradeList(); // Now correctly imported
            setTimeout(() => location.reload(), 1000);
        } else {
            alert("❌ Order submission failed: " + (data.message || "Unknown error"));
        }
    } catch (error) {
        console.error("Error submitting order:", error);
        alert("❌ Error processing order: " + error.message);
    }
}

function gatherOrderData() {
    const email = document.getElementById('email').value;
    const TradeType = document.getElementById('TradeType').value;
    const PickupType = document.getElementById('PickupPoint').value;
    const PickupPoint = document.getElementById('PickupPoint').value;
    const PhoneNumber = document.getElementById('PhoneNumber').value;
    const FirstName = document.getElementById('FirstName').value;
    const LastName = document.getElementById('LastName').value;
    const City = document.getElementById('City').value;
    const StreetAddress = document.getElementById('StreetAddress').value;
    const PostalCode = document.getElementById('PostalCode').value;
    const Country = document.getElementById('Country').value;

    if (PickupType === 'Packeta na adresu' && (!PhoneNumber || !FirstName || !LastName || !City || !StreetAddress || !PostalCode || !Country || !PickupPoint)) {
        alert("❌ Vyplňte všetky povinné údaje pre Packeta na adresu.");
        throw new Error("Missing required fields.");
    }

    const orderData = [];
    document.querySelectorAll('#orderTable tbody tr').forEach(row => {
        const productId = row.getAttribute('data-product-id');
        orderData.push({
            game: row.cells[1].textContent.trim(),
            edition: row.cells[2].textContent.trim(),
            product: row.cells[3].textContent.trim(),
            productId: productId,
            rarity: row.cells[4].textContent.trim(),
            isReverseHolo: row.cells[5].textContent.trim(),
            condition: row.cells[6].textContent.trim(),
            quantity: parseInt(row.cells[7].textContent.trim()) || 1,
            price: parseFloat(row.cells[8].textContent.replace("€", "").trim()) || 0
        });
    });

    const tradeData = [];
    if (TradeType === "Tovar") {
        document.querySelectorAll('#eshop-products-table tbody tr').forEach(row => {
            const productCode = row.cells[1]?.getAttribute("data-product-id") || row.cells[1]?.textContent.trim();
            const productName = row.cells[1]?.textContent.trim();
            const quantity = parseInt(row.cells[2].textContent) || 1;
            const amount = parseFloat(row.cells[3].textContent) || 0.0;
            tradeData.push({
                product_code: productCode,
                product: productName,
                quantity: quantity,
                amount: amount
            });
        });
    }

    return {
        email, TradeType, PickupType, PickupPoint, PhoneNumber, FirstName, LastName,
        City, StreetAddress, PostalCode, Country, items: orderData, tradeItems: tradeData
    };
}

function resetRarityDropdown() {
    const rarity = document.getElementById('rarity');
    const isReverseHolo = document.getElementById('isReverseHolo');
    if (rarity) {
        rarity.innerHTML = "<option value=''> Select Rarity </option>";
        rarity.disabled = true;
    }
    if (isReverseHolo) {
        isReverseHolo.innerHTML = "<option value=''>Select Reverse Holo </option>";
        isReverseHolo.disabled = true;
    }
}