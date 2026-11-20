// PDF Viewer built on PDF.js 4.x viewer components.
// Drawing, highlighting, text boxes and images use PDF.js's own annotation
// editor, so annotations are saved into the PDF itself (they also show up
// when the downloaded file is opened in Edge, Acrobat, etc.).

const PDFJS_VERSION = '4.10.38';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

// pdf_viewer.mjs reads the core library from globalThis.pdfjsLib, so the core
// must be loaded (and assigned) before the viewer components are imported.
const pdfjsLib = await import(`${PDFJS_BASE}/build/pdf.min.mjs`);
globalThis.pdfjsLib = pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;
const pdfjsViewer = await import(`${PDFJS_BASE}/web/pdf_viewer.mjs`);

const { AnnotationEditorType: EditorType, AnnotationEditorParamsType: ParamType, AnnotationMode } = pdfjsLib;
const { EventBus, PDFLinkService, PDFViewer, ScrollMode } = pdfjsViewer;

// Our toolbar tool names -> PDF.js editor modes
const TOOL_MODES = {
    select: EditorType.NONE,
    marker: EditorType.INK,
    highlighter: EditorType.HIGHLIGHT,
    text: EditorType.FREETEXT,
    image: EditorType.STAMP,
    // The eraser runs in INK mode so that annotations already saved in the PDF
    // become editable objects we can remove; pointer events are intercepted so
    // nothing gets drawn.
    eraser: EditorType.INK,
};

// Slider settings per tool (PDF.js ranges: ink 1-20, highlight 8-24, font 5-100)
const SLIDER_CONFIG = {
    marker: { label: 'Width', min: 1, max: 20, param: ParamType.INK_THICKNESS },
    highlighter: { label: 'Width', min: 8, max: 24, param: ParamType.HIGHLIGHT_THICKNESS },
    text: { label: 'Size', min: 8, max: 72, param: ParamType.FREETEXT_SIZE },
};

const SCROLL_MODE_KEY = 'pdfViewerScrollMode';
const AUTOSAVE_INTERVAL_MS = 2000;

class PDFViewerApp {
    constructor() {
        this.bookId = null;
        this.bookTitle = '';
        this.pdfDocument = null;
        this.uiManager = null;
        this.currentTool = 'select';
        this.toolColors = { marker: '#000000', highlighter: '#fde047', text: '#000000' };
        this.toolValues = { marker: 3, highlighter: 12, text: 20 };
        this.toolbarVisible = false;
        this.lastSavedHash = '';
        this.isSaving = false;
        this.isErasing = false;

        this.container = document.getElementById('viewerContainer');
        this.init();
    }

    async init() {
        this.bookId = localStorage.getItem('currentBookId');
        if (!this.bookId) {
            alert('No book selected');
            window.location.href = 'pdf-library.html';
            return;
        }

        this.createViewer();
        this.setupEventListeners();
        this.setupZoomGestures();
        this.setupPanning();
        this.setupEraser();
        await this.loadPDF();
    }

    // ---------- Viewer setup ----------

    createViewer() {
        this.eventBus = new EventBus();
        this.linkService = new PDFLinkService({ eventBus: this.eventBus });

        this.pdfViewer = new PDFViewer({
            container: this.container,
            viewer: document.getElementById('viewer'),
            eventBus: this.eventBus,
            linkService: this.linkService,
            annotationMode: AnnotationMode.ENABLE_FORMS,
            // NONE (not DISABLE) turns the annotation editor on
            annotationEditorMode: EditorType.NONE,
            annotationEditorHighlightColors:
                'yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F',
            enableHighlightFloatingButton: false,
            removePageBorders: false,
        });
        this.linkService.setViewer(this.pdfViewer);

        this.eventBus.on('annotationeditoruimanager', ({ uiManager }) => {
            this.uiManager = uiManager;
            // Editor modes can only be set once the UI manager exists
            setTimeout(() => this.setTool(this.currentTool), 0);
        });

        this.eventBus.on('pagesinit', () => {
            this.pdfViewer.currentScaleValue = 'page-fit';
            this.applyScrollMode(localStorage.getItem(SCROLL_MODE_KEY) || 'page');
        });

        this.eventBus.on('pagechanging', ({ pageNumber }) => {
            document.getElementById('pageInput').value = pageNumber;
            this.highlightCurrentThumbnail();
        });

        this.eventBus.on('scalechanging', ({ scale }) => {
            document.getElementById('zoomLevel').textContent = Math.round(scale * 100) + '%';
        });

        this.eventBus.on('annotationeditorstateschanged', ({ details }) => {
            if ('hasSomethingToUndo' in details) {
                document.getElementById('undoBtn').disabled = !details.hasSomethingToUndo;
            }
            if ('hasSomethingToRedo' in details) {
                document.getElementById('redoBtn').disabled = !details.hasSomethingToRedo;
            }
        });

        // When PDF.js leaves an editing mode on its own (e.g. Escape),
        // keep our toolbar in sync.
        this.eventBus.on('annotationeditormodechanged', ({ mode }) => {
            if (mode === EditorType.NONE && this.currentTool !== 'select') {
                this.setTool('select', { skipModeUpdate: true });
            }
        });
    }

