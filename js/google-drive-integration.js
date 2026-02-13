/**
 * Google Drive Integration for Board Storage
 * Handles OAuth authentication and file operations with Google Drive
 */

class GoogleDriveIntegration {
    constructor() {
        // These will need to be configured with your Google Cloud project
        this.CLIENT_ID = '1041840472824-9ivoi73ufdhirq4afin9avlmtuhpdbn0.apps.googleusercontent.com';
        this.API_KEY = 'AIzaSyBsQX4EOWF26YzPPqOVtiRX04dh6cSv7Bc';
        this.DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';

        this.isSignedIn = false;
        this.gapiReady = false;
        this.currentUser = null;
        this.folderName = 'Excalidraw Boards';
        this.folderId = null;
    }

    /**
     * Initialize Google Drive API
     */
    async init() {
        try {
            // Check if credentials are configured
            if (this.CLIENT_ID.includes('YOUR_CLIENT_ID')) {
                console.warn('Google Drive not configured. Please set up credentials.');
                return false;
            }

            // Load Google API client
            await this.loadGoogleAPI();

            // Initialize the API
            await gapi.client.init({
                apiKey: this.API_KEY,
                clientId: this.CLIENT_ID,
                discoveryDocs: this.DISCOVERY_DOCS,
                scope: this.SCOPES
            });

            // Listen for sign-in state changes
            gapi.auth2.getAuthInstance().isSignedIn.listen((isSignedIn) => {
                this.updateSignInStatus(isSignedIn);
            });

            // Handle initial sign-in state
            this.updateSignInStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

            this.gapiReady = true;
            console.log('Google Drive API initialized');
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive:', error);
            console.error('Error details:', error.details || error.message || error);
            this.showNotification('Failed to initialize Google Drive: ' + (error.message || JSON.stringify(error)), 'error');
            return false;
        }
    }

    /**
     * Load Google API client library
     */
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            // Check if gapi is already available
            if (window.gapi && window.gapi.load) {
                gapi.load('client:auth2', {
                    callback: resolve,
                    onerror: () => reject(new Error('Failed to load Google API client'))
                });
                return;
            }

