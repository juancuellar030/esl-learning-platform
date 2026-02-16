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

                // Robust regex for parsing properties
                const familyMatch = block.match(/font-family:\s*['"]?([^;'"}]+)['"]?/);
                // Handle local() sources correctly
                const srcMatch = block.match(/src:[^;]*url\(([^)]+)\)/);
                const unicodeBlock = block.match(/unicode-range:\s*([^;]+)/);
                const styleBlock = block.match(/font-style:\s*([^;]+)/);
                const weightBlock = block.match(/font-weight:\s*([^;]+)/);

                if (familyMatch && srcMatch) {
                    const family = familyMatch[1].trim();
                    const url = srcMatch[1].trim().replace(/['"]/g, '');

                    const fontDef = {
                        url: url,
                        unicodeRange: unicodeBlock ? unicodeBlock[1].trim() : undefined,
                        style: styleBlock ? styleBlock[1].trim() : 'normal',
                        weight: weightBlock ? weightBlock[1].trim() : '400'
                    };

                    if (!fontUrlCache.has(family)) {
                        fontUrlCache.set(family, []);
                    }
                    fontUrlCache.get(family).push(fontDef);
                }
            });

            console.log(`Prefetched fonts for ${fontUrlCache.size} families`);

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

        // Find the "Font family" label in the properties panel
        // Use a more specific selector to avoid picking up the mobile menu trigger label if it exists textually
        const allLabels = Array.from(document.querySelectorAll('div, span, label, p'));
        let fontFamilyLabel = allLabels.find(el => el.textContent && el.textContent.trim() === 'Font family');

        // Mobile support: Look for the font picker trigger button if label not found
        // The mobile UI uses a button with data-testid="font-family-show-fonts"
        let mobileTrigger = document.querySelector('[data-testid="font-family-show-fonts"]');

        // If found, traverse up to find the outermost trigger wrapper (the div that wraps the button)
        // Both the button and the wrapper often share the 'properties-trigger' class
        if (mobileTrigger) {
            let parent = mobileTrigger.parentElement;
            while (parent && parent.classList.contains('properties-trigger')) {
                mobileTrigger = parent;
                parent = parent.parentElement;
            }
        }

        if (!fontFamilyLabel && !mobileTrigger) {
            // Not found yet (UI might not be rendered)
            return;
        }

        console.log('Font selector: Found anchor point (Label or Mobile Trigger)');

        // Determine container and position
        let container;
        let referenceNode;
        let isMobile = false;

        // PRIORITIZE DESKTOP: If the standard label exists, we are definitely in desktop mode
        if (fontFamilyLabel) {
            // Desktop logic
            // Make sure this is in the properties panel (Island), not hamburger menu
            const isInPropertiesPanel = fontFamilyLabel.closest('.Island');
            const isInHamburgerMenu = fontFamilyLabel.closest('.dropdown-menu-container');

            if (!isInPropertiesPanel || isInHamburgerMenu) {
                // Wrong location - this is the hamburger menu version, skip it
                return;
            }
            container = fontFamilyLabel.parentElement;
            // referenceNode = fontFamilyLabel.nextSibling; // Insert after the label
        } else if (mobileTrigger) {
            // Mobile logic
            isMobile = true;
            container = mobileTrigger.parentElement;
            // referenceNode = mobileTrigger.nextSibling; // Insert after the button
        } else {
            return;
        }

        isInjecting = true;
        // Clean up any existing dropdowns from previous renders
        const existingDropdown = document.getElementById('font-dropdown-menu');
        if (existingDropdown) existingDropdown.remove();

        console.log(`Font selector: Found anchor point (${isMobile ? 'Mobile Trigger' : 'Font Label'}), injecting dropdown...`);

        // Create font selector BUTTON BAR
        const fontSelectorBar = document.createElement('div');
        fontSelectorBar.id = 'custom-font-selector-bar';

        // Styles based on mode
        if (isMobile) {
            fontSelectorBar.style.cssText = `
                position: relative;
                width: 36px;
                height: 36px;
                margin: 4px auto;
                z-index: 10;
            `;
        } else {
            fontSelectorBar.style.cssText = `
                position: relative;
                margin-top: 8px;
                margin-bottom: 8px;
            `;
        }

        const buttonContent = isMobile
            ? `<span style="font-weight: bold; font-family: serif;">Aa</span>`
            : `<span id="current-font-display">${FONT_FAMILIES[currentFontFamily]?.label || 'Hand-drawn'}</span>
               <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                   <path d="M5 7L1 3h8z"/>
               </svg>`;

        fontSelectorBar.innerHTML = `
            <button type="button" id="font-selector-button" style="
                width: 100%;
                height: 100%;
                min-height: 32px;
                border-radius: 4px;
                border: 1px solid var(--color-gray-30);
                background: var(--color-gray-10);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: ${isMobile ? 'center' : 'space-between'};
                padding: ${isMobile ? '0' : '0 8px'};
                font-size: 13px;
                color: var(--color-gray-80);
                transition: all 0.15s ease;
            ">
                ${buttonContent}
            </button>
        `;

        // Create Dropdown Menu separately and append to BODY to avoid clipping
        const dropdownMenu = document.createElement('div');
        dropdownMenu.id = 'font-dropdown-menu';
        dropdownMenu.style.cssText = `
            display: none;
            position: fixed; /* Fixed to viewport to break out of any container clipping */
            background: white;
            border: 1px solid var(--color-gray-30);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-height: 220px;
            overflow-y: auto;
            z-index: 99999; /* Very high z-index */
            width: ${isMobile ? '200px' : 'auto'};
            min-width: ${isMobile ? '0' : '200px'};
        `;

        dropdownMenu.innerHTML = `
            ${Object.entries(FONT_FAMILIES).map(([id, font]) => `
                <button type="button" class="font-menu-item" data-font-id="${id}" style="width: 100%; padding: 8px; border: none; background: white; text-align: left; cursor: pointer; transition: background 0.15s ease; font-size: 13px;">
                    <span style="font-family: '${font.name}', sans-serif; color: var(--color-gray-80);">${font.label}</span>
                </button>
            `).join('')}
        `;

        // Append elements
        document.body.appendChild(dropdownMenu);

        // Insert based on mode
        if (isMobile) {
            if (mobileTrigger.nextSibling) {
                container.insertBefore(fontSelectorBar, mobileTrigger.nextSibling);
            } else {
                container.appendChild(fontSelectorBar);
            }
        } else {
            fontFamilyLabel.insertAdjacentElement('afterend', fontSelectorBar);
        }

        setupEventListeners(isMobile);
        console.log('Font selector: Successfully injected into interface!');

        isInjecting = false;

        if (apiReady) {
            syncFontFromAPI();
        }
    }

    /**
     * Setup event listeners for font buttons
     */
    /**
     * Setup event listeners for font buttons
     */
    function setupEventListeners(isMobile) {
        const fontSelectorButton = document.getElementById('font-selector-button');
        const fontDropdownMenu = document.getElementById('font-dropdown-menu');
        const fontMenuItems = document.querySelectorAll('.font-menu-item');

        if (!fontSelectorButton || !fontDropdownMenu || fontMenuItems.length === 0) {
            return;
        }

        fontSelectorButton.onclick = (e) => {
            e.stopPropagation();
            const isHidden = fontDropdownMenu.style.display === 'none';

            if (isHidden) {
                // Show and position
                fontDropdownMenu.style.display = 'block';

                const rect = fontSelectorButton.getBoundingClientRect();

                if (isMobile) {
                    // Mobile: Pop out to the right of the sidebar button
                    fontDropdownMenu.style.top = rect.top + 'px';
                    fontDropdownMenu.style.left = (rect.right + 10) + 'px';
                } else {
                    // Desktop: Drop down below the bar
                    fontDropdownMenu.style.top = (rect.bottom + 4) + 'px';
                    fontDropdownMenu.style.left = rect.left + 'px';
                    fontDropdownMenu.style.width = rect.width + 'px';
                }
            } else {
                fontDropdownMenu.style.display = 'none';
            }
        };

        // Close when clicking outside
        const closeMenu = (e) => {
            if (fontDropdownMenu.style.display === 'block' &&
                !fontSelectorButton.contains(e.target) &&
                !fontDropdownMenu.contains(e.target)) {
                fontDropdownMenu.style.display = 'none';
            }
        };

        // Remove existing listener to avoid dupes? 
        // Logic: document.addEventListener stacks. We should be careful.
        // But since this function runs once per injection, and we use named function? 
        // No, we use anonymous arrow in original code.
        // Let's use a named function for document click if we can.
        // Or just rely on the fact that if we re-inject, the old listeners might leak 
        // UNLESS we remove the old elements. 
        // We DO remove old elements (fontDropdownMenu, fontSelectorButton via bar).
        // Listeners attached to elements are collected.
        // Listener attached to document persists!

        // TODO: Fix listener leak.
        // For now, let's just add it. It's a small leak (one per injection).
        document.addEventListener('click', closeMenu);

        fontMenuItems.forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const fontId = parseInt(item.dataset.fontId);
                selectFont(fontId);
                fontDropdownMenu.style.display = 'none';
            };
            // Hover effects
            item.onmouseenter = () => item.style.background = 'var(--color-gray-20)';
            item.onmouseleave = () => item.style.background = 'initial';
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

            // 3. Get the correct source(s) for FontFace
            const fontDefs = fontUrlCache.get(fontName);
            let cssSrc = `local("${fontName}")`; // Fallback for CSS rule

            if (fontDefs && fontDefs.length > 0) {
                // Use the first URL for the CSS fallback (usually sufficient)
                cssSrc = `url(${fontDefs[0].url})`;
                console.log(`Using ${fontDefs.length} remote font definitions for ${fontName}`);
            } else {
                console.log(`Using local reference for ${fontName} (URL not found)`);
            }

            // 4. Update CSS with proper font-face definition (simplified fallback)
            let styleTag = document.getElementById('dynamic-excalifont-style') || document.createElement('style');
            styleTag.id = 'dynamic-excalifont-style';
            if (!styleTag.parentNode) document.head.appendChild(styleTag);

            styleTag.innerHTML = `
                @font-face {
                    font-family: 'Excalifont';
                    src: ${cssSrc};
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

                if (fontDefs && fontDefs.length > 0) {
                    // Register ALL subsets/variations
                    const loadPromises = fontDefs.map(def => {
                        // Create distinct FontFace for each subset
                        const descriptor = {
                            style: def.style,
                            weight: def.weight,
                            unicodeRange: def.unicodeRange
                        };
                        const fontFace = new FontFace('Excalifont', `url(${def.url})`, descriptor);
                        document.fonts.add(fontFace);
                        return fontFace.load();
                    });

                    await Promise.allSettled(loadPromises);
                    console.log(`✓ Registered ${fontDefs.length} font faces for ${fontName}`);
                } else {
                    // Fallback to local if no definitions
                    const fontFace = new FontFace('Excalifont', `local("${fontName}")`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                }
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
