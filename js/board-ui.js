/**
 * Board UI Controller
 * Manages the user interface for save/load functionality
 */

class BoardUI {
    constructor() {
        this.menuOpen = false;
    }

    /**
     * Initialize the UI
     */
    init() {
        this.createUI();
        this.attachEventListeners();
        console.log('Board UI initialized');
    }

    /**
     * Create UI elements
     */
    createUI() {
        // Create floating action button
        const fab = document.createElement('button');
        fab.className = 'board-fab';
        fab.id = 'board-fab';
        fab.innerHTML = '<i class="fas fa-save"></i>';
        fab.title = 'Save & Load Options';
        document.body.appendChild(fab);

        // Create menu overlay
        const overlay = document.createElement('div');
        overlay.className = 'board-menu-overlay';
        overlay.id = 'board-menu-overlay';
        overlay.innerHTML = this.getMenuHTML();
        document.body.appendChild(overlay);
    }

    /**
     * Get menu HTML content
     */
    getMenuHTML() {
        return `
            <div class="board-menu">
                <div class="board-menu-header">
                    <h2 class="board-menu-title">Board Options</h2>
                    <button class="board-menu-close" id="board-menu-close">&times;</button>
                </div>

                <!-- Local Operations -->
                <div class="board-menu-section">
                    <div class="board-menu-section-title">Local Operations</div>
                    <div class="board-menu-buttons">
                        <button class="board-btn board-btn--primary" onclick="boardStorage.saveToFile()">
                            <i class="fas fa-download"></i> Save to Device
                        </button>
                        <button class="board-btn board-btn--primary" onclick="boardStorage.loadFromFile()">
                            <i class="fas fa-upload"></i> Load from Device
                        </button>
                        <button class="board-btn" onclick="boardStorage.exportAsPNG()">
                            <i class="fas fa-image"></i> Export PNG
                        </button>
                        <button class="board-btn" onclick="boardStorage.exportAsSVG()">
                            <i class="fas fa-file-image"></i> Export SVG
                        </button>
                    </div>
                </div>

                <!-- Google Drive Integration -->
                <div class="board-menu-section">
                    <div class="board-menu-section-title">Google Drive</div>
                    
                    <div id="drive-setup-notice" class="drive-setup-notice">
                        <strong><i class="fas fa-info-circle"></i> Setup Required</strong>
                        To use Google Drive integration, you need to configure your Google Cloud credentials.
                        <br><br>
                        <a href="#" onclick="boardUI.showSetupInstructions(); return false;">
                            Click here for setup instructions
                        </a>
                    </div>
                    
                    <div class="drive-auth-section">
                        <div id="drive-user-info" class="drive-user-info"></div>
                        
                        <button id="drive-sign-in-btn" class="board-btn board-btn--primary" 
                                onclick="googleDrive.signIn()" style="width: 100%;">
                            <i class="fab fa-google"></i> Sign in with Google
                        </button>
                        
                        <button id="drive-sign-out-btn" class="board-btn" 
                                onclick="googleDrive.signOut()" style="display: none; width: 100%;">
                            <i class="fas fa-sign-out-alt"></i> Sign Out
                        </button>
                        
                        <div id="drive-controls" class="drive-controls">
                            <button class="board-btn board-btn--success" onclick="boardUI.promptSaveToDrive()" style="flex: 1;">
                                <i class="fas fa-cloud-upload-alt"></i> Save to Drive
                            </button>
                            <button class="board-btn" onclick="googleDrive.listFiles()" style="flex: 1;">
                                <i class="fas fa-sync-alt"></i> Refresh
                            </button>
                        </div>
                    </div>
                    
                    <div id="drive-file-list" class="drive-file-list"></div>
                </div>

                <!-- Danger Zone -->
                <div class="board-menu-section">
                    <div class="board-menu-section-title">Danger Zone</div>
                    <div class="board-menu-buttons">
                        <button class="board-btn board-btn--danger" onclick="boardStorage.clearBoard()">
                            <i class="fas fa-trash"></i> Clear Board
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // FAB click
        document.getElementById('board-fab').addEventListener('click', () => {
            this.openMenu();
        });

        // Close button
        document.getElementById('board-menu-close').addEventListener('click', () => {
            this.closeMenu();
        });

        // Click outside to close
        document.getElementById('board-menu-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'board-menu-overlay') {
                this.closeMenu();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.menuOpen) {
                this.closeMenu();
            }
        });
    }

    /**
     * Open menu
     */
    openMenu() {
        document.getElementById('board-menu-overlay').classList.add('active');
        this.menuOpen = true;

        // Check if Google Drive is configured
        this.checkDriveSetup();
    }

    /**
     * Close menu
     */
    closeMenu() {
        document.getElementById('board-menu-overlay').classList.remove('active');
        this.menuOpen = false;
    }

    /**
     * Check if Google Drive is configured
     */
    checkDriveSetup() {
        const setupNotice = document.getElementById('drive-setup-notice');
        if (googleDrive.CLIENT_ID.includes('YOUR_CLIENT_ID')) {
            setupNotice.style.display = 'block';
        } else {
            setupNotice.style.display = 'none';
            // Auto-initialize Google Drive if configured
            if (!googleDrive.gapiReady) {
                googleDrive.init();
            }
        }
    }

    /**
     * Prompt for filename when saving to Drive
     */
    promptSaveToDrive() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const defaultName = `board_${timestamp}`;

        const filename = prompt('Enter a name for your board:', defaultName);
        if (filename) {
            googleDrive.saveToDrive(filename);
        }
    }

    /**
     * Show setup instructions modal
     */
    showSetupInstructions() {
        const instructions = `
            <div class="board-menu-section">
                <h3 style="color: white; margin-top: 0;">Google Drive Setup Instructions</h3>
                
                <div style="color: #ccc; line-height: 1.8;">
                    <ol style="padding-left: 20px;">
                        <li>Go to <a href="https://console.cloud.google.com/" target="_blank" style="color: #667eea;">Google Cloud Console</a></li>
                        <li>Create a new project or select an existing one</li>
                        <li>Enable the <strong>Google Drive API</strong></li>
                        <li>Create OAuth 2.0 credentials:
                            <ul style="margin-top: 8px;">
                                <li>Application type: Web application</li>
                                <li>Add authorized JavaScript origins: Your website URL</li>
                                <li>Add authorized redirect URIs: Your website URL</li>
                            </ul>
                        </li>
                        <li>Copy the <strong>Client ID</strong> and <strong>API Key</strong></li>
                        <li>Open <code style="background: #1a1a1a; padding: 2px 6px; border-radius: 3px;">js/google-drive-integration.js</code></li>
                        <li>Replace <code style="background: #1a1a1a; padding: 2px 6px; border-radius: 3px;">YOUR_CLIENT_ID</code> and <code style="background: #1a1a1a; padding: 2px 6px; border-radius: 3px;">YOUR_API_KEY</code> with your credentials</li>
                    </ol>
                    
                    <div style="margin-top: 20px; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 6px; border-left: 3px solid #667eea;">
                        <strong>Note:</strong> For local development, you may need to run the board from a local server (not file:// protocol) for Google Drive authentication to work properly.
                    </div>
                </div>
                
                <button class="board-btn board-btn--primary" onclick="boardUI.closeInstructions()" style="margin-top: 20px;">
                    Got it!
                </button>
            </div>
        `;

        const menu = document.querySelector('.board-menu');
        menu.innerHTML = instructions;
    }

    /**
     * Close instructions and restore menu
     */
    closeInstructions() {
        const menu = document.querySelector('.board-menu');
        menu.innerHTML = this.getMenuHTML();
        this.checkDriveSetup();
    }
}

// Initialize UI when DOM is ready
window.boardUI = new BoardUI();

// Wait for Excalidraw to be ready
function initBoardUI() {
    if (window.excalidrawAPI) {
        window.boardUI.init();
        window.boardStorage.init();
        console.log('Board system ready!');
    } else {
        setTimeout(initBoardUI, 100);
    }
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBoardUI);
} else {
    initBoardUI();
}