    async loadPDF() {
        try {
            const db = await this.openDB();
            const record = await this.getBookRecord(db, Number(this.bookId));
            if (!record?.data) {
                throw new Error('PDF not found in database. Please try re-uploading the book.');
            }

            // getDocument transfers the buffer to the worker, so pass a copy
            this.pdfDocument = await pdfjsLib.getDocument({ data: record.data.slice(0) }).promise;

            this.pdfViewer.setDocument(this.pdfDocument);
            this.linkService.setDocument(this.pdfDocument, null);

            const metadata = JSON.parse(localStorage.getItem('pdfLibraryMetadata') || '[]');
            const book = metadata.find(b => b.id == this.bookId);
            this.bookTitle = book ? book.title : 'Unknown Book';

            document.getElementById('bookTitle').textContent = this.bookTitle;
            document.getElementById('totalPages').textContent = this.pdfDocument.numPages;
            document.getElementById('pageInput').max = this.pdfDocument.numPages;
            document.getElementById('loadingOverlay').style.display = 'none';

            this.lastSavedHash = this.getAnnotationHash();
            this.autosaveTimer = setInterval(() => this.autosave(), AUTOSAVE_INTERVAL_MS);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error loading PDF: ' + error.message + '\n\nPlease return to the library and try again.');
            setTimeout(() => { window.location.href = 'pdf-library.html'; }, 3000);
        }
    }

