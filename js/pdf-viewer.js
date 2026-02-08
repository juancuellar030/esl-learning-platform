// PDF Viewer with Advanced Drawing Tools
// Uses perfect-freehand for Excalidraw-style smooth strokes

class PDFViewer {
    constructor() {
        this.pdf = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.bookId = null;
        this.bookTitle = '';
        this.renderTask = null;

        // Drawing state
        this.currentTool = 'select'; // Hand/grab tool is the default
        this.baseRenderScale = null; // Track resolution of current canvas
        this.zoomTimeout = null;
        this.isDrawing = false;
        this.currentStroke = [];
        this.currentColor = '#000000';
        this.currentWidth = 3;
        this.annotations = {}; // { pageNum: [strokes] }
        this.history = [];
        this.historyIndex = -1;

        // Panning state for hand tool
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartScrollLeft = 0;
        this.panStartScrollTop = 0;

        // Toolbar visibility
        this.toolbarVisible = false;

        // Text annotation state
        this.textAnnotations = {}; // { pageNum: [textBoxes] }
        this.currentTextBox = null;
        this.editingTextBox = null;
        this.resizingTextBox = null;
        this.resizeHandle = null;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Text box drawing state (drag-to-create)
        this.isDrawingTextBox = false;
        this.textBoxOriginX = 0;
        this.textBoxOriginY = 0;
        this.textBoxCurrentX = 0;
        this.textBoxCurrentY = 0;

        this.init();
    }

    async init() {
        this.bookId = localStorage.getItem('currentBookId');
        if (!this.bookId) {
            alert('No book selected');
            window.location.href = 'pdf-library.html';
            return;
        }

        await this.loadPDF();
        this.setupEventListeners();
        this.setupTouchGestures();
        this.loadAnnotations();
        this.createTextAlignToolbar();
        await this.renderPage(this.currentPage);
        document.getElementById('loadingOverlay').style.display = 'none';

        // Activate the default tool (hand/grab) so cursor + button state are correct
        this.setTool('select');
    }

