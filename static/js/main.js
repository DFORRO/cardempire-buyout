// main.js (updated)
import { debugLog } from './debug.js';
import { elements, initializeDOM } from './dom.js';
import { initializeBuyoutForm } from './buyout-form.js';
import { initializeAdminPanel, assignOrderHandler, updateOrderItemsHandler } from './admin-panel.js';
import { handleImageDisplay } from './image-utils.js';
import { totalBuyoutAmount } from './order-utils.js';
import { deleteSelectedEshopItems } from './eshop-utils.js';

initializeDOM();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Select2
    if (typeof $ !== 'undefined' && typeof $.fn.select2 !== 'undefined') {
        $('#eshop-product-dropdown, #product').select2({
            placeholder: "-- Select a Product --",
            allowClear: true,
            width: '100%'
        });
        debugLog("✅ Select2 initialized for dropdowns.");
    } else {
        debugLog("⚠️ jQuery or Select2 not loaded.");
    }

    // Initialize image display for buttons with data-product-id
    document.querySelectorAll('[data-product-id]').forEach(button => {
        button.addEventListener('click', handleImageDisplay, { once: false });
        debugLog(`✅ Added click listener to button with data-product-id: ${button.getAttribute('data-product-id')}`);
    });
});

if (elements.buyoutForm) {
    initializeBuyoutForm();
}

if (elements.orderSelect) {
    initializeAdminPanel();
}

if (elements.assignButton) {
    elements.assignButton.addEventListener('click', assignOrderHandler);
}

if (elements.submitButton) {
    elements.submitButton.addEventListener('click', updateOrderItemsHandler);
}

if (elements.calculateBuyoutBtn) {
    elements.calculateBuyoutBtn.addEventListener('click', totalBuyoutAmount);
} else {
    debugLog("⚠️ Button #calculate-buyout-btn not found – skipping.");
}

if (elements.deleteEshopButton) {
    elements.deleteEshopButton.addEventListener('click', deleteSelectedEshopItems);
} else {
    debugLog("⚠️ Button #deleteSelectedEshopButton not found.");
}