    // ---------- IndexedDB ----------

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PDFLibraryDB', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getBookRecord(db, bookId) {
        return new Promise((resolve, reject) => {
            const request = db.transaction(['books'], 'readonly').objectStore('books').get(bookId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async putBookRecord(record) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(['books'], 'readwrite').objectStore('books').put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ---------- Saving ----------

    getAnnotationHash() {
        return this.pdfDocument?.annotationStorage.serializable.hash || '';
    }

    async autosave() {
        if (this.isSaving || !this.pdfDocument) return;
        const hash = this.getAnnotationHash();
        if (hash === this.lastSavedHash) return;
        await this.saveAnnotations(hash);
    }

    async saveAnnotations(hash = this.getAnnotationHash()) {
        if (this.isSaving) return;
        this.isSaving = true;
        this.setSaveStatus('Saving…');
        try {
            // PDF.js saves incrementally: the original file stays intact at the
            // start and the annotations are appended after it.
            const bytes = await this.pdfDocument.saveDocument();
            const data = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
                ? bytes.buffer
                : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            await this.putBookRecord({ id: Number(this.bookId), data });
            this.lastSavedHash = hash;
            this.setSaveStatus('Saved');
        } catch (error) {
            console.error('Error saving annotations:', error);
            this.setSaveStatus('Save failed');
        } finally {
            this.isSaving = false;
        }
    }

    setSaveStatus(text) {
        const el = document.getElementById('saveStatus');
        el.textContent = text;
        clearTimeout(this.saveStatusTimer);
        if (text === 'Saved') {
            this.saveStatusTimer = setTimeout(() => { el.textContent = ''; }, 2000);
        }
    }

    async downloadPDF() {
        const bytes = await this.pdfDocument.saveDocument();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.bookTitle || 'document').replace(/[\\/:*?"<>|]/g, '') + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async closeViewer() {
        this.commitDrawing();
        // Let PDF.js finish committing any open editor before saving
        await new Promise(r => setTimeout(r, 50));
        if (this.getAnnotationHash() !== this.lastSavedHash) {
            await this.saveAnnotations();
        }
        window.location.href = 'pdf-library.html';
    }

    // ---------- UI events ----------

    setupEventListeners() {
        const $ = id => document.getElementById(id);

        // Page navigation
        $('prevPageBtn').addEventListener('click', () => this.pdfViewer.previousPage());
        $('nextPageBtn').addEventListener('click', () => this.pdfViewer.nextPage());
        $('pageInput').addEventListener('change', (e) => this.goToPage(parseInt(e.target.value)));

        // Zoom
        $('zoomInBtn').addEventListener('click', () => this.pdfViewer.increaseScale());
        $('zoomOutBtn').addEventListener('click', () => this.pdfViewer.decreaseScale());
        $('zoomResetBtn').addEventListener('click', () => { this.pdfViewer.currentScaleValue = 1; });
        $('fitWidthBtn').addEventListener('click', () => { this.pdfViewer.currentScaleValue = 'page-width'; });
        $('fitPageBtn').addEventListener('click', () => { this.pdfViewer.currentScaleValue = 'page-fit'; });

        // View mode
        $('singlePageModeBtn').addEventListener('click', () => this.applyScrollMode('page'));
        $('continuousModeBtn').addEventListener('click', () => this.applyScrollMode('continuous'));

        // Tools
        ['select', 'marker', 'highlighter', 'text', 'image', 'eraser'].forEach(tool => {
            $(tool + 'ToolBtn').addEventListener('click', () => this.setTool(tool));
        });

        $('strokeWidthSlider').addEventListener('input', (e) => {
            const config = SLIDER_CONFIG[this.currentTool];
            if (!config) return;
            const value = parseInt(e.target.value);
            this.toolValues[this.currentTool] = value;
            this.uiManager?.updateParams(config.param, value);
            this.updateStrokePreview();
        });

        // Toolbar toggle
        $('toolbarToggleBtn').addEventListener('click', () => this.toggleToolbar());
        $('toolbarCloseBtn').addEventListener('click', () => this.toggleToolbar());

        // Color palette
        $('colorPreviewBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            $('colorPalettePopup').classList.toggle('hidden');
        });
        document.querySelectorAll('.palette-color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setColor(e.currentTarget.dataset.color);
                this.hideColorPalette();
            });
        });
        document.addEventListener('click', (e) => {
            if (!$('colorPalettePopup').contains(e.target) && !$('colorPreviewBtn').contains(e.target)) {
                this.hideColorPalette();
            }
        });

        // Thumbnails
        $('thumbnailGridBtn').addEventListener('click', () => this.toggleThumbnailGrid());
        $('thumbnailCloseBtn').addEventListener('click', () => this.closeThumbnailGrid());

        // Actions
        $('undoBtn').addEventListener('click', () => this.uiManager?.undo());
        $('redoBtn').addEventListener('click', () => this.uiManager?.redo());
        $('undoBtn').disabled = true;
        $('redoBtn').disabled = true;
        $('clearPageBtn').addEventListener('click', () => this.clearPage());
        $('downloadBtn').addEventListener('click', () => this.downloadPDF());
        $('closeViewerBtn').addEventListener('click', () => this.closeViewer());

        // Each pen stroke becomes its own annotation (like Edge), so the
        // eraser and undo work stroke by stroke.
        // (window, because PDF.js tracks the stroke's pointerup there; the
        // timeout lets PDF.js finish the stroke first)
        window.addEventListener('pointerup', () => {
            if (this.currentTool === 'marker') {
                setTimeout(() => {
                    this.commitDrawing();
                    this.uiManager?.unselectAll();
                }, 0);
            }
        });

        // Keyboard shortcuts (capture phase so PDF.js doesn't also handle undo)
        window.addEventListener('keydown', (e) => {
            const target = e.target;
            const isTyping = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
            if (isTyping) return;

            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault(); e.stopImmediatePropagation(); this.uiManager?.undo();
            } else if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault(); e.stopImmediatePropagation(); this.uiManager?.redo();
            } else if (!ctrl && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
                if (this.uiManager?.hasSelection) return; // arrows move a selected annotation
                e.preventDefault(); this.pdfViewer.previousPage();
            } else if (!ctrl && (e.key === 'ArrowRight' || e.key === 'PageDown')) {
                if (this.uiManager?.hasSelection) return;
                e.preventDefault(); this.pdfViewer.nextPage();
            }
        }, true);

        // Best-effort save if the tab is hidden or closed
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.autosave();
        });
    }

    goToPage(pageNum) {
        if (pageNum >= 1 && pageNum <= this.pdfViewer.pagesCount) {
            this.pdfViewer.currentPageNumber = pageNum;
        } else {
            document.getElementById('pageInput').value = this.pdfViewer.currentPageNumber;
        }
    }

    applyScrollMode(mode) {
        const isPage = mode === 'page';
        const page = this.pdfViewer.currentPageNumber;
        this.pdfViewer.scrollMode = isPage ? ScrollMode.PAGE : ScrollMode.VERTICAL;
        if (page) this.pdfViewer.currentPageNumber = page;
        localStorage.setItem(SCROLL_MODE_KEY, mode);
        document.getElementById('singlePageModeBtn').classList.toggle('active', isPage);
        document.getElementById('continuousModeBtn').classList.toggle('active', !isPage);
    }

    // ---------- Tools ----------

    setTool(tool, { skipModeUpdate = false } = {}) {
        this.commitDrawing();
        this.currentTool = tool;

        document.querySelectorAll('.floating-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + 'ToolBtn')?.classList.add('active');
        this.container.dataset.tool = tool;

        if (!skipModeUpdate && this.uiManager) {
            this.pdfViewer.annotationEditorMode = { mode: TOOL_MODES[tool] };
            if (tool === 'image') {
                // Opens the file picker and drops the image on the current page
                setTimeout(() => this.uiManager?.updateParams(ParamType.CREATE, null), 0);
            }
        }

        // Apply this tool's color and size defaults
        this.applyColorToTool();
        const config = SLIDER_CONFIG[tool];
        const slider = document.getElementById('strokeWidthSlider');
        const group = document.querySelector('.stroke-width-group');
        group.classList.toggle('disabled', !config);
        if (config) {
            slider.min = config.min;
            slider.max = config.max;
            slider.value = this.toolValues[tool];
            document.getElementById('strokeWidthLabel').textContent = config.label;
            this.uiManager?.updateParams(config.param, this.toolValues[tool]);
        }
        this.updateStrokePreview();
    }

    // Finish the current ink drawing session so the stroke becomes its own annotation
    commitDrawing() {
        if (!this.uiManager) return;
        const pageIndex = this.pdfViewer.currentPageNumber - 1;
        for (let i = Math.max(0, pageIndex - 1); i <= pageIndex + 1; i++) {
            this.uiManager.getLayer(i)?.endDrawingSession?.();
        }
    }

    // Each tool remembers its own color (like Edge). Tools without a color
    // (hand, eraser, image) show and change the pen's color.
    get colorTool() {
        return this.currentTool in this.toolColors ? this.currentTool : 'marker';
    }

    get currentColor() {
        return this.toolColors[this.colorTool];
    }

    setColor(color) {
        this.toolColors[this.colorTool] = color;
        this.applyColorToTool();
        this.updateStrokePreview();
    }

    applyColorToTool() {
        if (!this.uiManager) return;
        const paramByTool = {
            marker: ParamType.INK_COLOR,
            highlighter: ParamType.HIGHLIGHT_DEFAULT_COLOR,
            text: ParamType.FREETEXT_COLOR,
        };
        const param = paramByTool[this.currentTool];
        if (param) this.uiManager.updateParams(param, this.currentColor);
    }

    updateStrokePreview() {
        const preview = document.getElementById('strokePreview');
        const value = this.toolValues[this.currentTool] ?? 3;
        const config = SLIDER_CONFIG[this.currentTool];
        // Keep the preview inside its 32px box regardless of the tool's range
        const width = config ? Math.max(2, Math.round((value / config.max) * 24)) : 3;
        preview.style.width = width + 'px';
        preview.style.background = this.currentColor;
        document.getElementById('colorPreview').style.background = this.currentColor;
        preview.style.opacity = this.currentTool === 'highlighter' ? 0.5 : 1;
    }

    toggleToolbar() {
        this.toolbarVisible = !this.toolbarVisible;
        document.getElementById('floatingToolbar').classList.toggle('hidden', !this.toolbarVisible);
        if (!this.toolbarVisible) this.hideColorPalette();
    }

    hideColorPalette() {
        document.getElementById('colorPalettePopup').classList.add('hidden');
    }

    async clearPage() {
        if (!this.uiManager) return;
        const previousTool = this.currentTool;
        if (previousTool === 'select') {
            // Annotations already saved in the PDF only become removable
            // editors while an editing mode is active; PDF.js converts them
            // asynchronously, so give it a moment.
            this.setTool('eraser');
        }
        const pageIndex = this.pdfViewer.currentPageNumber - 1;
        await this.waitForSavedAnnotationEditors(pageIndex);
        const editors = this.uiManager.getEditors(pageIndex).filter(ed => !ed.isEmpty?.());
        if (editors.length > 0 && confirm(`Clear all ${editors.length} annotation(s) on this page?`)) {
            this.uiManager.unselectAll();
            editors.forEach(ed => this.uiManager.toggleSelected(ed));
            this.uiManager.delete(); // undoable
        }
        if (previousTool === 'select') this.setTool('select');
    }

    // Wait (max 3s) until every annotation stored in the PDF on this page has
    // been turned into an editor by PDF.js.
    async waitForSavedAnnotationEditors(pageIndex) {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
            const layer = this.pdfViewer.getPageView(pageIndex)?.annotationLayer?.annotationLayer;
            const expected = (layer?.getEditableAnnotations() || [])
                .filter(el => !this.uiManager.isDeletedAnnotationElement(el.data.id)).length;
            const converted = this.uiManager.getEditors(pageIndex)
                .filter(ed => ed.annotationElementId).length;
            if (converted >= expected) return;
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // ---------- Hand tool (pan) ----------

    setupPanning() {
        let panning = null;
        this.container.addEventListener('pointerdown', (e) => {
            if (this.currentTool !== 'select' || e.button !== 0) return;
            if (e.target.closest('a, .annotationLayer section')) return; // keep links clickable
            panning = {
                x: e.clientX, y: e.clientY,
                left: this.container.scrollLeft, top: this.container.scrollTop,
            };
            this.container.classList.add('panning');
            this.container.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        this.container.addEventListener('pointermove', (e) => {
            if (!panning) return;
            this.container.scrollLeft = panning.left - (e.clientX - panning.x);
            this.container.scrollTop = panning.top - (e.clientY - panning.y);
        });
        const stop = () => {
            panning = null;
            this.container.classList.remove('panning');
        };
        this.container.addEventListener('pointerup', stop);
        this.container.addEventListener('pointercancel', stop);
    }

    // ---------- Eraser ----------

    setupEraser() {
        // Capture phase: stop PDF.js from starting an ink stroke while erasing
        const block = (e) => {
            if (this.currentTool !== 'eraser') return;
            if (!e.target.closest?.('.page')) return;
            e.stopPropagation();
            e.preventDefault();
            if (e.type === 'pointerdown') {
                this.isErasing = true;
                this.container.setPointerCapture?.(e.pointerId);
                this.eraseAt(e.clientX, e.clientY);
            } else if (e.type === 'pointermove' && this.isErasing) {
                this.eraseAt(e.clientX, e.clientY);
            }
        };
        ['pointerdown', 'pointermove', 'mousedown', 'click', 'dblclick'].forEach(type => {
            this.container.addEventListener(type, block, true);
        });
        window.addEventListener('pointerup', () => { this.isErasing = false; }, true);
    }

    eraseAt(clientX, clientY) {
        if (!this.uiManager) return;
        const tolerance = 6;
        const pageIndex = this.pageIndexAt(clientX, clientY);
        if (pageIndex < 0) return;

        // Topmost (last added) annotation under the pointer wins
        const editors = this.uiManager.getEditors(pageIndex).reverse();
        for (const editor of editors) {
            if (this.hitTest(editor, clientX, clientY, tolerance)) {
                this.uiManager.unselectAll();
                this.uiManager.toggleSelected(editor);
                this.uiManager.delete(); // undoable
                return;
            }
        }
    }

    pageIndexAt(clientX, clientY) {
        const pageEl = document.elementsFromPoint(clientX, clientY).find(el => el.classList?.contains('page'));
        return pageEl ? Number(pageEl.dataset.pageNumber) - 1 : -1;
    }

    hitTest(editor, x, y, tolerance) {
        const div = editor.div;
        if (!div || div.hidden) return false;
        const box = div.getBoundingClientRect();
        if (x < box.left - tolerance || x > box.right + tolerance ||
            y < box.top - tolerance || y > box.bottom + tolerance) {
            return false;
        }
        // Ink strokes: check distance to the actual path, not just its bounding box
        if (editor.editorType === 'ink' && editor._drawId !== null && editor._drawId !== undefined) {
            const path = document.getElementById(`path_p${editor.pageIndex}_${editor._drawId}`);
            const use = path?.closest('svg')?.querySelector('use');
            const ctm = use?.getScreenCTM();
            if (path && ctm) {
                const total = path.getTotalLength();
                const strokeWidth = (editor.thickness || 3) * (this.pdfViewer.currentScale || 1);
                const maxDist = strokeWidth / 2 + tolerance;
                const steps = Math.min(400, Math.max(20, Math.ceil(total * 200)));
                for (let i = 0; i <= steps; i++) {
                    const p = path.getPointAtLength((total * i) / steps);
                    const sx = ctm.a * p.x + ctm.c * p.y + ctm.e;
                    const sy = ctm.b * p.x + ctm.d * p.y + ctm.f;
                    if (Math.hypot(sx - x, sy - y) <= maxDist) return true;
                }
                return false;
            }
        }
        return true;
    }

    // ---------- Zoom gestures ----------

    setupZoomGestures() {
        // Ctrl + wheel / trackpad pinch
        this.container.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            this.pdfViewer.updateScale({
                scaleFactor: Math.exp(-e.deltaY / 300),
                origin: [e.clientX, e.clientY],
                drawingDelay: 300,
            });
        }, { passive: false });

        // Two-finger pinch on touch screens
        let pinch = null;
        this.container.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const [a, b] = e.touches;
            pinch = { dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) };
        }, { passive: false });
        this.container.addEventListener('touchmove', (e) => {
            if (!pinch || e.touches.length !== 2) return;
            e.preventDefault();
            const [a, b] = e.touches;
            const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
            this.pdfViewer.updateScale({
                scaleFactor: dist / pinch.dist,
                origin: [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2],
                drawingDelay: 300,
            });
            pinch.dist = dist;
        }, { passive: false });
        this.container.addEventListener('touchend', () => { pinch = null; });
    }

    // ---------- Thumbnail grid ----------

    toggleThumbnailGrid() {
        const overlay = document.getElementById('thumbnailOverlay');
        if (overlay.classList.contains('hidden')) this.openThumbnailGrid();
        else this.closeThumbnailGrid();
    }

    openThumbnailGrid() {
        const overlay = document.getElementById('thumbnailOverlay');
        const grid = document.getElementById('thumbnailGrid');
        overlay.classList.remove('hidden');

        const totalPages = this.pdfDocument.numPages;
        if (grid.children.length === totalPages) {
            this.highlightCurrentThumbnail();
            return;
        }

        grid.innerHTML = '';
        const thumbScale = 0.3;

        this.thumbnailObserver?.disconnect();
        this.thumbnailObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const item = entry.target;
                const canvas = item.querySelector('canvas');
                if (canvas.dataset.rendered || canvas.dataset.rendering) return;
                canvas.dataset.rendering = 'true';
                this.renderThumbnail(Number(item.dataset.page), canvas, thumbScale).then(() => {
                    canvas.dataset.rendered = 'true';
                });
            });
        }, { root: grid, rootMargin: '100px' });

        for (let i = 1; i <= totalPages; i++) {
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            item.dataset.page = i;
            const canvas = document.createElement('canvas');
            const label = document.createElement('span');
            label.className = 'thumbnail-label';
            label.textContent = i;
            item.append(canvas, label);
            grid.appendChild(item);
            item.addEventListener('click', () => {
                this.closeThumbnailGrid();
                this.goToPage(i);
            });
            this.thumbnailObserver.observe(item);
        }
        this.highlightCurrentThumbnail();
    }

    async renderThumbnail(pageNum, canvas, thumbScale) {
        try {
            const page = await this.pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: thumbScale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        } catch (e) {
            // Skip failed thumbnails
        }
    }

    highlightCurrentThumbnail() {
        const current = this.pdfViewer.currentPageNumber;
        document.querySelectorAll('.thumbnail-item').forEach(item => {
            item.classList.toggle('current', Number(item.dataset.page) === current);
        });
    }

    closeThumbnailGrid() {
        document.getElementById('thumbnailOverlay').classList.add('hidden');
    }
}

window.pdfViewerApp = new PDFViewerApp();
