// dom.js
import { debugLog } from './debug.js';

export const elements = {
    buyoutForm: document.getElementById('game'),
    productSelect: document.getElementById('product'),
    imageContainer: document.getElementById('product-image-container'),
    orderImageContainer: document.getElementById('order-image-container'),
    productDropdown: document.getElementById('eshop-product-dropdown'),
    totalBuyoutAmount: document.getElementById('total-buyout-amount'),
    totalSelectedAmount: document.getElementById('total-selected-amount'),
    balanceDisplay: document.getElementById('balance-display'),
    countrySelect: document.getElementById('Country'),
    orderSelect: document.getElementById('order_select'),
    assignButton: document.getElementById('assignOrderButton'),
    submitButton: document.getElementById('submitChangesButton'),
    calculateBuyoutBtn: document.getElementById('calculate-buyout-btn'),
    deleteEshopButton: document.getElementById('deleteSelectedEshopButton')
};

export function initializeDOM() {
    document.addEventListener('DOMContentLoaded', () => {
        debugLog("✅ JavaScript loaded successfully!");
    });
}