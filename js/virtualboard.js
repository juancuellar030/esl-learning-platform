// Advanced Virtual Board Module - Excalidraw-like functionality
const VirtualBoardModule = {
    canvas: null,
    ctx: null,
    bgCanvas: null,
    bgCtx: null,
    
    // Drawing state
    isDrawing: false,
    currentTool: 'pen',
    currentColor: '#ff007f', // Default Hot Pink
    currentFontFamily: 'Reddit Sans', // Default Font
    penSize: 3,
    eraserMode: 'pixel',
    eraserSize: 20,
    zoomLevel: 1.0,
    panX: 0,
    panY: 0,
    
    // Elements storage
    elements: [],
    selectedElement: null,
    
    // Interaction state
    draggedElement: null,
    resizingElement: null,
    resizeHandle: null, // 'nw', 'ne', 'sw', 'se'
    dragStartPos: { x: 0, y: 0 },
    initialElementState: null, // Store initial state for resizing
    isEditingText: false,
    isPanning: false,
    lastPanPos: { x: 0, y: 0 },
    
    // History
    history: [],
    historyStep: -1,
    
    // Pages
    pages: [{elements: [], background: 'white'}],
    currentPage: 0,
    currentBackground: 'white',
    
    // Drawing state for smooth curves
    points: [],
    
    // Mouse state
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    
    init() {
        this.canvas = document.getElementById('virtual-board');
        this.ctx = this.canvas.getContext('2d');
        
        // Create background canvas
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = this.canvas.width;
        this.bgCanvas.height = this.canvas.height;
        this.bgCtx = this.bgCanvas.getContext('2d');
        
        this.setupEventListeners();
        this.setBackground('white');
        
        // Initial render
        this.render();
        this.saveState();
        
        // Select pen by default and set pink color active
        this.selectTool('pen');
        this.selectColor('#ff007f');
    },
    
    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.dataset.tool);
            });
        });
        
        // Color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectColor(btn.dataset.color);
            });
        });
        
        // Font selection (Toolbar)
        document.getElementById('toolbar-font-family')?.addEventListener('change', (e) => {
            this.currentFontFamily = e.target.value;
            // Also update selected element if it is text
            if (this.selectedElement && this.selectedElement.type === 'text') {
                this.selectedElement.fontFamily = this.currentFontFamily;
                this.render();
                this.saveState();
            }
        });

        // Pen size
        document.getElementById('pen-size').addEventListener('input', (e) => {
            this.penSize = parseInt(e.target.value);
            document.getElementById('pen-size-display').textContent = this.penSize + 'px';
        });
        
        // Eraser settings
        document.getElementById('eraser-mode').addEventListener('change', (e) => {
            this.eraserMode = e.target.value;
        });
        
        document.getElementById('eraser-size').addEventListener('input', (e) => {
            this.eraserSize = parseInt(e.target.value);
            document.getElementById('eraser-size-display').textContent = this.eraserSize + 'px';
        });

        // Zoom Controls
        document.getElementById('zoom-in').addEventListener('click', () => this.setZoom(this.zoomLevel + 0.1));
        document.getElementById('zoom-out').addEventListener('click', () => this.setZoom(this.zoomLevel - 0.1));
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'TEXTAREA') return; // Allow text editing
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            this.canvas.dispatchEvent(new MouseEvent('mouseup', {}));
        }, { passive: false });
        
        // Undo/Redo
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        
        // Clear
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (confirm('Clear the entire board?')) {
                this.clearCanvas();
            }
        });
        
        // Background
        document.getElementById('board-background').addEventListener('change', (e) => {
            this.setBackground(e.target.value);
            this.render();
        });
        
        // Save/Load/Export
        document.getElementById('save-board-btn').addEventListener('click', () => this.saveBoard());
        document.getElementById('load-board-btn').addEventListener('click', () => this.loadBoard());
        document.getElementById('export-board-btn').addEventListener('click', () => this.exportBoard());
        
        // Page navigation
        document.getElementById('prev-page-btn').addEventListener('click', () => this.prevPage());
        document.getElementById('next-page-btn').addEventListener('click', () => this.nextPage());
        document.getElementById('add-page-btn').addEventListener('click', () => this.addPage());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    },

    setZoom(level) {
        this.zoomLevel = Math.max(0.1, Math.min(5.0, level));
        document.getElementById('zoom-level').textContent = Math.round(this.zoomLevel * 100) + '%';
        this.render();
    },
    
    selectTool(tool) {
        this.currentTool = tool;
        
        // Deselect unless we are in select mode
        if (tool !== 'select') {
            this.selectedElement = null;
            this.hidePropertiesPanels();
        }
        
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
        
        // Show/hide settings
        document.getElementById('pen-settings').style.display = tool === 'pen' ? 'flex' : 'none';
        document.getElementById('eraser-settings').style.display = tool === 'eraser' ? 'flex' : 'none';
        document.getElementById('text-settings').style.display = tool === 'text' ? 'flex' : 'none';
        
        // Update cursor
        if (tool === 'select') {
            this.canvas.style.cursor = 'default';
        } else if (tool === 'text') {
            this.canvas.style.cursor = 'text';
        } else if (tool === 'hand') {
            this.canvas.style.cursor = 'grab';
        } else if (tool === 'image') {
            this.canvas.style.cursor = 'pointer';
            this.promptImageUpload();
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
        
        this.render();
    },
    
    selectColor(color) {
        this.currentColor = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        
        // Update selected text color
        if (this.selectedElement && (this.selectedElement.type === 'text' || this.selectedElement.type === 'stroke')) {
            this.selectedElement.color = color;
            this.render();
            this.saveState();
        }
    },
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Screen coordinates relative to canvas top-left
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        // Convert to World coordinates: (Screen - Pan) / Zoom
        // Note: We need to handle scale of canvas vs CSS size if they differ
        const cssScaleX = this.canvas.width / rect.width;
        const cssScaleY = this.canvas.height / rect.height;
        
        return {
            x: (screenX * cssScaleX - this.panX) / this.zoomLevel,
            y: (screenY * cssScaleY - this.panY) / this.zoomLevel
        };
    },
    
    // --- Interaction Handling ---
    
    handleMouseDown(e) {
        if (this.isEditingText) return;

        // Hand Tool Logic
        if (this.currentTool === 'hand') {
            this.isPanning = true;
            this.lastPanPos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        const pos = this.getMousePos(e);
        this.mouseDown = true;
        this.dragStartPos = pos;
        
        // Check for resize handles first if an element is selected
        if (this.selectedElement && this.currentTool === 'select') {
            const handle = this.getHandleAtPoint(pos, this.selectedElement);
            if (handle) {
                this.resizeHandle = handle;
                this.resizingElement = this.selectedElement;
                this.initialElementState = JSON.parse(JSON.stringify(this.selectedElement));
                return;
            }
        }
        
        if (this.currentTool === 'select') {
            this.handleSelectDown(pos);
        } else if (this.currentTool === 'pen') {
            this.startDrawing(pos);
        } else if (this.currentTool === 'eraser') {
            this.handleEraser(pos);
        } else if (this.currentTool === 'text') {
            // Prevent default to avoid focus stealing causing blur on the new input
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            // Calculate where to place the visual textarea (absolute in container)
            // It should be at the clicked screen position relative to the container
            // The container wraps the canvas, so screenX/Y is correct
            const visualX = e.clientX - rect.left;
            const visualY = e.clientY - rect.top;

            this.startTextEditing(visualX, visualY, pos.x, pos.y);
        }
    },
    
    handleMouseMove(e) {
        if (this.isEditingText) return;

        // Hand Tool Logic
        if (this.isPanning && this.currentTool === 'hand') {
            const dx = e.clientX - this.lastPanPos.x;
            const dy = e.clientY - this.lastPanPos.y;
            
            this.panX += dx;
            this.panY += dy;
            
            this.lastPanPos = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        const pos = this.getMousePos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        
        if (this.currentTool === 'select' && !this.mouseDown) {
             if (this.selectedElement) {
                 const handle = this.getHandleAtPoint(pos, this.selectedElement);
                 if (handle) {
                     this.canvas.style.cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize';
                     return;
                 }
             }
             let overElem = false;
             for (let i = this.elements.length - 1; i >= 0; i--) {
                 if (this.isPointInElement(pos, this.elements[i])) {
                     this.canvas.style.cursor = 'move';
                     overElem = true;
                     break;
                 }
             }
             if (!overElem) this.canvas.style.cursor = 'default';
        }
        
        if (!this.mouseDown) return;
        
        if (this.resizingElement) {
            this.handleResize(pos);
        } else if (this.draggedElement) {
            this.handleDrag(pos);
        } else if (this.currentTool === 'pen' && this.isDrawing) {
            this.continueDrawing(pos);
        } else if (this.currentTool === 'eraser') {
            this.handleEraser(pos);
        }
    },
    
    handleMouseUp(e) {
        if (this.isEditingText) return;

        if (this.currentTool === 'hand') {
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
        }

        this.mouseDown = false;
        this.resizeHandle = null;
        this.resizingElement = null;
        this.initialElementState = null;
        
        if (this.currentTool === 'pen' && this.isDrawing) {
            this.finishDrawing();
        }
        
        if (this.draggedElement) {
            this.draggedElement = null;
            this.saveState();
        }
    },
    
    handleDoubleClick(e) {
        if (this.isEditingText) return;

        const pos = this.getMousePos(e);
        // Check if double clicked on text to edit
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const elem = this.elements[i];
            if (elem.type === 'text' && this.isPointInElement(pos, elem)) {
                
                // Calculate visual position for the textarea from World Coordinates
                // ScreenX = WorldX * Zoom + PanX
                const rect = this.canvas.getBoundingClientRect();
                const cssScaleX = this.canvas.width / rect.width;
                const cssScaleY = this.canvas.height / rect.height;
                
                const visualX = (elem.x * this.zoomLevel + this.panX) / cssScaleX;
                const visualY = (elem.y * this.zoomLevel + this.panY) / cssScaleY;

                this.startTextEditing(visualX, visualY, elem.x, elem.y, elem);
                return;
            }
        }
    },
    
    // --- Selection & Manipulation ---
    
    handleSelectDown(pos) {
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const elem = this.elements[i];
            if (this.isPointInElement(pos, elem)) {
                this.selectedElement = elem;
                this.draggedElement = elem;
                this.dragStartPos = pos;
                this.dragOffsetX = pos.x - elem.x;
                this.dragOffsetY = pos.y - elem.y;
                
                this.showPropertiesPanel(elem);
                if (elem.type === 'text' && document.getElementById('toolbar-font-family')) {
                     document.getElementById('toolbar-font-family').value = elem.fontFamily;
                }
                
                this.render();
                return;
            }
        }
        
        this.selectedElement = null;
        this.hidePropertiesPanels();
        this.render();
    },
    
    handleDrag(pos) {
        if (this.draggedElement) {
            this.draggedElement.x = pos.x - this.dragOffsetX;
            this.draggedElement.y = pos.y - this.dragOffsetY;
            this.render();
        }
    },
    
    getHandleAtPoint(pos, elem) {
        const bounds = this.getElementBounds(elem);
        const handleSize = 10 / this.zoomLevel;
        const tolerance = 5 / this.zoomLevel;
        
        const handles = {
            nw: { x: bounds.x, y: bounds.y },
            ne: { x: bounds.x + bounds.width, y: bounds.y },
            se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            sw: { x: bounds.x, y: bounds.y + bounds.height }
        };
        
        for (const [key, p] of Object.entries(handles)) {
            if (Math.abs(pos.x - p.x) <= handleSize/2 + tolerance &&
                Math.abs(pos.y - p.y) <= handleSize/2 + tolerance) {
                return key;
            }
        }
        return null;
    },
    
    handleResize(pos) {
        const elem = this.resizingElement;
        const initial = this.initialElementState;
        
        if (elem.type === 'image') {
            if (this.resizeHandle === 'se') {
                elem.width = Math.max(20, pos.x - elem.x);
                elem.height = Math.max(20, pos.y - elem.y);
            } else if (this.resizeHandle === 'sw') {
                elem.x = Math.min(pos.x, initial.x + initial.width - 20);
                elem.width = initial.x + initial.width - elem.x;
                elem.height = Math.max(20, pos.y - elem.y);
            } else if (this.resizeHandle === 'ne') {
                elem.y = Math.min(pos.y, initial.y + initial.height - 20);
                elem.height = initial.y + initial.height - elem.y;
                elem.width = Math.max(20, pos.x - elem.x);
            } else if (this.resizeHandle === 'nw') {
                elem.x = Math.min(pos.x, initial.x + initial.width - 20);
                elem.width = initial.x + initial.width - elem.x;
                elem.y = Math.min(pos.y, initial.y + initial.height - 20);
                elem.height = initial.y + initial.height - elem.y;
            }
        } else if (elem.type === 'text') {
            const center = {
                x: initial.x + this.getElementBounds(initial).width / 2,
                y: initial.y + this.getElementBounds(initial).height / 2
            };
            const initialDist = Math.sqrt(Math.pow(this.dragStartPos.x - center.x, 2) + Math.pow(this.dragStartPos.y - center.y, 2));
            const currentDist = Math.sqrt(Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2));
            
            if (initialDist > 0) {
                const scale = currentDist / initialDist;
                elem.fontSize = Math.max(8, Math.round(initial.fontSize * scale));
            }
        }
        
        this.render();
    },
    
    getElementBounds(elem) {
        this.ctx.save();
        if (elem.type === 'text') {
            this.ctx.font = `${elem.fontSize}px ${elem.fontFamily}`;
            const metrics = this.ctx.measureText(elem.text);
            this.ctx.restore();
            return {
                x: elem.x,
                y: elem.y - elem.fontSize * 0.9,
                width: metrics.width,
                height: elem.fontSize * 1.2
            };
        } else if (elem.type === 'image') {
            this.ctx.restore();
            return { x: elem.x, y: elem.y, width: elem.width, height: elem.height };
        } else if (elem.type === 'stroke') {
            this.ctx.restore();
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const point of elem.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            const pad = elem.size / 2;
            return { 
                x: minX - pad, 
                y: minY - pad, 
                width: maxX - minX + elem.size, 
                height: maxY - minY + elem.size 
            };
        }
        this.ctx.restore();
        return { x: 0, y: 0, width: 0, height: 0 };
    },
    
    isPointInElement(pos, elem) {
        const bounds = this.getElementBounds(elem);
        return pos.x >= bounds.x && pos.x <= bounds.x + bounds.width &&
               pos.y >= bounds.y && pos.y <= bounds.y + bounds.height;
    },
    
    // --- Drawing & Rendering ---
    
    startDrawing(pos) {
        this.isDrawing = true;
        this.points = [{x: pos.x, y: pos.y}];
    },
    
    continueDrawing(pos) {
        if (!this.isDrawing) return;
        this.points.push({x: pos.x, y: pos.y});
        this.render();
    },
    
    finishDrawing() {
        if (!this.isDrawing || this.points.length < 2) {
            this.isDrawing = false;
            return;
        }
        
        const stroke = {
            type: 'stroke',
            points: [...this.points],
            color: this.currentColor,
            size: this.penSize,
            id: Date.now()
        };
        
        this.elements.push(stroke);
        this.isDrawing = false;
        this.points = [];
        this.render();
        this.saveState();
    },
    
    drawSmoothStroke(points, color, size) {
        if (points.length < 2) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            this.ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        
        this.ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        this.ctx.stroke();
    },
    
    render() {
        this.ctx.save();
        // Reset transform to clear full screen
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background (which is fixed size currently)
        // If we want background to pan, we must draw it AFTER setting transform
        // OR draw it here but transformed manually?
        // Easiest: Draw it transformed
        this.ctx.restore();
        
        this.ctx.save();
        // Apply global transform (Pan + Zoom)
        this.ctx.setTransform(this.zoomLevel, 0, 0, this.zoomLevel, this.panX, this.panY);
        
        // Draw background inside transform so it moves
        this.ctx.drawImage(this.bgCanvas, 0, 0, this.canvas.width, this.canvas.height);
        
        // Draw all elements
        for (const elem of this.elements) {
            if (elem.type === 'stroke') {
                this.drawSmoothStroke(elem.points, elem.color, elem.size);
            } else if (elem.type === 'text') {
                this.drawText(elem);
            } else if (elem.type === 'image') {
                this.drawImage(elem);
            }
        }
        
        if (this.isDrawing && this.points.length > 0) {
            this.drawSmoothStroke(this.points, this.currentColor, this.penSize);
        }
        
        if (this.selectedElement) {
            this.highlightElement(this.selectedElement);
        }
        
        this.ctx.restore();
    },
    
    drawText(elem) {
        this.ctx.font = `${elem.fontSize}px ${elem.fontFamily}`;
        this.ctx.fillStyle = elem.color;
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(elem.text, elem.x, elem.y);
    },
    
    drawImage(elem) {
        if (elem.img && elem.img.complete) {
            this.ctx.drawImage(elem.img, elem.x, elem.y, elem.width, elem.height);
        }
    },
    
    highlightElement(elem) {
        const bounds = this.getElementBounds(elem);
        
        this.ctx.strokeStyle = 'var(--indigo-velvet)';
        this.ctx.lineWidth = 1 / this.zoomLevel;
        this.ctx.setLineDash([5 / this.zoomLevel, 5 / this.zoomLevel]);
        this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        this.ctx.setLineDash([]);
        
        this.drawHandle(bounds.x, bounds.y);
        this.drawHandle(bounds.x + bounds.width, bounds.y);
        this.drawHandle(bounds.x + bounds.width, bounds.y + bounds.height);
        this.drawHandle(bounds.x, bounds.y + bounds.height);
    },
    
    drawHandle(x, y) {
        const size = 10 / this.zoomLevel;
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#3d348b';
        this.ctx.lineWidth = 2 / this.zoomLevel;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    },
    
    // --- Text Editing ---
    
    startTextEditing(visualX, visualY, canvasX, canvasY, existingElem = null) {
        this.isEditingText = true;
        const container = document.querySelector('.canvas-container');
        
        const existingInput = document.querySelector('.canvas-text-input');
        if (existingInput) existingInput.remove();
        
        const input = document.createElement('textarea');
        input.className = 'canvas-text-input';
        
        let initialValue = '';
        let color = this.currentColor;
        let fontSize = 24;
        let fontFamily = this.currentFontFamily;
        
        if (existingElem) {
            initialValue = existingElem.text;
            color = existingElem.color;
            fontSize = existingElem.fontSize;
            fontFamily = existingElem.fontFamily;
            canvasY = existingElem.y - fontSize * 0.9; 
            canvasX = existingElem.x;
            
            const idx = this.elements.indexOf(existingElem);
            if (idx > -1) this.elements.splice(idx, 1);
            this.render();
        }
        
        input.value = initialValue;
        
        // Position input at visual coordinates
        input.style.transformOrigin = 'top left';
        input.style.transform = `scale(${this.zoomLevel})`;
        input.style.left = visualX + 'px';
        input.style.top = visualY + 'px';
        input.style.color = color;
        input.style.fontSize = fontSize + 'px';
        input.style.fontFamily = fontFamily;
        input.style.minWidth = (fontSize * 2) + 'px';
        
        container.appendChild(input);
        
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        input.style.width = Math.max(100, input.value.length * (fontSize * 0.6)) + 'px';
        
        input.focus();
        
        const finishEdit = () => {
            const text = input.value.trim();
            if (text) {
                const newElem = {
                    type: 'text',
                    text: text,
                    x: canvasX,
                    y: canvasY + fontSize * 0.9,
                    color: color,
                    fontSize: fontSize,
                    fontFamily: fontFamily,
                    id: existingElem ? existingElem.id : Date.now()
                };
                
                this.elements.push(newElem);
                this.selectedElement = newElem;
            }
            
            input.remove();
            this.isEditingText = false;
            this.selectTool('select');
            this.render();
            this.saveState();
        };
        
        input.addEventListener('blur', finishEdit);
        
        // Prevent enter from submitting if shift is held (allow multiline?)
        // Actually, let's allow Enter to finish for single lines, Shift+Enter for newline
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                input.blur();
            }
        });
        
        input.addEventListener('input', () => {
             input.style.height = 'auto';
             input.style.height = input.scrollHeight + 'px';
             input.style.width = 'auto';
             input.style.width = (input.scrollWidth + 10) + 'px';
        });
    },
    
    // --- Eraser ---
    
    handleEraser(pos) {
        if (this.eraserMode === 'pixel') {
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const elem = this.elements[i];
                if (elem.type === 'stroke') {
                    elem.points = elem.points.filter(point => {
                        const dist = Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2));
                        return dist > (this.eraserSize / this.zoomLevel);
                    });
                    if (elem.points.length < 2) {
                        this.elements.splice(i, 1);
                    }
                }
            }
            this.render();
        } else {
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const elem = this.elements[i];
                if (this.isPointInElement(pos, elem)) {
                    this.elements.splice(i, 1);
                    this.render();
                    this.saveState();
                    break;
                }
            }
        }
    },
    
    // --- Image Handling ---
    
    promptImageUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.addImage(file);
            }
            this.selectTool('select');
        };
        input.click();
    },
    
    addImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxWidth = 400;
                const maxHeight = 400;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                const rect = this.canvas.getBoundingClientRect();
                const cssScaleX = this.canvas.width / rect.width;
                const cssScaleY = this.canvas.height / rect.height;
                
                // Center in current view
                const centerX = ((rect.width/2 * cssScaleX) - this.panX) / this.zoomLevel;
                const centerY = ((rect.height/2 * cssScaleY) - this.panY) / this.zoomLevel;

                const imageElement = {
                    type: 'image',
                    src: e.target.result,
                    img: img,
                    x: centerX - width/2,
                    y: centerY - height/2,
                    width: width,
                    height: height,
                    id: Date.now()
                };
                
                this.elements.push(imageElement);
                this.selectedElement = imageElement;
                this.render();
                this.saveState();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },
    
    // --- Properties Panels ---
    
    showPropertiesPanel(elem) {
        if (elem.type === 'text') {
            const panel = document.getElementById('text-properties-panel');
            panel.style.display = 'flex';
            document.getElementById('text-font-family').value = elem.fontFamily;
            document.getElementById('text-font-size').value = elem.fontSize;
            document.getElementById('text-color-picker').value = elem.color;
            
            const updateFont = (e) => { elem.fontFamily = e.target.value; this.render(); this.saveState(); };
            const updateSize = (e) => { elem.fontSize = parseInt(e.target.value); this.render(); this.saveState(); };
            const updateColor = (e) => { elem.color = e.target.value; this.render(); this.saveState(); };
            
            this.updateListener('text-font-family', 'change', updateFont);
            this.updateListener('text-font-size', 'input', updateSize);
            this.updateListener('text-color-picker', 'input', updateColor);
            
            this.updateListener('delete-text-btn', 'click', () => this.deleteSelected());
            
        } else if (elem.type === 'image') {
            const panel = document.getElementById('image-properties-panel');
            panel.style.display = 'flex';
            
            document.getElementById('image-width').value = Math.round(elem.width);
            document.getElementById('image-height').value = Math.round(elem.height);
            
            const updateW = (e) => { elem.width = parseInt(e.target.value); this.render(); this.saveState(); };
            const updateH = (e) => { elem.height = parseInt(e.target.value); this.render(); this.saveState(); };
            
            this.updateListener('image-width', 'input', updateW);
            this.updateListener('image-height', 'input', updateH);
            this.updateListener('delete-image-btn', 'click', () => this.deleteSelected());
        }
    },
    
    updateListener(id, event, handler) {
        const el = document.getElementById(id);
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener(event, handler);
    },
    
    hidePropertiesPanels() {
        document.getElementById('text-properties-panel').style.display = 'none';
        document.getElementById('image-properties-panel').style.display = 'none';
    },
    
    deleteSelected() {
        if (this.selectedElement) {
            const index = this.elements.indexOf(this.selectedElement);
            if (index > -1) {
                this.elements.splice(index, 1);
                this.selectedElement = null;
                this.hidePropertiesPanels();
                this.render();
                this.saveState();
            }
        }
    },
    
    // --- Background & Utilities ---
    
    setBackground(type) {
        this.currentBackground = type;
        this.bgCtx.fillStyle = 'white';
        this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
        
        switch(type) {
            case 'lined': this.drawLinedPaper(); break;
            case 'grid': this.drawGrid(); break;
            case 'chalkboard': 
                this.bgCtx.fillStyle = '#2d4a3e';
                this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
                break;
            case 'nature':
                this.bgCtx.fillStyle = '#e8f5e9';
                this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
                this.drawNaturePattern();
                break;
            case 'space':
                this.bgCtx.fillStyle = '#0d1b2a';
                this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
                this.drawStars();
                break;
        }
    },
    
    drawLinedPaper() {
        this.bgCtx.strokeStyle = '#e0e0e0';
        this.bgCtx.lineWidth = 1;
        for (let y = 40; y < this.bgCanvas.height; y += 40) {
            this.bgCtx.beginPath();
            this.bgCtx.moveTo(0, y);
            this.bgCtx.lineTo(this.bgCanvas.width, y);
            this.bgCtx.stroke();
        }
    },
    
    drawGrid() {
        this.bgCtx.strokeStyle = '#e0e0e0';
        this.bgCtx.lineWidth = 1;
        for (let x = 40; x < this.bgCanvas.width; x += 40) {
            this.bgCtx.beginPath();
            this.bgCtx.moveTo(x, 0);
            this.bgCtx.lineTo(x, this.bgCanvas.height);
            this.bgCtx.stroke();
        }
        for (let y = 40; y < this.bgCanvas.height; y += 40) {
            this.bgCtx.beginPath();
            this.bgCtx.moveTo(0, y);
            this.bgCtx.lineTo(this.bgCanvas.width, y);
            this.bgCtx.stroke();
        }
    },
    
    drawNaturePattern() {
        const emojis = ['🌸', '🌺', '🌻', '🍃', '🌿'];
        this.bgCtx.font = '30px Arial';
        for (let i = 0; i < 15; i++) {
            this.bgCtx.fillText(emojis[Math.floor(Math.random() * emojis.length)], 
                                Math.random() * this.bgCanvas.width, Math.random() * this.bgCanvas.height);
        }
    },
    
    drawStars() {
        this.bgCtx.fillStyle = 'white';
        for (let i = 0; i < 100; i++) {
            this.bgCtx.fillRect(Math.random() * this.bgCanvas.width, Math.random() * this.bgCanvas.height, Math.random() * 2, Math.random() * 2);
        }
        this.bgCtx.font = '20px Arial';
        for (let i = 0; i < 10; i++) {
            this.bgCtx.fillText('⭐', Math.random() * this.bgCanvas.width, Math.random() * this.bgCanvas.height);
        }
    },
    
    clearCanvas() {
        this.elements = [];
        this.render();
        this.saveState();
    },
    
    saveState() {
        this.history = this.history.slice(0, this.historyStep + 1);
        this.history.push({
            elements: JSON.parse(JSON.stringify(this.elements.map(e => e.type === 'image' ? {...e, img: null} : e))),
            background: this.currentBackground
        });
        this.historyStep++;
        if (this.history.length > 50) {
            this.history.shift();
            this.historyStep--;
        }
    },
    
    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState();
        }
    },
    
    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState();
        }
    },
    
    restoreState() {
        const state = this.history[this.historyStep];
        this.elements = JSON.parse(JSON.stringify(state.elements));
        this.elements.forEach(elem => {
            if (elem.type === 'image' && elem.src) {
                const img = new Image();
                img.src = elem.src;
                elem.img = img;
                img.onload = () => this.render();
            }
        });
        this.setBackground(state.background);
        this.render();
    },
    
    saveBoard() {
        this.pages[this.currentPage] = {
            elements: JSON.parse(JSON.stringify(this.elements.map(e => e.type === 'image' ? {...e, img: null} : e))),
            background: this.currentBackground
        };
        localStorage.setItem('virtualBoard', JSON.stringify(this.pages));
        alert('Board saved successfully!');
    },
    
    loadBoard() {
        const data = localStorage.getItem('virtualBoard');
        if (data) {
            this.pages = JSON.parse(data);
            this.currentPage = 0;
            this.loadPage();
            alert('Board loaded successfully!');
        }
    },
    
    exportBoard() {
        const link = document.createElement('a');
        link.download = `board-${Date.now()}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
    },
    
    addPage() {
        this.saveBoard(); // Save current before adding
        this.pages.push({elements: [], background: 'white'});
        this.currentPage = this.pages.length - 1;
        this.loadPage();
    },
    
    prevPage() {
        if (this.currentPage > 0) {
            this.saveBoard();
            this.currentPage--;
            this.loadPage();
        }
    },
    
    nextPage() {
        if (this.currentPage < this.pages.length - 1) {
            this.saveBoard();
            this.currentPage++;
            this.loadPage();
        }
    },
    
    loadPage() {
        const page = this.pages[this.currentPage];
        this.elements = JSON.parse(JSON.stringify(page.elements));
        this.elements.forEach(elem => {
            if (elem.type === 'image' && elem.src) {
                const img = new Image();
                img.src = elem.src;
                elem.img = img;
                img.onload = () => this.render();
            }
        });
        this.setBackground(page.background);
        document.getElementById('board-background').value = page.background;
        document.getElementById('page-indicator').textContent = `Page ${this.currentPage + 1} of ${this.pages.length}`;
        this.render();
        this.saveState();
    },
    
    handleKeyboard(e) {
        if (this.isEditingText) return;

        if (document.getElementById('virtualboard').classList.contains('active')) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.redo(); }
            else if (e.key === 'v') this.selectTool('select');
            else if (e.key === 'p') this.selectTool('pen');
            else if (e.key === 'e') this.selectTool('eraser');
            else if (e.key === 't') this.selectTool('text');
            else if (e.key === 'h') this.selectTool('hand');
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedElement && !document.querySelector('.canvas-text-input')) {
                    e.preventDefault();
                    this.deleteSelected();
                }
            }
        }
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VirtualBoardModule.init());
} else {
    VirtualBoardModule.init();
}

window.VirtualBoardModule = VirtualBoardModule;