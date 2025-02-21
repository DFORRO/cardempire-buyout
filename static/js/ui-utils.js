// ui-utils.js
import { debugLog } from './debug.js';

export function toggleAccordion(id) {
    const content = document.getElementById(id);
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
    const header = document.querySelector(`.accordion-header[onclick="toggleAccordion('${id}')"]`);
    header.textContent = header.textContent.includes('▼') ? 'Add Item ►' : 'Add Item ▼';
}

export function copyToClipboard() {
    const copyText = document.getElementById("WhereToSendCards");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    document.execCommand("copy");
    alert("Address copied: " + copyText.value);
}

export function toggleAddressFields() {
    const PickupType = document.getElementById('PickupType').value;
    const addressFields = document.querySelectorAll('.address-field');
    addressFields.forEach(field => {
        field.style.display = PickupType === 'Packeta na adresu' ? 'block' : 'none';
        const inputs = field.querySelectorAll('input, select');
        inputs.forEach(input => input.required = PickupType === 'Packeta na adresu');
    });
}

export function populateDropdown(elementId, data, textKey) {
    const dropdown = document.getElementById(elementId);
    dropdown.innerHTML = "";
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = `-- Select ${textKey.charAt(0).toUpperCase() + textKey.slice(1)} --`;
    dropdown.appendChild(defaultOption);
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[textKey];
        option.textContent = item[textKey];
        dropdown.appendChild(option);
    });
    dropdown.disabled = data.length === 0;
}

export function updateDropdown(elementId, data, textKey) {
    const dropdown = document.getElementById(elementId);
    dropdown.innerHTML = "";
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = `-- Select ${textKey.charAt(0).toUpperCase() + textKey.slice(1)} --`;
    dropdown.appendChild(defaultOption);
    if (data.length === 0) {
        debugLog(`Žiadne hodnoty pre ${elementId}`);
        return;
    }
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[textKey];
        option.textContent = item[textKey];
        dropdown.appendChild(option);
    });
    dropdown.disabled = false;
}

export function getFilterParams(fields) {
    const params = fields.map(field => {
        const value = document.getElementById(field)?.value;
        return value ? `${field}=${encodeURIComponent(value)}` : null;
    }).filter(Boolean).join('&');
    return params || null;
}