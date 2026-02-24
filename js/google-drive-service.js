/**
 * Google Drive Service — Reusable Module
 * Generic Google Drive save/load for any ESL tool.
 * Uses Google Identity Services (GIS) + Drive API v3.
 *
 * Usage:
 *   const driveService = new GoogleDriveService({
 *       folderName: 'ESL - Lesson Plans',
 *       fileExtension: '.json',
 *       onSave: () => myToolData,          // return JSON-serializable object
 *       onLoad: (data, filename) => { ... }, // hydrate tool with loaded data
 *       onNotify: (msg, type) => { ... }     // optional toast callback
 *   });
 *   driveService.openModal();
 */

class GoogleDriveService {
    constructor(options = {}) {
        this.CLIENT_ID = '1041840472824-9ivoi73ufdhirq4afin9avlmtuhpdbn0.apps.googleusercontent.com';
        this.API_KEY = 'AIzaSyBsQX4EOWF26YzPPqOVtiRX04dh6cSv7Bc';
        this.DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';

        this.folderName = options.folderName || 'ESL Platform Files';
        this.fileExtension = options.fileExtension || '.json';
        this.onSave = options.onSave || (() => ({}));
        this.onLoad = options.onLoad || (() => { });
        this.onNotify = options.onNotify || ((msg, type) => console.log(`[${type}] ${msg}`));

        this.isSignedIn = false;
        this.gapiReady = false;
        this.accessToken = null;
        this.tokenClient = null;
        this.folderId = null;
        this.modalEl = null;
        this._initialized = false;
    }

