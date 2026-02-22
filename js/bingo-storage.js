const BingoStorage = (function () {
    'use strict';

    const DB_NAME = 'esl_bingo_sessions';
    const DB_VERSION = 1;
    const STORE_NAME = 'sessions';

    let dbInstance = null;

    /**
     * Initializes and returns the IndexedDB database instance.
     * @returns {Promise<IDBDatabase>}
     */
    function initDB() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject("Failed to open IndexedDB");
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Create an object store with 'id' as the key-path
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Helper to wrap file reading as a Promise for base64 conversion.
     * @param {Blob|File} blob 
     * @returns {Promise<string>} Base64 string
     */
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            if (!blob) return resolve('');
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Helper to convert a Base64 string back into a Blob
     * @param {string} base64 
     * @returns {Blob}
     */
    function base64ToBlob(base64) {
        if (!base64 || !base64.includes(',')) return null;
        const arr = base64.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    /**
     * Save a session locally using IndexedDB.
     * Automatically converts audio blobs to Base64 before saving to avoid serialization errors 
     * on some older browsers, and keeps format unified for JSON exports.
     *
     * @param {object} session - Must contain an `id` field. e.g. Date.now()
     * @returns {Promise<void>}
     */
    async function saveSession(session) {
        if (!session.id) session.id = Date.now();
        if (!session.date) session.date = new Date().toISOString();

        // Convert Blob stores to base64 dictionaries for safe storage and export
        const dataToSave = JSON.parse(JSON.stringify(session)); // Deep copy primitive data

        // Now process any audio blobs specifically
        if (session.callerState) {
            dataToSave.callerState.headerAudioData = {};
            dataToSave.callerState.itemAudioData = {};

            if (session.callerState.headerAudioBlobs) {
                for (const [key, blob] of Object.entries(session.callerState.headerAudioBlobs)) {
                    dataToSave.callerState.headerAudioData[key] = await blobToBase64(blob);
                }
            }
            if (session.callerState.itemAudioBlobs) {
                for (const [key, blob] of Object.entries(session.callerState.itemAudioBlobs)) {
                    dataToSave.callerState.itemAudioData[key] = await blobToBase64(blob);
                }
            }
        }

        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(dataToSave);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get all saved sessions for the Load Modal.
     * @returns {Promise<Array>} List of session data minus the heavyweight image/audio content 
     * for faster UI rendering.
     */
    async function getSessionsList() {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = (e) => {
                // Strip out heavy data for the list view
                const fullList = e.target.result || [];
                const lightweightList = fullList.map(item => ({
                    id: item.id,
                    name: item.name,
                    date: item.date,
                    mode: item.generatorState ? item.generatorState.mode : 'unknown',
                    itemCount: item.generatorState && item.generatorState.itemPool ? item.generatorState.itemPool.length : 0
                }));
                // Sort by date descending
                resolve(lightweightList.sort((a, b) => new Date(b.date) - new Date(a.date)));
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Load a full session by ID and convert base64 audio data back into Blobs 
     * for the caller session to use via URL.createObjectURL().
     * @param {number|string} id 
     * @returns {Promise<object>} The fully restored session object
     */
    async function getSession(id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(Number(id));

            request.onsuccess = (e) => {
                const data = e.target.result;
                if (!data) return resolve(null);

                // Restore Blob layout so runtime logic doesn't have to change
                if (data.callerState) {
                    data.callerState.headerAudioBlobs = {};
                    data.callerState.itemAudioBlobs = {};

                    if (data.callerState.headerAudioData) {
                        for (const [key, b64] of Object.entries(data.callerState.headerAudioData)) {
                            const blob = base64ToBlob(b64);
                            if (blob) data.callerState.headerAudioBlobs[key] = blob;
                        }
                        delete data.callerState.headerAudioData; // Clean up
                    }

                    if (data.callerState.itemAudioData) {
                        for (const [key, b64] of Object.entries(data.callerState.itemAudioData)) {
                            const blob = base64ToBlob(b64);
                            if (blob) data.callerState.itemAudioBlobs[key] = blob;
                        }
                        delete data.callerState.itemAudioData; // Clean up
                    }
                }
                resolve(data);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Delete a session from IndexedDB.
     * @param {number|string} id 
     * @returns {Promise<void>}
     */
    async function deleteSession(id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(Number(id));

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Generate a JSON file of the given session and trigger a browser download.
     *
     * @param {object} session - Active or loaded session data containing callerState/generatorState
     */
    async function exportSessionToJson(session) {
        // We prepare a clean copy for export exactly like we do for IndexedDB storage
        if (!session.name) session.name = 'Exported_Bingo_Session';
        if (!session.id) session.id = Date.now();
        if (!session.date) session.date = new Date().toISOString();

        const dataToSave = JSON.parse(JSON.stringify(session));

        if (session.callerState) {
            dataToSave.callerState.headerAudioData = {};
            dataToSave.callerState.itemAudioData = {};

            if (session.callerState.headerAudioBlobs) {
                for (const [key, blob] of Object.entries(session.callerState.headerAudioBlobs)) {
                    dataToSave.callerState.headerAudioData[key] = await blobToBase64(blob);
                }
            }
            if (session.callerState.itemAudioBlobs) {
                for (const [key, blob] of Object.entries(session.callerState.itemAudioBlobs)) {
                    dataToSave.callerState.itemAudioData[key] = await blobToBase64(blob);
                }
            }
        }

        const jsonStr = JSON.stringify(dataToSave, null, 2);
        const fileBlob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(fileBlob);

        const a = document.createElement('a');
        a.href = url;
        const filename = session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `bingo_session_${filename}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Parse an uploaded JSON file and optionally save it to IndexedDB 
     * and/or return it for runtime loading.
     * 
     * @param {File} jsonFile 
     * @returns {Promise<object>} The parsed session with Blobs restored for runtime use
     */
    function importSessionFromJson(jsonFile) {
        return new Promise((resolve, reject) => {
            if (!jsonFile || jsonFile.type !== 'application/json' && !jsonFile.name.endsWith('.json')) {
                return reject(new Error('Invalid file type. Please upload a specific Bingo Session .json file.'));
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (!data.generatorState) {
                        throw new Error('This JSON does not appear to be a valid Bingo Session.');
                    }

                    // We ensure it gets a fresh ID so it doesn't collide if they import and save it.
                    data.id = Date.now();
                    data.date = new Date().toISOString();

                    // The loaded `data` has base64 arrays. For immediate runtime usage, 
                    // we need to give it Blobs.
                    if (data.callerState) {
                        data.callerState.headerAudioBlobs = {};
                        data.callerState.itemAudioBlobs = {};

                        if (data.callerState.headerAudioData) {
                            for (const [key, b64] of Object.entries(data.callerState.headerAudioData)) {
                                const blob = base64ToBlob(b64);
                                if (blob) data.callerState.headerAudioBlobs[key] = blob;
                            }
                            delete data.callerState.headerAudioData;
                        }

                        if (data.callerState.itemAudioData) {
                            for (const [key, b64] of Object.entries(data.callerState.itemAudioData)) {
                                const blob = base64ToBlob(b64);
                                if (blob) data.callerState.itemAudioBlobs[key] = blob;
                            }
                            delete data.callerState.itemAudioData;
                        }
                    }

                    resolve(data);
                } catch (err) {
                    reject(new Error('Failed to parse JSON session. File may be corrupted.'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read the file.'));
            reader.readAsText(jsonFile);
        });
    }

    return {
        saveSession,
        getSessionsList,
        getSession,
        deleteSession,
        exportSessionToJson,
        importSessionFromJson
    };

})();

window.BingoStorage = BingoStorage;
