/**
 * Custom Font Selector for Excalidraw Board
 * Provides a dropdown UI for selecting fonts instead of icon buttons
 */

(function () {
    'use strict';

    const FONT_FAMILIES = {
        1: { name: 'Virgil', label: 'Hand-drawn' },
        2: { name: 'Helvetica', label: 'Normal' },
        3: { name: 'Cascadia', label: 'Code' },
        4: { name: 'Excalifont', label: 'Excalifont' }
    };

    let currentFontFamily = 1; // Default to Virgil

    /**
     * Create the custom font selector UI
     */
    function createFontSelector() {
        // Check if we already injected
        if (document.getElementById('custom-font-btn')) {
            return true;
        }

        // Strategy: Find the specific "Font family" label in the properties panel
        let keyElement = null;

        // Get all potential elements with "Font family" text
        const allCandidates = Array.from(document.querySelectorAll('div, span, p, label, h2, h3, h4'));
        const candidates = allCandidates.filter(el =>
            el.textContent &&
            el.textContent.trim() === 'Font family' &&
            !el.querySelector('*') && // Must be a leaf node or close to it (text only)
            el.offsetParent !== null // Must be visible
        );

        if (candidates.length > 0) {
            // Usually the sidebar label is one of these. 
            // We can try to pick the best one (e.g., inside an .Island or .sidebar)
            // But usually there's only one visible "Font family" label in the UI
            keyElement = candidates[0];
            console.log('Found "Font family" label:', keyElement);
        }

        if (!keyElement) {
            // Fallback: search for other anchors like "Stroke" or "Font size" and try to find relative position
            // ... (Skipping for now, assume exact text match works for the label)
            console.warn('Font family label not found, retrying...');

            // Retry logic
            if (!window.fontSelectorRetries) window.fontSelectorRetries = 0;
            if (window.fontSelectorRetries < 20) {
                window.fontSelectorRetries++;
                setTimeout(createFontSelector, 200);
            }
            return false;
        }

        const fontFamilySection = keyElement;


        console.log('Font family section found!', fontFamilySection);
        // Create container for our custom font selector
        const fontSelectorContainer = document.createElement('div');
        fontSelectorContainer.className = 'custom-font-selector-menu';
        fontSelectorContainer.innerHTML = `
            <div class="custom-font-dropdown-menu">
                <button class="custom-font-button-menu" id="custom-font-btn">
                    <span id="current-font-name">${FONT_FAMILIES[currentFontFamily].label}</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M5 7L1 3h8z"/>
                    </svg>
                </button>
                <div class="custom-font-menu" id="custom-font-menu" style="display: none;">
                    ${Object.entries(FONT_FAMILIES).map(([id, font]) => `
                        <button class="custom-font-option" data-font-id="${id}">
                            <span style="font-family: ${font.name}, system-ui">${font.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Insert it in the DOM - try to find the best parent
        // Insert it in the DOM

        // In Excalidraw sidebar, the structure is often:
        // <div>
        //   <div class="label">Font family</div>
        //   <div class="controls">...buttons...</div> 
        // </div>
        // OR simply flat siblings.

        // We want to insert AFTER the "Style" buttons (which we hid).
        // Since we hid them, we can just append to the parent of the label, 
        // effectively placing it after the label.

        const parent = fontFamilySection.parentNode;

        if (parent) {
            // Check if there's a container element for the font options that we should perform surgery on
            // Just appending to the parent of the label usually works for stacking

            // Try to put it after the label
            if (fontFamilySection.nextSibling) {
                parent.insertBefore(fontSelectorContainer, fontFamilySection.nextSibling);
            } else {
                parent.appendChild(fontSelectorContainer);
            }
        } else {
            console.error('Font family label has no parent?');
        }

        // Add event listeners
        setupEventListeners();

        console.log('Custom font selector injected successfully');
        return true;
    }

    /**
     * Setup event listeners for dropdown
     */
    function setupEventListeners() {
        const dropdownBtn = document.getElementById('custom-font-btn');
        const menu = document.getElementById('custom-font-menu');
        const options = document.querySelectorAll('.custom-font-option');

        if (!dropdownBtn || !menu) return;

        // Toggle dropdown
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = menu.style.display === 'block';
            menu.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });

        // Handle font selection
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const fontId = parseInt(option.dataset.fontId);
                selectFont(fontId);
                menu.style.display = 'none';
            });
        });
    }

    /**
     * Select a font and update Excalidraw
     */
    function selectFont(fontId) {
        currentFontFamily = fontId;

        // Update UI
        const currentFontName = document.getElementById('current-font-name');
        if (currentFontName) {
            currentFontName.textContent = FONT_FAMILIES[fontId].label;
        }

        // Find and click the corresponding Excalidraw button
        const buttons = document.querySelectorAll('button[aria-label]');
        const targetButton = Array.from(buttons).find(btn => {
            const label = btn.getAttribute('aria-label');
            return label && label.includes(FONT_FAMILIES[fontId].label);
        });

        if (targetButton) {
            targetButton.click();
            console.log(`Font changed to: ${FONT_FAMILIES[fontId].label}`);
        } else {
            console.warn('Could not find Excalidraw font button');
        }
    }

    /**
     * Monitor for font changes from Excalidraw's UI
     */
    function monitorFontChanges() {
        // Watch for changes in Excalidraw's state
        const observer = new MutationObserver(() => {
            const buttons = document.querySelectorAll('button[aria-label][aria-pressed="true"]');
            buttons.forEach(btn => {
                const label = btn.getAttribute('aria-label');
                const fontEntry = Object.entries(FONT_FAMILIES).find(([_, font]) =>
                    label && label.includes(font.label)
                );

                if (fontEntry) {
                    const [fontId, _] = fontEntry;
                    const newFontId = parseInt(fontId);
                    if (newFontId !== currentFontFamily) {
                        currentFontFamily = newFontId;
                        const currentFontName = document.getElementById('current-font-name');
                        if (currentFontName) {
                            currentFontName.textContent = FONT_FAMILIES[newFontId].label;
                        }
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['aria-pressed'],
            subtree: true
        });
    }

    /**
     * Initialize the font selector
     */
    function init() {
        let attempts = 0;
        const maxAttempts = 50;

        const initInterval = setInterval(() => {
            attempts++;

            if (createFontSelector()) {
                clearInterval(initInterval);
                monitorFontChanges();
                console.log('Custom font selector initialized');
            } else if (attempts >= maxAttempts) {
                clearInterval(initInterval);
                console.error('Failed to initialize custom font selector');
            }
        }, 200);
    }

    // Wait for Excalidraw to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();
