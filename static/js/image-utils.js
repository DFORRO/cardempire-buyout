// image-utils.js (updated)
import { debugLog } from './debug.js';

// Globálna premenná na sledovanie aktuálne zobrazeného productId
let currentProductId = null;

export function handleImageDisplay(event) {
    const productId = event.target.getAttribute('data-product-id');
    if (!productId) return;

    const button = event.target;
    const container = document.getElementById('order-image-container');
    if (!container) return;

    debugLog(`Handling image display for productId: ${productId}, currentProductId: ${currentProductId}`);

    // Skry a vyčisti kontajner, ak je zobrazený (aj keď je to ten istý produkt)
    if (container.style.display === 'block') {
        container.style.display = 'none';
        container.innerHTML = ''; // Vyčisti obsah
        container.style.background = 'transparent'; // Zabránime bielemu pozadiu
        container.style.border = 'none'; // Odstránime okraj
        container.style.boxShadow = 'none'; // Odstránime tieň
        container.style.padding = '0'; // Odstránime vnútorné odsadenie
        currentProductId = null; // Reset aktuálne zobrazeného produktu
        return; // Obrázok zmizne po kliknutí na tlačidlo
    }

    // Vyčisti kontajner pred načítaním nového obrázka
    container.innerHTML = '';
    container.style.display = 'none';
    container.style.background = 'transparent'; // Zabránime bielemu pozadiu
    container.style.border = 'none'; // Odstránime okraj
    container.style.boxShadow = 'none'; // Odstránime tieň
    container.style.padding = '0'; // Odstránime vnútorné odsadenie

    // Odstráň existujúce event listenery, ak nejaké sú
    const existingImage = container.querySelector('img');
    if (existingImage) {
        existingImage.removeEventListener('click', existingImage.clickHandler);
    }

    const imagePath = `/static/images/cards/${productId}.png`;

    const image = new Image();
    image.src = imagePath;
    image.alt = `Product Image for ID ${productId}`;
    Object.assign(image.style, {
        width: '180px',
        height: '250px',
        borderRadius: '8px',
        boxShadow: '2px 4px 10px rgba(0,0,0,0.3)',
        display: 'block',
        marginTop: '10px'
    });

    // Nastavenie pozície
    const buttonRect = button.getBoundingClientRect();
    Object.assign(container.style, {
        position: 'absolute',
        top: `${window.scrollY + buttonRect.bottom + 10}px`,
        left: `${window.scrollX + buttonRect.left}px`,
        zIndex: '1000'
    });

    // Handler pre odstránenie po kliknutí na obrázok (voliteľné, ak chceš zachovať túto funkcionalitu)
    const clickHandler = () => {
        container.style.display = 'none';
        container.innerHTML = '';
        container.style.background = 'transparent';
        container.style.border = 'none';
        container.style.boxShadow = 'none';
        container.style.padding = '0';
        currentProductId = null; // Reset aktuálne zobrazeného produktu
    };
    
    image.clickHandler = clickHandler;
    image.addEventListener('click', clickHandler, { once: true });

    image.onload = () => {
        container.appendChild(image);
        container.style.display = 'block';
        container.style.background = 'white'; // Obnovíme biele pozadie, ak je obrázok načítaný
        container.style.border = '1px solid #ddd'; // Obnovíme okraj
        container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; // Obnovíme tieň
        container.style.padding = '5px'; // Obnovíme padding
        currentProductId = productId; // Ulož aktuálne zobrazený produkt
    };

    image.onerror = () => {
        debugLog(`❌ Image not found: ${imagePath}`);
        // Skúsime defaultný obrázok
        const defaultImage = new Image();
        defaultImage.src = '/static/images/cards/default.png';
        defaultImage.alt = 'Default Image';
        Object.assign(defaultImage.style, {
            width: '180px',
            height: '250px',
            borderRadius: '8px',
            boxShadow: '2px 4px 10px rgba(0,0,0,0.3)',
            display: 'block',
            marginTop: '10px'
        });

        defaultImage.onload = () => {
            container.appendChild(defaultImage);
            container.style.display = 'block';
            container.style.background = 'white'; // Obnovíme biele pozadie, ak je defaultný obrázok načítaný
            container.style.border = '1px solid #ddd'; // Obnovíme okraj
            container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; // Obnovíme tieň
            container.style.padding = '5px'; // Obnovíme padding
            currentProductId = productId; // Ulož aktuálne zobrazený produkt (pre default)
        };

        defaultImage.onerror = () => {
            debugLog(`❌ Default image not found: /static/images/cards/default.png`);
            container.style.display = 'none'; // Skry kontajner namiesto zobrazenia placholderu
            container.innerHTML = ''; // Vyčisti obsah
            container.style.background = 'transparent'; // Zabránime bielemu pozadiu
            container.style.border = 'none'; // Odstránime okraj
            container.style.boxShadow = 'none'; // Odstránime tieň
            container.style.padding = '0'; // Odstránime padding
            currentProductId = null; // Reset aktuálne zobrazeného produktu
        };

        defaultImage.clickHandler = clickHandler;
        defaultImage.addEventListener('click', clickHandler, { once: true });
    };
}

export function showBuyoutProductImage(productId) {
    const imageContainer = document.getElementById('buyout-product-image-container');
    if (!imageContainer) {
        debugLog("⚠️ Image container #buyout-product-image-container not found.");
        return;
    }
    imageContainer.innerHTML = '';

    if (!productId) {
        debugLog("⚠️ No valid product ID provided. Skipping image load.");
        return;
    }

    const img = new Image();
    img.src = `/static/images/cards/${productId}.png`;
    img.alt = 'Product Image';
    Object.assign(img.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '8px',
        boxShadow: '2px 4px 10px rgba(0,0,0,0.3)'
    });

    img.onload = () => {
        imageContainer.appendChild(img);
        imageContainer.style.display = 'block';
        imageContainer.style.background = 'white';
        imageContainer.style.border = '1px solid #ddd';
        imageContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        imageContainer.style.padding = '5px';
    };

    img.onerror = () => {
        debugLog(`❌ Image not found: ${img.src}`);
        // Skúsime defaultný obrázok
        const defaultImg = new Image();
        defaultImg.src = '/static/images/cards/default.png';
        defaultImg.alt = 'Default Image';
        Object.assign(defaultImg.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px',
            boxShadow: '2px 4px 10px rgba(0,0,0,0.3)'
        });

        defaultImg.onload = () => {
            imageContainer.appendChild(defaultImg);
            imageContainer.style.display = 'block';
            imageContainer.style.background = 'white';
            imageContainer.style.border = '1px solid #ddd';
            imageContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
            imageContainer.style.padding = '5px';
        };

        defaultImg.onerror = () => {
            debugLog(`❌ Default image not found: /static/images/cards/default.png`);
            imageContainer.style.display = 'none'; // Skry kontajner namiesto zobrazenia placholderu
            imageContainer.innerHTML = ''; // Vyčisti obsah
            imageContainer.style.background = 'transparent';
            imageContainer.style.border = 'none';
            imageContainer.style.boxShadow = 'none';
            imageContainer.style.padding = '0';
        };
    };

    debugLog(`🖼️ Loading buyout image: ${img.src}`);
}

export function showProductImage(productId, button) {
    // This function can be deprecated or removed since handleImageDisplay now handles this logic
    debugLog("⚠️ showProductImage is deprecated. Use handleImageDisplay instead.");
}

export function removeProductImage(container) {
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
        container.style.background = 'transparent';
        container.style.border = 'none';
        container.style.boxShadow = 'none';
        container.style.padding = '0';
    }
}