    async loadPDF() {
        try {
            const db = await this.openDB();
            const bookId = Number(this.bookId); // Use Number() to preserve decimals if any
            console.log('Looking for book ID:', bookId);

            const pdfData = await this.getPDFFromDB(db, bookId);

            if (!pdfData) {
                throw new Error('PDF not found in database. Please try re-uploading the book.');
            }

            console.log('Loading PDF, data size:', pdfData.byteLength);

            // Load PDF with PDF.js
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            this.pdf = await loadingTask.promise;

            if (!this.pdf) {
                throw new Error('Failed to load PDF document');
            }

            this.totalPages = this.pdf.numPages;
            console.log('PDF loaded successfully, pages:', this.totalPages);

            // Load book metadata
            const metadata = JSON.parse(localStorage.getItem('pdfLibraryMetadata') || '[]');
            const book = metadata.find(b => b.id == this.bookId);
            this.bookTitle = book ? book.title : 'Unknown Book';

            document.getElementById('bookTitle').textContent = this.bookTitle;
            document.getElementById('totalPages').textContent = this.totalPages;
            document.getElementById('pageInput').max = this.totalPages;
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error loading PDF: ' + error.message + '\n\nPlease return to the library and try again.');
            // Don't redirect immediately to allow user to see the error
            setTimeout(() => {
                window.location.href = 'pdf-library.html';
            }, 3000);
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PDFLibraryDB', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getPDFFromDB(db, bookId) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['books'], 'readonly');
            const store = transaction.objectStore('books');
            const request = store.get(bookId);

            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }

    setupEventListeners() {
        // Page navigation
        document.getElementById('prevPageBtn').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPageBtn').addEventListener('click', () => this.changePage(1));
        document.getElementById('pageInput').addEventListener('change', (e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= this.totalPages) {
                this.goToPage(page);
            }
        });

        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoom(0.2));
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoom(-0.2));
        document.getElementById('zoomResetBtn').addEventListener('click', () => this.setZoom(1.5));
        document.getElementById('fitWidthBtn').addEventListener('click', () => this.fitToWidth());
        document.getElementById('fitPageBtn').addEventListener('click', () => this.fitToPage());

        // Tool selection
        document.getElementById('selectToolBtn').addEventListener('click', () => this.setTool('select'));
        document.getElementById('markerToolBtn').addEventListener('click', () => this.setTool('marker'));
        document.getElementById('highlighterToolBtn').addEventListener('click', () => this.setTool('highlighter'));
        document.getElementById('textToolBtn').addEventListener('click', () => this.setTool('text'));
        document.getElementById('eraserToolBtn').addEventListener('click', () => this.setTool('eraser'));



        // Stroke width
        document.getElementById('strokeWidthSlider').addEventListener('input', (e) => {
            this.currentWidth = parseInt(e.target.value);
            this.updateStrokePreview();
        });

        // Toolbar toggle
        document.getElementById('toolbarToggleBtn').addEventListener('click', () => this.toggleToolbar());
        document.getElementById('toolbarCloseBtn').addEventListener('click', () => this.toggleToolbar());

        // Color palette
        document.getElementById('colorPreviewBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColorPalette();
        });

        // Color palette selection
        document.querySelectorAll('.palette-color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.currentTarget.getAttribute('data-color');
                this.setColor(color);
                this.hideColorPalette();
            });
        });

        // Close color palette when clicking outside
        document.addEventListener('click', (e) => {
            const palette = document.getElementById('colorPalettePopup');
            const previewBtn = document.getElementById('colorPreviewBtn');
            if (!palette.contains(e.target) && !previewBtn.contains(e.target)) {
                this.hideColorPalette();
            }
        });



        // Thumbnail grid
        document.getElementById('thumbnailGridBtn').addEventListener('click', () => this.toggleThumbnailGrid());
        document.getElementById('thumbnailCloseBtn').addEventListener('click', () => this.closeThumbnailGrid());

        // Actions
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearPageBtn').addEventListener('click', () => this.clearPage());

        // Canvas drawing - use Pointer Events for unified mouse/touch support
        const canvas = document.getElementById('annotationCanvas');
        canvas.style.touchAction = 'none'; // Prevent browser scrolling/zooming

        canvas.addEventListener('pointerdown', (e) => {
            canvas.setPointerCapture(e.pointerId);
            this.startDrawing(e);
        });

        canvas.addEventListener('pointermove', (e) => this.draw(e));

        canvas.addEventListener('pointerup', (e) => {
            canvas.releasePointerCapture(e.pointerId);
            this.stopDrawing();
        });

        canvas.addEventListener('pointerleave', () => this.stopDrawing());
        canvas.addEventListener('pointercancel', () => this.stopDrawing());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.changePage(-1);
            if (e.key === 'ArrowRight') this.changePage(1);
            if (e.key === 'PageUp') this.changePage(-1);
            if (e.key === 'PageDown') this.changePage(1);
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
        });
    }

    async renderPage(pageNum) {
        if (!this.pdf) {
            console.error('Cannot render page: PDF not loaded');
            return;
        }

        try {
            // Cancel any pending render task
            if (this.renderTask) {
                await this.renderTask.cancel();
                this.renderTask = null;
            }

            const page = await this.pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            // Double buffering: Render to offscreen canvas first to prevent white flash
            const offscreenCanvas = document.createElement('canvas');
            const offscreenContext = offscreenCanvas.getContext('2d');
            offscreenCanvas.width = viewport.width;
            offscreenCanvas.height = viewport.height;

            // Store the render task
            this.renderTask = page.render({
                canvasContext: offscreenContext,
                viewport: viewport
            });

            await this.renderTask.promise;
            this.renderTask = null; // Clear task when done

            // Swap contents to visible canvas
            const pdfCanvas = document.getElementById('pdfCanvas');
            const annotationCanvas = document.getElementById('annotationCanvas');
            const context = pdfCanvas.getContext('2d');

            // Resize visible canvases only after new render is ready
            pdfCanvas.width = viewport.width;
            pdfCanvas.height = viewport.height;
            annotationCanvas.width = viewport.width;
            annotationCanvas.height = viewport.height;

            // Draw the offscreen content
            context.drawImage(offscreenCanvas, 0, 0);

            // Update base render scale to match current scale
            this.baseRenderScale = this.scale;

            this.currentPage = pageNum;
            document.getElementById('pageInput').value = pageNum;

            this.renderAnnotations();
        } catch (error) {
            // Ignore cancellation errors
            if (error.name === 'RenderingCancelledException') {
                return;
            }
            console.error('Error rendering page:', error);
            // Only alert for non-cancellation errors
            // alert('Error rendering page: ' + error.message);
        }
    }

    changePage(delta) {
        const newPage = this.currentPage + delta;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.goToPage(newPage);
        }
    }

    goToPage(pageNum) {
        this.saveCurrentPageAnnotations();
        this.renderPage(pageNum);
    }

    zoom(delta) {
        this.scale = Math.max(0.5, Math.min(3, this.scale + delta));
        this.updateZoomDisplay();
        this.renderPage(this.currentPage);
    }

    setZoom(scale) {
        this.scale = scale;
        this.updateZoomDisplay();

        if (this.zoomTimeout) {
            clearTimeout(this.zoomTimeout);
        }

        if (!this.baseRenderScale) {
            this.baseRenderScale = this.scale;
        }

        const cssScale = this.scale / this.baseRenderScale;
        const canvasWrapper = document.getElementById('canvasWrapper');
        const container = document.querySelector('.viewer-canvas-area');

        // Apply CSS transform to the entire wrapper for instant visual feedback.
        // 'center center' keeps the zoom anchored to the middle of the page.
        canvasWrapper.style.transform = `scale(${cssScale})`;
        canvasWrapper.style.transformOrigin = 'center center';

        // Debounce the crisp re-render until the gesture settles
        this.zoomTimeout = setTimeout(async () => {
            // Snapshot where the viewport center sits relative to the wrapper
            const wrapperRect = canvasWrapper.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const viewCenterRatioX = (containerRect.left + containerRect.width / 2 - wrapperRect.left) / wrapperRect.width;
            const viewCenterRatioY = (containerRect.top + containerRect.height / 2 - wrapperRect.top) / wrapperRect.height;

            // Re-render at native resolution (uses offscreen buffer so no flash)
            await this.renderPage(this.currentPage);

            // Remove CSS transform AFTER the new render is ready
            canvasWrapper.style.transform = 'none';

            // Restore scroll so the same content point stays centered
            const newWidth = canvasWrapper.offsetWidth;
            const newHeight = canvasWrapper.offsetHeight;
            container.scrollLeft = viewCenterRatioX * newWidth - container.clientWidth / 2;
            container.scrollTop = viewCenterRatioY * newHeight - container.clientHeight / 2;
        }, 300);
    }

    updateZoomDisplay() {
        document.getElementById('zoomLevel').textContent = Math.round(this.scale * 100) + '%';
    }

    fitToWidth() {
        const canvasArea = document.querySelector('.viewer-canvas-area');
        const pdfCanvas = document.getElementById('pdfCanvas');
        const availableWidth = canvasArea.clientWidth - 100;
        this.scale = availableWidth / (pdfCanvas.width / this.scale);
        this.updateZoomDisplay();
        this.renderPage(this.currentPage);
    }

    fitToPage() {
        const canvasArea = document.querySelector('.viewer-canvas-area');
        const pdfCanvas = document.getElementById('pdfCanvas');
        const availableWidth = canvasArea.clientWidth - 100;
        const availableHeight = canvasArea.clientHeight - 100;
        const scaleX = availableWidth / (pdfCanvas.width / this.scale);
        const scaleY = availableHeight / (pdfCanvas.height / this.scale);
        this.scale = Math.min(scaleX, scaleY);
        this.updateZoomDisplay();
        this.renderPage(this.currentPage);
    }

    setTool(tool) {
        this.currentTool = tool;
        const canvas = document.getElementById('annotationCanvas');

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + 'ToolBtn');
        if (toolBtn) toolBtn.classList.add('active');

        // Update cursor
        if (tool === 'select') {
            canvas.style.cursor = 'grab';
        } else if (tool === 'text') {
            canvas.style.cursor = 'text';
        } else if (tool === 'eraser') {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    setColor(color) {
        this.currentColor = color;
        document.getElementById('colorPreview').style.background = color;
        this.updateStrokePreview();
    }

    updateStrokePreview() {
        const preview = document.getElementById('strokePreview');
        preview.style.width = this.currentWidth + 'px';
        preview.style.background = this.currentColor;
    }

    toggleToolbar() {
        this.toolbarVisible = !this.toolbarVisible;
        const toolbar = document.getElementById('floatingToolbar');
        if (this.toolbarVisible) {
            toolbar.classList.remove('hidden');
        } else {
            toolbar.classList.add('hidden');
            this.hideColorPalette();
        }
    }

    toggleColorPalette() {
        const palette = document.getElementById('colorPalettePopup');
        palette.classList.toggle('hidden');
    }

    hideColorPalette() {
        const palette = document.getElementById('colorPalettePopup');
        palette.classList.add('hidden');
    }

    setupTouchGestures() {
        const canvasWrapper = document.getElementById('canvasWrapper');
        let initialPinchDistance = 0;
        let initialScale = 1;

        canvasWrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                // Cancel any active drawing if pinch starts
                this.isDrawing = false;
                this.currentStroke = [];

                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                initialScale = this.scale;
            }
        }, { passive: false });

        canvasWrapper.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

                if (initialPinchDistance > 0) {
                    const ratio = currentDistance / initialPinchDistance;
                    // Amplify the gesture so full zoom range is reached faster
                    const amplified = 1 + (ratio - 1) * 1.8;
                    const newScale = initialScale * amplified;
                    const finalScale = Math.min(Math.max(0.5, newScale), 5.0);
                    this.setZoom(finalScale);
                }
            }
        }, { passive: false });

        // Add trackpad pinch-to-zoom support (Ctrl + Wheel)
        canvasWrapper.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = 0.5;
                const delta = -e.deltaY;
                const newScale = this.scale + (delta * zoomFactor * 0.01);

                // Limit zoom range
                const finalScale = Math.min(Math.max(0.5, newScale), 5.0);
                this.setZoom(finalScale);
            }
        }, { passive: false });
    }

    startDrawing(e) {
        // Handle text tool — begin drag-to-draw rectangle
        if (this.currentTool === 'text') {
            const rect = e.target.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.scale;
            const y = (e.clientY - rect.top) / this.scale;
            this.isDrawingTextBox = true;
            this.textBoxOriginX = x;
            this.textBoxOriginY = y;
            this.textBoxCurrentX = x;
            this.textBoxCurrentY = y;
            return;
        }

        if (this.currentTool === 'select') {
            // Start panning
            this.isPanning = true;
            const container = document.querySelector('.viewer-canvas-area');
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartScrollLeft = container.scrollLeft;
            this.panStartScrollTop = container.scrollTop;

            const canvas = document.getElementById('annotationCanvas');
            canvas.style.cursor = 'grabbing';
            return;
        }

        this.isDrawing = true;
        const rect = e.target.getBoundingClientRect();
        // Store points relative to base scale (1.0)
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;

        if (this.currentTool === 'eraser') {
            this.eraseAt(x, y);
        } else {
            this.currentStroke = [{
                x: x,
                y: y,
                pressure: 0.5
            }];
        }
    }

    draw(e) {
        // Handle text box drag-to-draw preview
        if (this.isDrawingTextBox) {
            const rect = e.target.getBoundingClientRect();
            this.textBoxCurrentX = (e.clientX - rect.left) / this.scale;
            this.textBoxCurrentY = (e.clientY - rect.top) / this.scale;

            // Draw dashed preview rectangle on annotation canvas
            this.renderAnnotations();
            const canvas = document.getElementById('annotationCanvas');
            const ctx = canvas.getContext('2d');
            const rx = Math.min(this.textBoxOriginX, this.textBoxCurrentX) * this.scale;
            const ry = Math.min(this.textBoxOriginY, this.textBoxCurrentY) * this.scale;
            const rw = Math.abs(this.textBoxCurrentX - this.textBoxOriginX) * this.scale;
            const rh = Math.abs(this.textBoxCurrentY - this.textBoxOriginY) * this.scale;
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
            return;
        }

        // Handle panning (hand/select tool)
        if (this.isPanning) {
            const container = document.querySelector('.viewer-canvas-area');
            const dx = e.clientX - this.panStartX;
            const dy = e.clientY - this.panStartY;
            container.scrollLeft = this.panStartScrollLeft - dx;
            container.scrollTop = this.panStartScrollTop - dy;
            return;
        }

        if (!this.isDrawing) return;

        const rect = e.target.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;

        if (this.currentTool === 'eraser') {
            this.eraseAt(x, y);
            return;
        }

        // Add point to current stroke
        this.currentStroke.push({
            x: x,
            y: y,
            pressure: e.pressure || 0.5
        });

        // Live preview: draw the current stroke on the annotation canvas
        const canvas = document.getElementById('annotationCanvas');
        const ctx = canvas.getContext('2d');

        // Redraw all existing annotations + the in-progress stroke
        this.renderAnnotations();

        const points = this.currentStroke.map(p => [p.x * this.scale, p.y * this.scale, p.pressure]);

        if (this.currentTool === 'highlighter') {
            ctx.globalAlpha = 0.3;
            ctx.globalCompositeOperation = 'multiply';
        }

        if (typeof window.getStroke === 'function') {
            const outlinePoints = window.getStroke(points, {
                size: this.currentWidth * this.scale,
                thinning: this.currentTool === 'highlighter' ? 0 : 0.5,
                smoothing: 0.5,
                streamline: 0.5,
                simulatePressure: true,
            });

            if (outlinePoints.length > 0) {
                ctx.fillStyle = this.currentColor;
                ctx.beginPath();
                ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
                for (let i = 1; i < outlinePoints.length; i++) {
                    ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
                }
                ctx.closePath();
                ctx.fill();
            }
        } else {
            // Fallback: simple line
            ctx.strokeStyle = this.currentColor;
            ctx.lineWidth = this.currentWidth * this.scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    stopDrawing() {
        // Finalize text box drawing
        if (this.isDrawingTextBox) {
            this.isDrawingTextBox = false;

            const x = Math.min(this.textBoxOriginX, this.textBoxCurrentX);
            const y = Math.min(this.textBoxOriginY, this.textBoxCurrentY);
            const w = Math.abs(this.textBoxCurrentX - this.textBoxOriginX);
            const h = Math.abs(this.textBoxCurrentY - this.textBoxOriginY);

            // If the user barely dragged (< 10px), treat as a click — use defaults
            const minDrag = 10 / this.scale;
            if (w < minDrag && h < minDrag) {
                this.createTextAnnotation(this.textBoxOriginX, this.textBoxOriginY, 200, 'auto');
            } else {
                this.createTextAnnotation(x, y, Math.max(40, w), Math.max(20, h));
            }

            // Clear the preview rectangle
            this.renderAnnotations();
            return;
        }

        // Stop panning
        if (this.isPanning) {
            this.isPanning = false;
            const canvas = document.getElementById('annotationCanvas');
            if (this.currentTool === 'select') {
                canvas.style.cursor = 'grab';
            }
            return;
        }

        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Save the completed stroke
        if (this.currentStroke.length > 1 && (this.currentTool === 'marker' || this.currentTool === 'highlighter')) {
            if (!this.annotations[this.currentPage]) {
                this.annotations[this.currentPage] = [];
            }

            this.annotations[this.currentPage].push({
                points: this.currentStroke,
                color: this.currentColor,
                width: this.currentWidth,
                tool: this.currentTool
            });

            this.renderAnnotations();
            this.addToHistory();
            this.saveAnnotations();
        }

        this.currentStroke = [];
    }

    // New Text Tool Methods
    createTextAnnotation(x, y, width = 200, height = 'auto') {
        if (!this.textAnnotations[this.currentPage]) {
            this.textAnnotations[this.currentPage] = [];
        }

        // Scale fontSize relative to box height when a box was drawn
        let fontSize = 16;
        if (height !== 'auto') {
            // Fit font to ~80% of box height for a sensible starting size
            fontSize = Math.max(8, Math.min(200, height * 0.8));
        }

        const textBox = {
            id: Date.now().toString(),
            x: x,
            y: y,
            width: width,
            height: height,
            content: '',
            fontSize: fontSize,
            color: '#444444',
            textAlign: 'left'
        };

        this.textAnnotations[this.currentPage].push(textBox);
        this.renderTextAnnotations();

        // Focus the editable area inside the box (use requestAnimationFrame so layout is complete)
        requestAnimationFrame(() => {
            const wrapper = document.getElementById(`text-box-${textBox.id}`);
            if (wrapper) {
                const editable = wrapper.querySelector('.text-annotation-editable');
                if (editable) editable.focus();
                this.setActiveTextBox(textBox.id);
            }
        });

        this.addToHistory();
        this.saveAnnotations();
    }

    renderTextAnnotations() {
        const textLayer = document.getElementById('textLayer');
        textLayer.innerHTML = ''; // Clear existing
        textLayer.style.width = document.getElementById('pdfCanvas').width + 'px';
        textLayer.style.height = document.getElementById('pdfCanvas').height + 'px';

        const pageTexts = this.textAnnotations[this.currentPage] || [];

        pageTexts.forEach(textBox => {
            // Outer wrapper holds both editable area and resize handle
            const wrapper = document.createElement('div');
            wrapper.id = `text-box-${textBox.id}`;
            wrapper.className = 'text-annotation-box';
            wrapper.dataset.id = textBox.id;

            // Separate contentEditable element (no child elements to corrupt editing)
            const editable = document.createElement('div');
            editable.className = 'text-annotation-editable';
            editable.contentEditable = true;
            editable.setAttribute('placeholder', 'Type here...');

            // Set styles on wrapper for positioning/sizing
            wrapper.style.left = (textBox.x * this.scale) + 'px';
            wrapper.style.top = (textBox.y * this.scale) + 'px';
            wrapper.style.width = (textBox.width * this.scale) + 'px';
            if (textBox.height && textBox.height !== 'auto') {
                wrapper.style.height = (textBox.height * this.scale) + 'px';
            }

            // Font size, color, and alignment on the editable area
            editable.style.fontSize = (textBox.fontSize * this.scale) + 'px';
            editable.style.color = textBox.color;
            editable.style.textAlign = textBox.textAlign || 'left';
            editable.innerText = textBox.content;

            // Add resize handle as sibling of editable (not inside contentEditable)
            const handle = document.createElement('div');
            handle.className = 'resize-handle se';

            wrapper.appendChild(editable);
            wrapper.appendChild(handle);

            // Events on wrapper for drag/select
            wrapper.addEventListener('mousedown', (e) => {
                if (this.currentTool === 'eraser') return;
                if (e.target === handle) return;
                e.stopPropagation();
                this.setActiveTextBox(textBox.id);
                // Only start drag if clicking the wrapper border area, not the editable
                if (e.target !== editable) {
                    this.startTextDrag(e, textBox.id);
                }
            });

            // Click on editable to activate
            editable.addEventListener('mousedown', (e) => {
                if (this.currentTool === 'eraser') return;
                e.stopPropagation();
                this.setActiveTextBox(textBox.id);
            });

            editable.addEventListener('input', () => {
                textBox.content = editable.innerText;
                this.saveAnnotations();
            });

            editable.addEventListener('blur', (e) => {
                // If focus moved to the alignment toolbar, don't remove the box
                const alignBar = document.getElementById('textAlignToolbar');
                if (alignBar && alignBar.contains(e.relatedTarget)) return;

                // Hide alignment toolbar
                this.hideTextAlignToolbar();

                // Auto-remove empty boxes
                if (!textBox.content || textBox.content.trim() === '') {
                    this.textAnnotations[this.currentPage] = this.textAnnotations[this.currentPage].filter(t => t.id !== textBox.id);
                    this.renderTextAnnotations();
                    this.saveAnnotations();
                    return;
                }
            });

            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startTextResize(e, textBox.id);
            });

            textLayer.appendChild(wrapper);
        });
    }

    setActiveTextBox(id) {
        // Remove active class from all
        document.querySelectorAll('.text-annotation-box').forEach(el => el.classList.remove('active'));

        const el = document.getElementById(`text-box-${id}`);
        if (el) {
            el.classList.add('active');
            this.currentTextBox = this.textAnnotations[this.currentPage].find(t => t.id === id);
            this.showTextAlignToolbar(el, this.currentTextBox);
        }
    }

    // --- Text alignment mini-toolbar ---
    createTextAlignToolbar() {
        const bar = document.createElement('div');
        bar.id = 'textAlignToolbar';
        bar.className = 'text-align-toolbar hidden';
        bar.innerHTML = `
            <button class="text-align-btn active" data-align="left" title="Align Left">
                <i class="fa-solid fa-align-left"></i>
            </button>
            <button class="text-align-btn" data-align="center" title="Align Center">
                <i class="fa-solid fa-align-center"></i>
            </button>
            <button class="text-align-btn" data-align="right" title="Align Right">
                <i class="fa-solid fa-align-right"></i>
            </button>
        `;

        // Prevent clicks inside the toolbar from stealing focus / bubbling
        bar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        bar.querySelectorAll('.text-align-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const align = btn.dataset.align;
                this.setTextAlignment(align);
            });
        });

        document.querySelector('.viewer-canvas-area').appendChild(bar);
    }

    showTextAlignToolbar(wrapperEl, textBox) {
        const bar = document.getElementById('textAlignToolbar');
        if (!bar || !wrapperEl || !textBox) { this.hideTextAlignToolbar(); return; }

        bar.classList.remove('hidden');

        // Update active button
        const align = textBox.textAlign || 'left';
        bar.querySelectorAll('.text-align-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === align);
        });

        // Position above the text box, relative to .viewer-canvas-area (the scrollable container)
        const container = document.querySelector('.viewer-canvas-area');
        const containerRect = container.getBoundingClientRect();
        const boxRect = wrapperEl.getBoundingClientRect();

        // Convert to container-scroll-relative coords
        const left = boxRect.left - containerRect.left + container.scrollLeft;
        const top = boxRect.top - containerRect.top + container.scrollTop - bar.offsetHeight - 6;

        bar.style.left = left + 'px';
        bar.style.top = Math.max(0, top) + 'px';
    }

    hideTextAlignToolbar() {
        const bar = document.getElementById('textAlignToolbar');
        if (bar) bar.classList.add('hidden');
    }

    setTextAlignment(align) {
        if (!this.currentTextBox) return;

        this.currentTextBox.textAlign = align;

        // Update the live editable element
        const wrapper = document.getElementById(`text-box-${this.currentTextBox.id}`);
        if (wrapper) {
            const editable = wrapper.querySelector('.text-annotation-editable');
            if (editable) editable.style.textAlign = align;
            this.showTextAlignToolbar(wrapper, this.currentTextBox);
        }

        this.saveAnnotations();
    }

    startTextDrag(e, id) {
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const textBox = this.textAnnotations[this.currentPage].find(t => t.id === id);
        const startX = textBox.x;
        const startY = textBox.y;

        const onMouseMove = (moveEvent) => {
            const dx = (moveEvent.clientX - this.dragStartX) / this.scale;
            const dy = (moveEvent.clientY - this.dragStartY) / this.scale;

            textBox.x = startX + dx;
            textBox.y = startY + dy;

            const el = document.getElementById(`text-box-${id}`);
            if (el) {
                el.style.left = (textBox.x * this.scale) + 'px';
                el.style.top = (textBox.y * this.scale) + 'px';
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.saveAnnotations();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    startTextResize(e, id) {
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const textBox = this.textAnnotations[this.currentPage].find(t => t.id === id);
        const startWidth = textBox.width;
        const startFontSize = textBox.fontSize;
        // height might be 'auto' or a number
        const startHeight = (textBox.height === 'auto' || !textBox.height) ?
            document.getElementById(`text-box-${id}`).offsetHeight / this.scale :
            textBox.height;

        const onMouseMove = (moveEvent) => {
            const dx = (moveEvent.clientX - this.dragStartX) / this.scale;

            // Compute scale ratio from width change
            const newWidth = Math.max(40, startWidth + dx);
            const scaleRatio = newWidth / startWidth;

            // Scale font size proportionally to width change
            const newFontSize = Math.max(8, Math.min(200, startFontSize * scaleRatio));

            textBox.width = newWidth;
            textBox.fontSize = newFontSize;
            // Let height be auto so it flows with the new font size
            textBox.height = 'auto';

            const el = document.getElementById(`text-box-${id}`);
            if (el) {
                el.style.width = (textBox.width * this.scale) + 'px';
                el.style.height = '';
                const editable = el.querySelector('.text-annotation-editable');
                if (editable) {
                    editable.style.fontSize = (textBox.fontSize * this.scale) + 'px';
                }
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.saveAnnotations();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    clearPage() {
        if (!confirm('Clear all annotations on this page?')) return;

        this.annotations[this.currentPage] = [];
        this.textAnnotations[this.currentPage] = []; // Clear text too
        this.renderAnnotations();
        this.addToHistory();
        this.saveAnnotations();
    }

    addToHistory() {
        // Remove any redo history
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add current state (both strokes and text)
        this.history.push({
            strokes: JSON.parse(JSON.stringify(this.annotations)),
            texts: JSON.parse(JSON.stringify(this.textAnnotations))
        });
        this.historyIndex++;

        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.annotations = JSON.parse(JSON.stringify(state.strokes || state));
            this.textAnnotations = JSON.parse(JSON.stringify(state.texts || {}));
            this.renderAnnotations();
            this.saveAnnotations();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.annotations = JSON.parse(JSON.stringify(state.strokes || state));
            this.textAnnotations = JSON.parse(JSON.stringify(state.texts || {}));
            this.renderAnnotations();
            this.saveAnnotations();
        }
    }

    saveCurrentPageAnnotations() {
        // Already saved in real-time
    }

    loadAnnotations() {
        const bookId = Number(this.bookId); // Ensure numeric
        const saved = localStorage.getItem(`annotations_${bookId}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // Support both old format (just strokes) and new format (strokes + texts)
                if (data.strokes || data.texts) {
                    this.annotations = data.strokes || {};
                    this.textAnnotations = data.texts || {};
                } else {
                    this.annotations = data;
                    this.textAnnotations = {};
                }
            } catch (e) {
                console.error('Error loading annotations:', e);
            }
        }

        // Ensure textAnnotations is initialized
        if (!this.textAnnotations) this.textAnnotations = {};

        this.addToHistory();
    }

    renderAnnotations() {
        // Draw stroke annotations on the annotation canvas
        const canvas = document.getElementById('annotationCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pageAnnotations = this.annotations[this.currentPage] || [];
        pageAnnotations.forEach(stroke => {
            if (!stroke.points || stroke.points.length === 0) return;

            const points = stroke.points.map(p => [p.x * this.scale, p.y * this.scale, p.pressure || 0.5]);

            if (stroke.tool === 'highlighter') {
                ctx.globalAlpha = 0.3;
                ctx.globalCompositeOperation = 'multiply';
            } else {
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            }

            if (typeof window.getStroke === 'function') {
                const outlinePoints = window.getStroke(points, {
                    size: (stroke.width || 3) * this.scale,
                    thinning: stroke.tool === 'highlighter' ? 0 : 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                    simulatePressure: true,
                });

                if (outlinePoints.length > 0) {
                    ctx.fillStyle = stroke.color || '#000000';
                    ctx.beginPath();
                    ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
                    for (let i = 1; i < outlinePoints.length; i++) {
                        ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            } else {
                // Fallback: simple line drawing
                ctx.strokeStyle = stroke.color || '#000000';
                ctx.lineWidth = (stroke.width || 3) * this.scale;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(points[0][0], points[0][1]);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i][0], points[i][1]);
                }
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        });

        // Render text annotations on the text layer
        this.renderTextAnnotations();
    }

    eraseAt(x, y) {
        const pageAnnotations = this.annotations[this.currentPage] || [];
        // Scale erase radius so it feels constant size on screen
        const eraseRadius = 10 / this.scale;

        // Find and remove strokes near the eraser
        const remaining = pageAnnotations.filter(stroke => {
            return !stroke.points.some(point => {
                const dx = point.x - x;
                const dy = point.y - y;
                return Math.sqrt(dx * dx + dy * dy) < eraseRadius;
            });
        });

        // Also check text annotations
        const pageTexts = this.textAnnotations[this.currentPage] || [];
        const remainingTexts = pageTexts.filter(textBox => {
            // Check if eraser point is within the box
            // Add a small buffer for easier erasing
            const isInside =
                x >= textBox.x - 5 / this.scale &&
                x <= textBox.x + textBox.width + 5 / this.scale &&
                y >= textBox.y - 5 / this.scale &&
                y <= textBox.y + (textBox.height === 'auto' ? 20 : textBox.height || 20) + 5 / this.scale; // Handle 'auto' height
            return !isInside;
        });

        if (remaining.length !== pageAnnotations.length || remainingTexts.length !== pageTexts.length) {
            this.annotations[this.currentPage] = remaining;
            this.textAnnotations[this.currentPage] = remainingTexts;
            this.renderAnnotations(); // This calls renderTextAnnotations too
            this.addToHistory();
            this.saveAnnotations();
        }
    }

    saveAnnotations() {
        const bookId = Number(this.bookId);
        const data = {
            strokes: this.annotations,
            texts: this.textAnnotations
        };
        localStorage.setItem(`annotations_${bookId}`, JSON.stringify(data));
    }

    // --- Thumbnail Grid ---
    toggleThumbnailGrid() {
        const overlay = document.getElementById('thumbnailOverlay');
        if (overlay.classList.contains('hidden')) {
            this.openThumbnailGrid();
        } else {
            this.closeThumbnailGrid();
        }
    }

    async openThumbnailGrid() {
        const overlay = document.getElementById('thumbnailOverlay');
        const grid = document.getElementById('thumbnailGrid');
        overlay.classList.remove('hidden');

        // Only re-render thumbnails if page count changed or grid is empty
        if (grid.children.length === this.totalPages) {
            this.highlightCurrentThumbnail();
            return;
        }

        grid.innerHTML = '';

        // Render all page thumbnails at a small scale
        const thumbScale = 0.3;

        for (let i = 1; i <= this.totalPages; i++) {
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            if (i === this.currentPage) item.classList.add('current');
            item.dataset.page = i;

            const canvas = document.createElement('canvas');
            const label = document.createElement('span');
            label.className = 'thumbnail-label';
            label.textContent = i;

            item.appendChild(canvas);
            item.appendChild(label);
            grid.appendChild(item);

            item.addEventListener('click', () => {
                this.closeThumbnailGrid();
                this.goToPage(i);
            });

            // Render thumbnail asynchronously (don't await each one — fire in parallel)
            this.renderThumbnail(i, canvas, thumbScale);
        }
    }

    async renderThumbnail(pageNum, canvas, thumbScale) {
        try {
            const page = await this.pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: thumbScale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        } catch (e) {
            // Silently skip failed thumbnails
        }
    }

    highlightCurrentThumbnail() {
        document.querySelectorAll('.thumbnail-item').forEach(item => {
            item.classList.toggle('current', Number(item.dataset.page) === this.currentPage);
        });
    }

    closeThumbnailGrid() {
        document.getElementById('thumbnailOverlay').classList.add('hidden');
    }
}

// Initialize viewer
const viewer = new PDFViewer();
