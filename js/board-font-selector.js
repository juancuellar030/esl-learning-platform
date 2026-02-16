/**
 * Custom Font Selector for Excalidraw Board
 * Provides a dropdown UI for selecting fonts and uses the Excalidraw API to apply them.
 */

(function () {
    'use strict';

    // Excalidraw Font Family IDs
    // IDs 1-3 are Excalidraw built-in fonts
    // ID 5 is "Excalifont" internally in Excalidraw's canvas renderer
    // We hijack Excalifont's FontFace to render our custom fonts on the canvas
    // All custom fonts (IDs >= 5 in our map) map to apiFontId=5 for Excalidraw
    const FONT_FAMILIES = {
        1: { name: 'Virgil', label: 'Hand-drawn' },
        2: { name: 'Helvetica', label: 'Normal' },
        3: { name: 'Cascadia', label: 'Code' },
        5: { name: 'Poppins', label: 'Poppins' },
        6: { name: 'Happy Monkey', label: 'Happy Monkey' },
        7: { name: 'Roboto', label: 'Roboto' },
        8: { name: 'Chewy', label: 'Chewy' },
        9: { name: 'Pacifico', label: 'Pacifico' },
        10: { name: 'Playfair Display', label: 'Classic Serif' },
        11: { name: 'Bebas Neue', label: 'Bold Display' },
        12: { name: 'Arial', label: 'Arial' },
        13: { name: 'Times New Roman', label: 'Times' },
        14: { name: 'Courier New', label: 'Courier' },
        15: { name: 'Georgia', label: 'Georgia' },
        16: { name: 'Verdana', label: 'Verdana' }
    };

    let currentFontFamily = 1; // Default to Virgil
    let isInjecting = false;
    let apiReady = false;

    // Cache for font URLs
    const fontUrlCache = new Map();
    let fontPrefetchPromise = null;

    // Listen for API bridge ready event
    window.addEventListener('excalidrawReady', () => {
        console.log('Custom Font Selector: Excalidraw API detected.');
        apiReady = true;
        // Prefetch font URLs
        fontPrefetchPromise = prefetchFontUrls();
        syncFontFromAPI();
    });

    /**
     * Fetch and parse Google Fonts CSS to get actual WOFF2 URLs
     * This is needed because Canvas FontFace API requires a URL, not a local name for web fonts
     */
    async function prefetchFontUrls() {
        try {
            // Find the Google Fonts link
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            let fontCssUrl = null;

            for (const link of links) {
                if (link.href && (link.href.includes('fonts.googleapis.com/css') || link.href.includes('fonts.googleapis.com/icon'))) {
                    // We found a google fonts link, but we specifically want the one with our custom fonts
                    if (link.href.includes('Poppins') || link.href.includes('Happy+Monkey')) {
                        fontCssUrl = link.href;
                        break;
                    }
                }
            }

            if (!fontCssUrl) {
                console.warn('Could not find Google Fonts CSS link');
                return;
            }

            console.log(`Fetching font CSS from: ${fontCssUrl}`);
            const response = await fetch(fontCssUrl);
            const cssText = await response.text();

            // formatting: src: url(https://...) format('woff2');
            // We need to map font-family -> url
            // Simple regex to find font-family and src
            // This is a naive parser but sufficient for Google Fonts standard output

            // Split by @font-face blocks
            const blocks = cssText.split('@font-face');

            blocks.forEach(block => {
                if (!block.trim()) return;

                // Robust regex to handle quoted or unquoted family names
                // e.g. font-family: 'Poppins'; or font-family: Poppins;
                const familyMatch = block.match(/font-family:\s*['"]?([^;'"}]+)['"]?/);
                const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);

                if (familyMatch && srcMatch) {
                    const family = familyMatch[1].trim();
                    const url = srcMatch[1].trim().replace(/['"]/g, ''); // Remove quotes from URL if any

                    // We only want the clean URL

                    // We store the first URL found for each family (usually the regular weight)
                    // Improvements could be made to handle weights, but Excalidraw mostly uses regular
                    if (!fontUrlCache.has(family)) {
                        fontUrlCache.set(family, url);
                        // console.log(`Cached URL for ${family}: ${url}`);
                    }
                }
            });
            console.log(`Prefetched ${fontUrlCache.size} font URLs`);

        } catch (e) {
            console.error('Error prefetching font URLs:', e);
        }
    }

    /**
     * Create and inject the custom font selector UI if it doesn't exist  
     * Injects into the properties panel (Island) that appears when text is selected
     */
    function ensureFontSelector() {
        if (isInjecting) return;

        // Check if we already injected
        if (document.getElementById('custom-font-selector-bar')) {
            return;
        }

        // Find "Font family" text in the properties panel
        // The properties panel appears when text is selected
        let fontFamilyLabel = null;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;

        while (node = walker.nextNode()) {
            if (node.textContent && node.textContent.trim() === 'Font family') {
                fontFamilyLabel = node.parentElement;
                break;
            }
        }

        if (!fontFamilyLabel) {
            // Label not found - properties panel probably not open
            return;
        }

        // Make sure this is in the properties panel (Island), not hamburger menu
        const isInPropertiesPanel = fontFamilyLabel.closest('.Island');
        const isInHamburgerMenu = fontFamilyLabel.closest('.dropdown-menu-container');

        if (!isInPropertiesPanel || isInHamburgerMenu) {
            // Wrong location - this is the hamburger menu version, skip it
            return;
        }

        isInjecting = true;
        console.log('Font selector: Found Font family in properties panel, injecting dropdown...');

        // Create font selector UI
        const fontSelectorBar = document.createElement('div');
        fontSelectorBar.id = 'custom-font-selector-bar';
        fontSelectorBar.style.cssText = `
            position: relative;
            margin-top: 8px;
            margin-bottom: 8px;
        `;

        fontSelectorBar.innerHTML = `
            <button type="button" id="font-selector-button" style="
                width: 100%;
                height: 32px;
                border-radius: 4px;
                border: 1px solid var(--color-gray-30);
                background: var(--color-gray-10);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 8px;
                font-size: 13px;
                color: var(--color-gray-80);
                transition: all 0.15s ease;
            ">
                <span id="current-font-display">${FONT_FAMILIES[currentFontFamily]?.label || 'Hand-drawn'}</span>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M5 7L1 3h8z"/>
                </svg>
            </button>
            <div id="font-dropdown-menu" style="
                display: none;
                position: absolute;
                top: 36px;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid var(--color-gray-30);
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                max-height: 220px;
                overflow-y: auto;
                z-index: 10000;
            ">
                ${Object.entries(FONT_FAMILIES).map(([id, font]) => `
                    <button type="button" class="font-menu-item" data-font-id="${id}" style="width: 100%; padding: 8px; border: none; background: white; text-align: left; cursor: pointer; transition: background 0.15s ease; font-size: 13px;">
                        <span style="font-family: '${font.name}', sans-serif; color: var(--color-gray-80);">${font.label}</span>
                    </button>
                `).join('')}
            </div>
        `;

        // Insert after the "Font family" label
        fontFamilyLabel.insertAdjacentElement('afterend', fontSelectorBar);

        setupEventListeners();
        console.log('Font selector: Successfully injected into properties panel!');

        isInjecting = false;

        if (apiReady) {
            syncFontFromAPI();
        }
    }

    /**
     * Setup event listeners for font buttons
     */
    function setupEventListeners() {
        const fontSelectorButton = document.getElementById('font-selector-button');
        const fontDropdownMenu = document.getElementById('font-dropdown-menu');
        const fontMenuItems = document.querySelectorAll('.font-menu-item');

        if (!fontSelectorButton || !fontDropdownMenu || fontMenuItems.length === 0) {
            return;
        }

        fontSelectorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            fontDropdownMenu.style.display = fontDropdownMenu.style.display === 'none' ? 'block' : 'none';
        });

        fontMenuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const fontId = parseInt(item.dataset.fontId);
                selectFont(fontId);
                fontDropdownMenu.style.display = 'none';
            });

            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--color-gray-20)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'initial';
            });
        });

        document.addEventListener('click', (e) => {
            if (fontDropdownMenu.style.display === 'block' && !fontSelectorButton.contains(e.target) && !fontDropdownMenu.contains(e.target)) {
                fontDropdownMenu.style.display = 'none';
            }
        });
    }

    /**
     * Dynamically redefine "Excalifont" to the chosen custom font
     * Enhanced to ensure fonts are properly loaded for canvas rendering
     */
    async function updateDynamicFont(fontName) {
        try {
            console.log(`Updating dynamic font to: ${fontName}`);

            // 1. Check if font is already loaded (safe check)
            let fontAvailable = false;
            try {
                fontAvailable = document.fonts.check(`16px "${fontName}"`);
                if (fontAvailable) {
                    console.log(`✓ Font ${fontName} already available`);
                }
            } catch (e) {
                console.log(`Note: Could not check font availability (${e.message})`);
            }

            // 2. Try to load font if not already available (non-blocking)
            if (!fontAvailable) {
                try {
                    await document.fonts.load(`16px "${fontName}"`);
                    console.log(`✓ Loaded font: ${fontName}`);
                } catch (loadError) {
                    // Network error is OK - font is loaded via Google Fonts link in HTML
                    console.log(`Note: Dynamic load failed, using pre-loaded font from Google Fonts`);
                }
            }

            // 3. Get the correct source for FontFace
            const fontUrl = fontUrlCache.get(fontName);
            let source = `local("${fontName}")`;

            if (fontUrl) {
                source = `url(${fontUrl})`;
                console.log(`Using remote URL for ${fontName}`);
            } else {
                console.log(`Using local reference for ${fontName} (URL not found)`);
            }

            // 4. Update CSS with proper font-face definition
            let styleTag = document.getElementById('dynamic-excalifont-style') || document.createElement('style');
            styleTag.id = 'dynamic-excalifont-style';
            if (!styleTag.parentNode) document.head.appendChild(styleTag);

            styleTag.innerHTML = `
                @font-face {
                    font-family: 'Excalifont';
                    src: ${source};
                    font-display: swap;
                }
                /* Override textarea font during editing */
                body.excalidraw-font-5 .excalidraw-textEditorContainer > textarea,
                .excalidraw-textEditorContainer > textarea {
                    font-family: "${fontName}", "Excalifont", sans-serif !important;
                }
                /* Override SVG text rendering */
                .excalidraw text[data-font-family="5"],
                body.excalidraw-font-5 .excalidraw text {
                    font-family: "${fontName}", "Excalifont", sans-serif !important;
                }
            `;

            console.log(`✓ Excalifont hijacked to: ${fontName}`);

            // 5. Register with FontFace API for canvas rendering (Critical for persistent rendering)
            try {
                // Remove old Excalifont registration if exists
                const existingFonts = Array.from(document.fonts).filter(f => f.family === 'Excalifont');
                existingFonts.forEach(f => document.fonts.delete(f));

                // Add new font face pointing to the selected font
                // Note: Canvas requires the font to be loaded via URL usually to work correctly across contexts
                const fontFace = new FontFace('Excalifont', source);
                await fontFace.load();
                document.fonts.add(fontFace);
                console.log(`✓ Font registered in document.fonts`);
            } catch (e) {
                console.log(`Note: FontFace API registration failed (${e.message})`);
            }

            // 5. Force canvas redraw by triggering a scene update
            if (window.excalidrawAPI) {
                setTimeout(() => {
                    try {
                        const appState = window.excalidrawAPI.getAppState();
                        const elements = window.excalidrawAPI.getSceneElements();

                        // Update all text elements with font family 5 to force re-render
                        const updatedElements = elements.map(el => {
                            if (el.type === 'text' && el.fontFamily === 5) {
                                return {
                                    ...el,
                                    version: (el.version || 0) + 1,
                                    versionNonce: Math.random()
                                };
                            }
                            return el;
                        });

                        window.excalidrawAPI.updateScene({
                            elements: updatedElements,
                            appState: { ...appState }
                        });
                        console.log(`✓ Forced canvas re-render for font update`);
                    } catch (e) {
                        console.log(`Could not force re-render: ${e.message}`);
                    }
                }, 100);
            }

            return true;
        } catch (e) {
            console.error(`Error updating font to ${fontName}:`, e);
            return false;
        }
    }

    /**
     * Select a font and apply it via Excalidraw API
     * Enhanced to ensure proper font loading and application
     */
    async function selectFont(fontId) {
        console.log(`Selecting font ID: ${fontId}`);
        currentFontFamily = fontId;
        const font = FONT_FAMILIES[fontId];

        if (!font) {
            console.error(`Font ID ${fontId} not found in FONT_FAMILIES`);
            return;
        }

        const displayElement = document.getElementById('current-font-display');
        if (displayElement) {
            displayElement.textContent = font.label;
        }

        let apiFontId = fontId;
        if (fontId >= 5) {
            apiFontId = 5; // Map all custom fonts to Excalidraw's fontFamily 5 (Excalifont)

            // Ensure prefetch is done before updating
            if (fontPrefetchPromise) {
                await fontPrefetchPromise;
            }

            // Wait for font to be fully loaded before proceeding
            const success = await updateDynamicFont(font.name);
            if (!success) {
                console.error('Failed to update dynamic font');
            }
        }

        // Update body class for CSS targeting
        document.body.classList.remove('excalidraw-font-1', 'excalidraw-font-2', 'excalidraw-font-3', 'excalidraw-font-5');
        document.body.classList.add(`excalidraw-font-${apiFontId}`);

        if (window.excalidrawAPI) {
            const appState = window.excalidrawAPI.getAppState();
            const elements = window.excalidrawAPI.getSceneElements();

            // Update both selected elements and the default font for new text
            const updatedElements = elements.map(el => {
                if (appState.selectedElementIds && appState.selectedElementIds[el.id] && el.type === 'text') {
                    return {
                        ...el,
                        fontFamily: apiFontId,
                        version: (el.version || 0) + 1,
                        versionNonce: Math.random()
                    };
                }
                return el;
            });

            window.excalidrawAPI.updateScene({
                appState: { ...appState, currentItemFontFamily: apiFontId },
                elements: updatedElements,
                commitToHistory: true
            });

            console.log(`✓ Applied font ${font.label} (ID: ${apiFontId}) to Excalidraw`);
        }
    }

    /**
     * Sync local UI state from Excalidraw API state
     */
    function syncFontFromAPI() {
        if (!window.excalidrawAPI) return;

        try {
            const appState = window.excalidrawAPI.getAppState();
            const apiFont = appState.currentItemFontFamily;

            const selectedElements = window.excalidrawAPI.getSceneElements().filter(el =>
                appState.selectedElementIds && appState.selectedElementIds[el.id] && el.type === 'text'
            );

            let effectiveFont = apiFont;
            if (selectedElements.length === 1) {
                effectiveFont = selectedElements[0].fontFamily;
            }

            if (effectiveFont && FONT_FAMILIES[effectiveFont]) {
                const isCustomInAPI = effectiveFont === 5;
                const isCustomInUI = currentFontFamily >= 5;

                if (effectiveFont !== currentFontFamily && !(isCustomInAPI && isCustomInUI)) {
                    currentFontFamily = effectiveFont;
                    const displayElement = document.getElementById('current-font-display');
                    if (displayElement) {
                        displayElement.textContent = FONT_FAMILIES[currentFontFamily].label;
                    }
                    document.body.classList.remove('excalidraw-font-1', 'excalidraw-font-2', 'excalidraw-font-3', 'excalidraw-font-5');
                    document.body.classList.add(`excalidraw-font-${currentFontFamily >= 5 ? 5 : currentFontFamily}`);
                }
            }
        } catch (e) { }
    }

    /**
     * Polling loop to keep UI in sync
     */
    function monitorLoop() {
        // Use both MutationObserver and interval polling for maximum reliability

        // MutationObserver for immediate detection of panel changes
        const observer = new MutationObserver((mutations) => {
            // Check if properties panel exists and needs font selector
            const hasFontFamilyLabel = Array.from(document.querySelectorAll('*')).some(el =>
                el.textContent && el.textContent.trim() === 'Font family'
            );

            if (hasFontFamilyLabel && !document.getElementById('custom-font-selector-bar')) {
                // Small delay to ensure panel is fully rendered
                setTimeout(() => ensureFontSelector(), 50);
            }

            // Sync font from API on any change
            if (window.excalidrawAPI) {
                const appState = window.excalidrawAPI.getAppState();
                if (appState?.currentItemFontFamily && appState.currentItemFontFamily !== currentFontFamily) {
                    syncFontFromAPI();
                }
            }
        });

        // Start observing the entire document for any changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        // Also use interval polling as backup (every 500ms)
        setInterval(() => {
            ensureFontSelector();
            if (window.excalidrawAPI) {
                syncFontFromAPI();
            }
        }, 500);

        console.log('Custom Font Selector: Monitoring for properties panel...');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', monitorLoop);
    } else {
        monitorLoop();
    }

})();