            // Wait for gapi to become available
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            const checkInterval = setInterval(() => {
                attempts++;
                if (window.gapi && window.gapi.load) {
                    clearInterval(checkInterval);
                    gapi.load('client:auth2', {
                        callback: resolve,
                        onerror: () => reject(new Error('Failed to load Google API client'))
                    });
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('Google API library not loaded. Make sure the script tag is included.'));
                }
            }, 100);
        });
    }

    /**
     * Update sign-in status
     */
    updateSignInStatus(isSignedIn) {
        this.isSignedIn = isSignedIn;
        if (isSignedIn) {
            this.currentUser = gapi.auth2.getAuthInstance().currentUser.get();
            const profile = this.currentUser.getBasicProfile();
            console.log('Signed in as:', profile.getEmail());
            this.updateUI(true, profile.getName(), profile.getEmail());
        } else {
            this.currentUser = null;
            this.updateUI(false);
        }
    }

    /**
     * Sign in to Google
     */
    async signIn() {
        try {
            if (!this.gapiReady) {
                const initialized = await this.init();
                if (!initialized) {
                    throw new Error('Google Drive API not configured');
                }
            }

            await gapi.auth2.getAuthInstance().signIn();
            this.showNotification('Signed in to Google Drive', 'success');
        } catch (error) {
            console.error('Error signing in:', error);
            this.showNotification('Sign-in failed: ' + error.message, 'error');
        }
    }

    /**
     * Sign out from Google
     */
    async signOut() {
        try {
            await gapi.auth2.getAuthInstance().signOut();
            this.showNotification('Signed out from Google Drive', 'success');
        } catch (error) {
            console.error('Error signing out:', error);
            this.showNotification('Sign-out failed: ' + error.message, 'error');
        }
    }

    /**
     * Get or create the Excalidraw Boards folder
     */
    async getOrCreateFolder() {
        if (this.folderId) {
            return this.folderId;
        }

        try {
            // Search for existing folder
            const response = await gapi.client.drive.files.list({
                q: `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (response.result.files && response.result.files.length > 0) {
                this.folderId = response.result.files[0].id;
                console.log('Found existing folder:', this.folderId);
                return this.folderId;
            }

            // Create new folder
            const folderMetadata = {
                name: this.folderName,
                mimeType: 'application/vnd.google-apps.folder'
            };

            const folder = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });

            this.folderId = folder.result.id;
            console.log('Created new folder:', this.folderId);
            return this.folderId;
        } catch (error) {
            console.error('Error getting/creating folder:', error);
            throw error;
        }
    }

    /**
     * Save board to Google Drive
     */
    async saveToDrive(filename = null) {
        if (!this.isSignedIn) {
            this.showNotification('Please sign in to Google Drive first', 'error');
            return;
        }

        try {
            // Get board data
            const data = window.boardStorage.getBoardData();
            if (!data) {
                throw new Error('No board data to save');
            }

            // Generate filename if not provided
            if (!filename) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                filename = `board_${timestamp}.excalidraw`;
            } else if (!filename.endsWith('.excalidraw')) {
                filename += '.excalidraw';
            }

            // Get folder ID
            const folderId = await this.getOrCreateFolder();

            // Prepare file content
            const fileContent = JSON.stringify(data, null, 2);
            const file = new Blob([fileContent], { type: 'application/json' });

            // Create metadata
            const metadata = {
                name: filename,
                mimeType: 'application/json',
                parents: [folderId]
            };

            // Create form data
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            // Upload to Drive
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
                }),
                body: form
            });

            if (!response.ok) {
                throw new Error('Upload failed: ' + response.statusText);
            }

            const result = await response.json();
            console.log('Saved to Drive:', result);
            this.showNotification(`Saved "${filename}" to Google Drive`, 'success');

            // Refresh file list
            this.listFiles();

            return result;
        } catch (error) {
            console.error('Error saving to Drive:', error);
            this.showNotification('Failed to save to Drive: ' + error.message, 'error');
        }
    }

    /**
     * List all board files from Google Drive
     */
    async listFiles() {
        if (!this.isSignedIn) {
            return [];
        }

        try {
            const folderId = await this.getOrCreateFolder();

            const response = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed=false and (name contains '.excalidraw' or mimeType='application/json')`,
                fields: 'files(id, name, modifiedTime, size)',
                orderBy: 'modifiedTime desc',
                pageSize: 50
            });

            const files = response.result.files || [];
            console.log('Found files:', files.length);

            // Update UI with file list
            this.displayFileList(files);

            return files;
        } catch (error) {
            console.error('Error listing files:', error);
            this.showNotification('Failed to list files: ' + error.message, 'error');
            return [];
        }
    }

    /**
     * Load a board from Google Drive
     */
    async loadFromDrive(fileId) {
        if (!this.isSignedIn) {
            this.showNotification('Please sign in to Google Drive first', 'error');
            return;
        }

        try {
            // Download file content
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const data = typeof response.result === 'string'
                ? JSON.parse(response.result)
                : response.result;

            // Load into board
            if (window.boardStorage.loadBoardData(data)) {
                this.showNotification('Board loaded from Google Drive', 'success');
            } else {
                throw new Error('Failed to load board data');
            }
        } catch (error) {
            console.error('Error loading from Drive:', error);
            this.showNotification('Failed to load from Drive: ' + error.message, 'error');
        }
    }

    /**
     * Delete a file from Google Drive
     */
    async deleteFile(fileId) {
        if (!this.isSignedIn) {
            return;
        }

        try {
            await gapi.client.drive.files.delete({
                fileId: fileId
            });

            this.showNotification('File deleted from Google Drive', 'success');
            this.listFiles(); // Refresh list
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('Failed to delete file: ' + error.message, 'error');
        }
    }

    /**
     * Display file list in UI
     */
    displayFileList(files) {
        const listContainer = document.getElementById('drive-file-list');
        if (!listContainer) return;

        if (files.length === 0) {
            listContainer.innerHTML = '<div class="drive-no-files">No boards found in Google Drive</div>';
            return;
        }

        listContainer.innerHTML = files.map(file => {
            const date = new Date(file.modifiedTime).toLocaleString();
            const size = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'N/A';

            return `
                <div class="drive-file-item" data-file-id="${file.id}">
                    <div class="drive-file-info">
                        <div class="drive-file-name">${file.name}</div>
                        <div class="drive-file-meta">${date} • ${size}</div>
                    </div>
                    <div class="drive-file-actions">
                        <button onclick="googleDrive.loadFromDrive('${file.id}')" class="drive-btn drive-btn-load">
                            <i class="fas fa-folder-open"></i> Load
                        </button>
                        <button onclick="if(confirm('Delete this board?')) googleDrive.deleteFile('${file.id}')" 
                                class="drive-btn drive-btn-delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Update UI based on sign-in status
     */
    updateUI(isSignedIn, name = '', email = '') {
        const signInBtn = document.getElementById('drive-sign-in-btn');
        const signOutBtn = document.getElementById('drive-sign-out-btn');
        const userInfo = document.getElementById('drive-user-info');
        const driveControls = document.getElementById('drive-controls');

        if (signInBtn) signInBtn.style.display = isSignedIn ? 'none' : 'block';
        if (signOutBtn) signOutBtn.style.display = isSignedIn ? 'block' : 'none';
        if (driveControls) driveControls.style.display = isSignedIn ? 'flex' : 'none';

        if (userInfo) {
            if (isSignedIn) {
                userInfo.innerHTML = `<i class="fas fa-user-circle"></i> ${name} (${email})`;
                userInfo.style.display = 'block';
            } else {
                userInfo.style.display = 'none';
            }
        }

        // Refresh file list if signed in
        if (isSignedIn) {
            this.listFiles();
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.boardStorage) {
            window.boardStorage.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// Export as singleton
window.googleDrive = new GoogleDriveIntegration();
