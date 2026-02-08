// PDF Library Management System
// Handles book storage, display, and management

class PDFLibrary {
    constructor() {
        this.books = [];
        this.dbName = 'PDFLibraryDB';
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    async init() {
        await this.initDB();
        await this.loadBooks();
        this.setupEventListeners();
        this.renderBooks();
    }

    // Initialize IndexedDB for PDF storage
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('books')) {
                    db.createObjectStore('books', { keyPath: 'id' });
                }
            };
        });
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('pdfFileInput');
        const searchInput = document.getElementById('searchInput');

        // Upload area click
        uploadArea.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // Search
        searchInput.addEventListener('input', (e) => this.filterBooks(e.target.value));
    }

    async handleFileSelect(files) {
        const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

        if (pdfFiles.length === 0) {
            alert('Please select PDF files only.');
            return;
        }

        for (const file of pdfFiles) {
            await this.addBook(file);
        }

        this.renderBooks();
    }

    async addBook(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();

            // Clone the ArrayBuffer before using it with PDF.js
            // This prevents the "ArrayBuffer is detached" error
            const pdfBuffer = arrayBuffer.slice(0);
            const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

            // Generate thumbnail from first page
            const thumbnail = await this.generateThumbnail(pdf);

            const book = {
                id: Date.now(), // Use integer ID instead of decimal
                title: file.name.replace('.pdf', ''),
                fileName: file.name,
                pages: pdf.numPages,
                size: this.formatFileSize(file.size),
                dateAdded: new Date().toISOString(),
                thumbnail: thumbnail
            };

            // Store PDF in IndexedDB (using the original arrayBuffer)
            await this.storePDF(book.id, arrayBuffer);

            // Store metadata in localStorage
            this.books.push(book);
            this.saveMetadata();

        } catch (error) {
            console.error('Error adding book:', error);
            alert('Error adding book: ' + error.message);
        }
    }

    async generateThumbnail(pdf) {
        try {
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            return null;
        }
    }

    storePDF(id, arrayBuffer) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['books'], 'readwrite');
            const store = transaction.objectStore('books');
            const request = store.put({ id, data: arrayBuffer });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadBooks() {
        const metadata = localStorage.getItem('pdfLibraryMetadata');
        if (metadata) {
            this.books = JSON.parse(metadata);
        }
    }

    saveMetadata() {
        localStorage.setItem('pdfLibraryMetadata', JSON.stringify(this.books));
    }

    async deleteBook(bookId) {
        if (!confirm('Are you sure you want to delete this book?')) {
            return;
        }

        // Remove from IndexedDB
        const transaction = this.db.transaction(['books'], 'readwrite');
        const store = transaction.objectStore('books');
        store.delete(bookId);

        // Remove from metadata
        this.books = this.books.filter(book => book.id !== bookId);
        this.saveMetadata();

        // Remove annotations
        localStorage.removeItem(`annotations_${bookId}`);

        this.renderBooks();
    }

    openBook(bookId) {
        localStorage.setItem('currentBookId', bookId);
        window.location.href = 'pdf-viewer.html';
    }

    filterBooks(searchTerm) {
        const term = searchTerm.toLowerCase();
        const cards = document.querySelectorAll('.book-card');

        cards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            card.style.display = title.includes(term) ? 'block' : 'none';
        });
    }

    renderBooks() {
        const grid = document.getElementById('booksGrid');
        const emptyState = document.getElementById('emptyState');
        const bookCount = document.getElementById('bookCount');

        if (this.books.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            bookCount.textContent = '0 books';
            return;
        }

        emptyState.style.display = 'none';
        bookCount.textContent = `${this.books.length} book${this.books.length !== 1 ? 's' : ''}`;

        grid.innerHTML = this.books.map(book => `
            <div class="book-card" data-id="${book.id}">
                <div class="book-thumbnail">
                    ${book.thumbnail
                ? `<img src="${book.thumbnail}" alt="${book.title}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                : '<i class="fa-solid fa-file-pdf"></i>'
            }
                </div>
                <div class="book-info">
                    <h3 title="${book.title}">${book.title}</h3>
                    <div class="book-meta">
                        <span><i class="fa-solid fa-file"></i> ${book.pages} pages</span>
                        <span><i class="fa-solid fa-hdd"></i> ${book.size}</span>
                    </div>
                    <div class="book-actions">
                        <button class="btn-open" onclick="library.openBook(${book.id})">
                            <i class="fa-solid fa-book-open"></i> Open
                        </button>
                        <button class="btn-delete" onclick="library.deleteBook(${book.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Initialize library
const library = new PDFLibrary();
