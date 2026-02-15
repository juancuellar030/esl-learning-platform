/**
 * Excalidraw API Bridge
 * This script waits for Excalidraw to load and exposes its API to our custom save/load system
 */

(function () {
    'use strict';

    console.log('Excalidraw API Bridge initializing...');

    // Wait for Excalidraw to be ready
    let checkCount = 0;
    const maxChecks = 100; // 10 seconds max

    const checkInterval = setInterval(() => {
        checkCount++;

        // Look for the Excalidraw root element
        const root = document.getElementById('root');
        if (!root) {
            if (checkCount >= maxChecks) {
                console.error('Excalidraw root element not found');
                clearInterval(checkInterval);
            }
            return;
        }

        // Try to access the Excalidraw instance through React internals
        const reactKey = Object.keys(root).find(key => key.startsWith('__react'));
        if (reactKey) {
            const reactInstance = root[reactKey];
            if (reactInstance && reactInstance.child) {
                try {
                    // Navigate the React fiber tree to find Excalidraw component
                    let fiber = reactInstance.child;
                    let excalidrawInstance = null;

                    // Search for the Excalidraw component
                    const searchFiber = (currentFiber, depth = 0) => {
                        if (depth > 20) return null; // Prevent infinite loops

                        if (currentFiber && currentFiber.stateNode) {
                            // Check if this looks like the Excalidraw instance
                            if (typeof currentFiber.stateNode.updateScene === 'function') {
                                return currentFiber.stateNode;
                            }
                        }

                        if (currentFiber && currentFiber.child) {
                            const result = searchFiber(currentFiber.child, depth + 1);
                            if (result) return result;
                        }

                        if (currentFiber && currentFiber.sibling) {
                            return searchFiber(currentFiber.sibling, depth + 1);
                        }

                        return null;
                    };

                    excalidrawInstance = searchFiber(fiber);

                    if (excalidrawInstance) {
                        // Create API wrapper
                        window.excalidrawAPI = {
                            getSceneElements: () => {
                                try {
                                    return excalidrawInstance.getSceneElements?.() || [];
                                } catch (e) {
                                    console.error('Error getting scene elements:', e);
                                    return [];
                                }
                            },

                            getAppState: () => {
                                try {
                                    return excalidrawInstance.state || excalidrawInstance.getAppState?.() || {};
                                } catch (e) {
                                    console.error('Error getting app state:', e);
                                    return {};
                                }
                            },

                            getFiles: () => {
                                try {
                                    return excalidrawInstance.files || {};
                                } catch (e) {
                                    console.error('Error getting files:', e);
                                    return {};
                                }
                            },

                            updateScene: (sceneData) => {
                                try {
                                    if (excalidrawInstance.updateScene) {
                                        excalidrawInstance.updateScene(sceneData);
                                    } else {
                                        console.warn('updateScene method not available');
                                    }
                                } catch (e) {
                                    console.error('Error updating scene:', e);
                                }
                            },

                            exportToBlob: async (options = {}) => {
                                try {
                                    // Try to use the built-in export if available
                                    if (excalidrawInstance.exportToBlob) {
                                        return await excalidrawInstance.exportToBlob(options);
                                    }

                                    // Fallback: Capture the canvas directly at full quality
                                    console.log('Using canvas-based PNG export fallback');

                                    // Find all canvas elements (Excalidraw uses multiple layers)
                                    const canvases = Array.from(document.querySelectorAll('canvas'));
                                    const excalidrawCanvas = canvases.find(c =>
                                        c.width > 100 && c.height > 100 && c.style.position !== 'absolute'
                                    ) || canvases[0];

                                    if (!excalidrawCanvas) {
                                        throw new Error('Canvas not found');
                                    }

                                    // Get the canvas context to ensure it's rendered
                                    const ctx = excalidrawCanvas.getContext('2d');

                                    // Export at maximum quality
                                    return new Promise((resolve, reject) => {
                                        try {
                                            excalidrawCanvas.toBlob((blob) => {
                                                if (blob) {
                                                    resolve(blob);
                                                } else {
                                                    reject(new Error('Failed to create blob'));
                                                }
                                            }, options.mimeType || 'image/png', 1.0); // Maximum quality
                                        } catch (err) {
                                            reject(err);
                                        }
                                    });
                                } catch (e) {
                                    console.error('Error exporting to blob:', e);
                                    return null;
                                }
                            },

                            exportToSvg: async () => {
                                try {
                                    // Try to use the built-in export if available
                                    if (excalidrawInstance.exportToSvg) {
                                        return await excalidrawInstance.exportToSvg();
                                    }

                                    // Fallback: Try to find SVG element in the Excalidraw container
                                    console.log('Using SVG extraction fallback');
                                    const svgElement = document.querySelector('.excalidraw svg, svg.excalidraw__svg');

                                    if (svgElement) {
                                        return svgElement.cloneNode(true);
                                    }

                                    // If no SVG, try to convert canvas to SVG (basic approach)
                                    console.warn('SVG export not fully supported, returning null');
                                    return null;
                                } catch (e) {
                                    console.error('Error exporting to SVG:', e);
                                    return null;
                                }
                            }
                        };

                        console.log('✓ Excalidraw API Bridge ready!');
                        clearInterval(checkInterval);

                        // Inform that API is ready
                        window.dispatchEvent(new Event('excalidrawReady'));
                        return;
                    }
                } catch (e) {
                    console.error('Error accessing Excalidraw instance:', e);
                }
            }
        }

        if (checkCount >= maxChecks) {
            console.warn('Could not find Excalidraw instance. Some features may not work.');
            console.log('Creating fallback API...');

            // Create a fallback API that works with localStorage
            window.excalidrawAPI = {
                elements: [],
                appState: {},
                files: {},

                getSceneElements: () => window.excalidrawAPI.elements,
                getAppState: () => window.excalidrawAPI.appState,
                getFiles: () => window.excalidrawAPI.files,

                updateScene: (sceneData) => {
                    if (sceneData.elements) window.excalidrawAPI.elements = sceneData.elements;
                    if (sceneData.appState) window.excalidrawAPI.appState = sceneData.appState;
                    if (sceneData.files) window.excalidrawAPI.files = sceneData.files;

                    // Try to update via localStorage which Excalidraw watches
                    try {
                        const key = 'excalidraw';
                        const data = JSON.stringify(sceneData);
                        localStorage.setItem(key, data);

                        // Trigger storage event
                        window.dispatchEvent(new StorageEvent('storage', {
                            key: key,
                            newValue: data,
                            url: window.location.href
                        }));
                    } catch (e) {
                        console.error('Error updating via localStorage:', e);
                    }
                },

                exportToBlob: async () => null,
                exportToSvg: async () => null
            };

            console.log('✓ Fallback API created');
            window.dispatchEvent(new Event('excalidrawReady'));
            clearInterval(checkInterval);
        }
    }, 100);
})();