    // ── Initialization ─────────────────────────────────────────
    async init() {
        if (this._initialized) return true;
        try {
            if (this.CLIENT_ID.includes('YOUR_CLIENT_ID')) {
                console.warn('Google Drive not configured.');
                return false;
            }

            await Promise.all([this._waitForGAPI(), this._waitForGIS()]);

            await new Promise((resolve, reject) => {
                gapi.load('client', { callback: resolve, onerror: reject });
            });

            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: this.DISCOVERY_DOCS
            });

            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        this.isSignedIn = true;
                        gapi.client.setToken({ access_token: this.accessToken });
                        // Cache token
                        try { sessionStorage.setItem('gds_token', this.accessToken); } catch (e) { }
                        this._updateModalUI();
                        this.listFiles();
                    }
                }
            });

            // Try to restore cached token
            try {
                const cached = sessionStorage.getItem('gds_token');
                if (cached) {
                    this.accessToken = cached;
                    gapi.client.setToken({ access_token: cached });
                    // Test token validity
                    const test = await gapi.client.drive.files.list({ pageSize: 1, fields: 'files(id)' });
                    if (test.status === 200) {
                        this.isSignedIn = true;
                    } else {
                        sessionStorage.removeItem('gds_token');
                        this.accessToken = null;
                    }
                }
            } catch (e) {
                sessionStorage.removeItem('gds_token');
                this.accessToken = null;
                this.isSignedIn = false;
            }

            this.gapiReady = true;
            this._initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing Google Drive:', error);
            this.onNotify('Failed to initialize Google Drive: ' + (error.message || ''), 'error');
            return false;
        }
    }

    _waitForGAPI() {
        return new Promise((resolve) => {
            if (typeof gapi !== 'undefined') return resolve();
            const check = setInterval(() => {
                if (typeof gapi !== 'undefined') { clearInterval(check); resolve(); }
            }, 100);
        });
    }

    _waitForGIS() {
        return new Promise((resolve) => {
            if (typeof google !== 'undefined' && google.accounts) return resolve();
            const check = setInterval(() => {
                if (typeof google !== 'undefined' && google.accounts) { clearInterval(check); resolve(); }
            }, 100);
        });
    }

    // ── Auth ────────────────────────────────────────────────────
    async signIn() {
        if (!this.gapiReady) {
            const ok = await this.init();
            if (!ok) { this.onNotify('Google Drive API not ready', 'error'); return; }
        }
        this.tokenClient.requestAccessToken({ prompt: '' });
    }

    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken, () => { });
            this.accessToken = null;
            this.isSignedIn = false;
            this.folderId = null;
            gapi.client.setToken(null);
            try { sessionStorage.removeItem('gds_token'); } catch (e) { }
            this._updateModalUI();
            this.onNotify('Signed out from Google Drive', 'success');
        }
    }

    // ── Folder ──────────────────────────────────────────────────
    async _getOrCreateFolder() {
        if (this.folderId) return this.folderId;
        const response = await gapi.client.drive.files.list({
            q: `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        if (response.result.files && response.result.files.length > 0) {
            this.folderId = response.result.files[0].id;
            return this.folderId;
        }
        const folder = await gapi.client.drive.files.create({
            resource: { name: this.folderName, mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id'
        });
        this.folderId = folder.result.id;
        return this.folderId;
    }

    // ── Save ────────────────────────────────────────────────────
    async saveFile(filename) {
        if (!this.isSignedIn) { this.onNotify('Please sign in first', 'error'); return; }
        try {
            const data = this.onSave();
            if (!data) throw new Error('No data to save');

            if (!filename.endsWith(this.fileExtension)) filename += this.fileExtension;

            const folderId = await this._getOrCreateFolder();
            const fileContent = JSON.stringify(data, null, 2);
            const file = new Blob([fileContent], { type: 'application/json' });

            const metadata = { name: filename, mimeType: 'application/json', parents: [folderId] };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken }),
                body: form
            });
            if (!response.ok) throw new Error('Upload failed: ' + response.statusText);

            this.onNotify(`Saved "${filename}" to Google Drive`, 'success');
            this.listFiles();
        } catch (error) {
            console.error('Error saving to Drive:', error);
            this.onNotify('Failed to save: ' + error.message, 'error');
        }
    }

    // ── List ────────────────────────────────────────────────────
    async listFiles() {
        if (!this.isSignedIn) return [];
        try {
            const folderId = await this._getOrCreateFolder();
            const response = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime, size)',
                orderBy: 'modifiedTime desc',
                pageSize: 50
            });
            const files = response.result.files || [];
            this._renderFileList(files);
            return files;
        } catch (error) {
            console.error('Error listing files:', error);
            this.onNotify('Failed to list files: ' + error.message, 'error');
            return [];
        }
    }

    // ── Load ────────────────────────────────────────────────────
    async loadFile(fileId, filename) {
        if (!this.isSignedIn) { this.onNotify('Please sign in first', 'error'); return; }
        try {
            const response = await gapi.client.drive.files.get({ fileId, alt: 'media' });
            const data = typeof response.result === 'string'
                ? JSON.parse(response.result)
                : response.result;
            this.onLoad(data, filename);
            this.onNotify('Loaded from Google Drive', 'success');
            this.closeModal();
        } catch (error) {
            console.error('Error loading from Drive:', error);
            this.onNotify('Failed to load: ' + error.message, 'error');
        }
    }

    // ── Delete ──────────────────────────────────────────────────
    async deleteFile(fileId) {
        if (!this.isSignedIn) return;
        try {
            await gapi.client.drive.files.delete({ fileId });
            this.onNotify('File deleted', 'success');
            this.listFiles();
        } catch (error) {
            console.error('Error deleting file:', error);
            this.onNotify('Failed to delete: ' + error.message, 'error');
        }
    }

    // ── Modal UI ────────────────────────────────────────────────
    renderModal() {
        // Remove existing
        document.getElementById('gds-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'gds-modal';
        modal.className = 'gds-modal-overlay';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="gds-modal-card">
                <div class="gds-modal-header">
                    <div>
                        <h3><i class="fa-brands fa-google-drive"></i> Google Drive</h3>
                        <p class="gds-folder-label"><i class="fa-solid fa-folder"></i> ${this._escHtml(this.folderName)}</p>
                    </div>
                    <button class="gds-close-btn" id="gds-close"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <!-- Auth Section -->
                <div class="gds-auth-section" id="gds-auth-section">
                    <div class="gds-signed-out" id="gds-signed-out">
                        <i class="fa-brands fa-google" style="font-size:2rem;color:#4285F4;margin-bottom:10px;"></i>
                        <p>Sign in to save and load files from Google Drive</p>
                        <button class="gds-btn gds-btn-signin" id="gds-signin-btn">
                            <i class="fa-brands fa-google"></i> Sign in with Google
                        </button>
                    </div>
                    <div class="gds-signed-in" id="gds-signed-in" style="display:none;">
                        <div class="gds-user-bar">
                            <span><i class="fa-solid fa-circle-check" style="color:#4caf50;"></i> Connected to Google Drive</span>
                            <button class="gds-btn-link" id="gds-signout-btn">Sign out</button>
                        </div>

                        <!-- Save Section -->
                        <div class="gds-save-section">
                            <div class="gds-save-row">
                                <input type="text" class="gds-filename-input" id="gds-filename" placeholder="Enter filename…">
                                <button class="gds-btn gds-btn-save" id="gds-save-btn">
                                    <i class="fa-solid fa-cloud-arrow-up"></i> Save
                                </button>
                            </div>
                        </div>

                        <!-- File List -->
                        <div class="gds-file-section">
                            <div class="gds-file-section-header">
                                <span><i class="fa-solid fa-folder-open"></i> Saved Files</span>
                                <button class="gds-btn-link" id="gds-refresh-btn"><i class="fa-solid fa-rotate-right"></i></button>
                            </div>
                            <div class="gds-file-list" id="gds-file-list">
                                <div class="gds-empty">No files found</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modalEl = modal;

        // Event listeners
        modal.addEventListener('click', e => { if (e.target === modal) this.closeModal(); });
        document.getElementById('gds-close').addEventListener('click', () => this.closeModal());
        document.getElementById('gds-signin-btn').addEventListener('click', () => this.signIn());
        document.getElementById('gds-signout-btn').addEventListener('click', () => this.signOut());
        document.getElementById('gds-save-btn').addEventListener('click', () => {
            const input = document.getElementById('gds-filename');
            const name = input.value.trim() || 'Untitled';
            this.saveFile(name);
            input.value = '';
        });
        document.getElementById('gds-refresh-btn').addEventListener('click', () => this.listFiles());
    }

    async openModal() {
        if (!this.modalEl) this.renderModal();
        this.modalEl.style.display = 'flex';

        if (!this._initialized) {
            const ok = await this.init();
            if (!ok) return;
        }
        this._updateModalUI();
        if (this.isSignedIn) this.listFiles();
    }

    closeModal() {
        if (this.modalEl) this.modalEl.style.display = 'none';
    }

    _updateModalUI() {
        const signedOut = document.getElementById('gds-signed-out');
        const signedIn = document.getElementById('gds-signed-in');
        if (!signedOut || !signedIn) return;
        signedOut.style.display = this.isSignedIn ? 'none' : 'flex';
        signedIn.style.display = this.isSignedIn ? 'block' : 'none';
    }

    _renderFileList(files) {
        const container = document.getElementById('gds-file-list');
        if (!container) return;

        if (!files || files.length === 0) {
            container.innerHTML = '<div class="gds-empty"><i class="fa-solid fa-cloud" style="font-size:1.5rem;opacity:0.3;"></i><br>No files found</div>';
            return;
        }

        container.innerHTML = files.map(file => {
            const date = new Date(file.modifiedTime);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const size = file.size ? `${(file.size / 1024).toFixed(1)} KB` : '';
            return `
                <div class="gds-file-item">
                    <div class="gds-file-info">
                        <div class="gds-file-name">${this._escHtml(file.name)}</div>
                        <div class="gds-file-meta">${dateStr}${size ? ' • ' + size : ''}</div>
                    </div>
                    <div class="gds-file-actions">
                        <button class="gds-btn gds-btn-load" data-id="${file.id}" data-name="${this._escHtml(file.name)}">
                            <i class="fa-solid fa-download"></i> Load
                        </button>
                        <button class="gds-btn gds-btn-del" data-id="${file.id}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Delegated events
        container.querySelectorAll('.gds-btn-load').forEach(btn => {
            btn.addEventListener('click', () => this.loadFile(btn.dataset.id, btn.dataset.name));
        });
        container.querySelectorAll('.gds-btn-del').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this file from Google Drive?')) this.deleteFile(btn.dataset.id);
            });
        });
    }

    _escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.GoogleDriveService = GoogleDriveService;
