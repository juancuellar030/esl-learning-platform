/**
 * Board Storage Manager
 * Handles local save/load operations for the Excalidraw board
 */

class BoardStorage {
    constructor() {
        this.AUTO_SAVE_KEY = 'excalidraw_autosave';
        this.AUTO_SAVE_INTERVAL = 30000; // 30 seconds
        this.autoSaveTimer = null;
    }

    /**
     * Initialize storage system
     */
    init() {
        console.log('Board Storage initialized');
        this.startAutoSave();
        this.loadAutoSave();
    }

    /**
     * Get current board data from Excalidraw
     */
    getBoardData() {
        try {
            // Access Excalidraw app state
            const appState = window.excalidrawAPI?.getAppState();
            const elements = window.excalidrawAPI?.getSceneElements();
            const files = window.excalidrawAPI?.getFiles();

            if (!elements) {
                console.warn('No board data available');
                return null;
            }

            return {
                type: 'excalidraw',
                version: 2,
                source: 'https://excalidraw.com',
                elements: elements.map(el => ({
                    ...el,
                    // Ensure all required properties are present
                    isDeleted: el.isDeleted || false
                })),
                appState: {
                    viewBackgroundColor: appState?.viewBackgroundColor || '#121212',
                    currentItemFontFamily: appState?.currentItemFontFamily || 1,
                    gridSize: appState?.gridSize || null,
                },
                files: files || {}
            };
        } catch (error) {
            console.error('Error getting board data:', error);
            return null;
        }
    }

    /**
     * Load board data into Excalidraw
     */
    loadBoardData(data) {
        try {
            if (!data || !data.elements) {
                throw new Error('Invalid board data');
            }

            // Update the scene with loaded data
            window.excalidrawAPI?.updateScene({
                elements: data.elements,
                appState: data.appState || {},
                files: data.files || {}
            });

            console.log('Board data loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading board data:', error);
            return false;
        }
    }

    /**
     * Save board to local file (download)
     */
    saveToFile(filename = null) {
        const data = this.getBoardData();
        if (!data) {
            alert('No board data to save');
            return;
        }

        // Generate filename with timestamp if not provided
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            filename = `board_${timestamp}.excalidraw`;
        } else if (!filename.endsWith('.excalidraw')) {
            filename += '.excalidraw';
        }

        // Create blob and download
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`Board saved as ${filename}`);
        this.showNotification('Board saved locally', 'success');
    }

    /**
     * Load board from local file (upload)
     */
    loadFromFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.excalidraw,.json';

            input.onchange = async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) {
                        reject('No file selected');
                        return;
                    }

                    const text = await file.text();
                    const data = JSON.parse(text);

                    if (this.loadBoardData(data)) {
                        this.showNotification('Board loaded successfully', 'success');
                        resolve(data);
                    } else {
                        throw new Error('Failed to load board data');
                    }
                } catch (error) {
                    console.error('Error loading file:', error);
                    this.showNotification('Error loading file: ' + error.message, 'error');
                    reject(error);
                }
            };

            input.click();
        });
    }

    /**
     * Export board as PNG image
     */
    async exportAsPNG() {
        try {
            const blob = await window.excalidrawAPI?.exportToBlob({
                mimeType: 'image/png',
                quality: 1,
                exportPadding: 20
            });

            if (!blob) {
                throw new Error('Failed to export image');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `board_${timestamp}.png`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Board exported as PNG', 'success');
        } catch (error) {
            console.error('Error exporting PNG:', error);
            this.showNotification('Error exporting PNG: ' + error.message, 'error');
        }
    }

    /**
     * Export board as SVG
     */
    async exportAsSVG() {
        try {
            const svg = await window.excalidrawAPI?.exportToSvg();
            if (!svg) {
                throw new Error('Failed to export SVG');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `board_${timestamp}.svg`;

            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Board exported as SVG', 'success');
        } catch (error) {
            console.error('Error exporting SVG:', error);
            this.showNotification('Error exporting SVG: ' + error.message, 'error');
        }
    }

    /**
     * Auto-save to localStorage
     */
    autoSave() {
        const data = this.getBoardData();
        if (data && data.elements && data.elements.length > 0) {
            try {
                localStorage.setItem(this.AUTO_SAVE_KEY, JSON.stringify(data));
                console.log('Auto-saved to localStorage');
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }
        }
    }

    /**
     * Load auto-saved data
     */
    loadAutoSave() {
        try {
            const saved = localStorage.getItem(this.AUTO_SAVE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.elements && data.elements.length > 0) {
                    // Ask user if they want to restore
                    const restore = confirm('Auto-saved board found. Do you want to restore it?');
                    if (restore) {
                        this.loadBoardData(data);
                        this.showNotification('Auto-save restored', 'success');
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load auto-save:', error);
        }
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        this.autoSaveTimer = setInterval(() => this.autoSave(), this.AUTO_SAVE_INTERVAL);
        console.log('Auto-save started (every 30 seconds)');
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Clear board
     */
    clearBoard() {
        const confirm = window.confirm('Are you sure you want to clear the board? This cannot be undone.');
        if (confirm) {
            window.excalidrawAPI?.updateScene({
                elements: [],
                appState: {},
                files: {}
            });
            this.showNotification('Board cleared', 'success');
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `board-notification board-notification--${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Export as singleton
window.boardStorage = new BoardStorage();
