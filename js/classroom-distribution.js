
const students = [
    'ALEJANDRA H.', 'ALEJANDRO C.', 'ANAMARIA C.', 'ANTONELLA P.', 'BRIANA C.',
    'DANIEL P.', 'DANNA P.', 'EMILIANO Q.', 'EMILIANO T.', 'EMILIO R.',
    'ERMES V.', 'EVA MARIA P.', 'JUAN J. RÍOS', 'JUAN J. SARRIAS', 'KESHIA C.',
    'LAURA S.', 'LAURA BERNAL', 'LORENZO R.', 'LUCIANO M.', 'MATIAS F.',
    'MIA H.', 'PABLO A.', 'PAULA V.', 'SAMANTHA C', 'SAMUEL G.',
    'SANTIAGO O.', 'SARA LUCÍA V.', 'THOMAS C.', 'VALERIA P.'
];

const GRID_ROWS = 7;
const GRID_COLS = 7;
const CELL_SIZE = 100;
const CELL_GAP = 10;
const STORAGE_KEY = 'classroom_layout_data';

let desks = []; // Array of desk objects: { id, name, gender, position: {type: 'grid'|'relocation', index: 0} }
let gridState = new Array(GRID_ROWS * GRID_COLS).fill(null); // Stores desk IDs or null
let columnWidths = new Array(GRID_COLS).fill(100); // 100% or reduced
let isDragging = false;
let draggedDeskId = null;
let dragOffset = { x: 0, y: 0 };
let namesVisible = true;

document.addEventListener('DOMContentLoaded', () => {
    initGrid();
    loadLayout() || initDesks(); // Load if exists, else init default
    renderDesks();
    setupEventListeners();

    // Handle window resize for relocation area width
    window.addEventListener('resize', updateHallwayVisuals);
});

function initGrid() {
    const grid = document.getElementById('classroom-grid');
    const resizersContainer = document.getElementById('column-resizers');
    grid.innerHTML = '';
    resizersContainer.innerHTML = '';

    // Create Cells
    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;

        // Label for row/col (optional, for debugging or ref)
        // const label = document.createElement('span');
        // label.className = 'cell-label';
        // label.innerText = i;
        // cell.appendChild(label);

        grid.appendChild(cell);
    }

    // Create Column Resizers
    for (let i = 0; i < GRID_COLS; i++) {
        const resizerWrapper = document.createElement('div');
        resizerWrapper.className = 'grid-column-header';

        const resizer = document.createElement('div');
        resizer.className = 'column-resizer';
        resizer.title = 'Toggle Hallway Mode';
        resizer.dataset.col = i;
        resizer.addEventListener('click', () => toggleColumnWidth(i));

        resizerWrapper.appendChild(resizer);
        resizersContainer.appendChild(resizerWrapper);
    }
}

function initDesks() {
    // Populate initial students into Relocation Area or default grid positions?
    // Requirement says: "Pre-populate with the 29-30 names... in Relocation Area" 
    // Wait, requirement says "Pre-populate with...". Usually this means they start available. 
    // Requirement 4 says "Secondary Drop Zone... to store students who are not currently assigned"
    // So initially maybe we put them in the relocation area to let the teacher place them?
    // Or fill the grid sequentially? I'll fill the relocation area first as it's cleaner.

    // Add Teacher Desk
    // Add Teacher Desks (Two separate blocks)
    desks.push({
        id: 'teacher-1',
        name: 'TEACHER',
        gender: 'teacher',
        position: { type: 'grid', index: Math.floor(GRID_COLS / 2) }
    });

    desks.push({
        id: 'teacher-2',
        name: 'TEACHER',
        gender: 'teacher',
        position: { type: 'grid', index: Math.floor(GRID_COLS / 2) + 1 }
    });

    students.forEach((name, i) => {
        desks.push({
            id: `student-${i}`,
            name: name,
            gender: 'boy', // Default, can be toggled
            position: { type: 'relocation', index: i }
        });
    });
}

function renderDesks() {
    // Clear existing desks from DOM
    document.querySelectorAll('.desk').forEach(el => el.remove());

    // Reset Grid State
    gridState.fill(null);

    const gridEl = document.getElementById('classroom-grid');
    const relocationEl = document.getElementById('relocation-area');

    desks.forEach(desk => {
        const deskEl = createDeskElement(desk);

        if (desk.position.type === 'grid') {
            // Position absolutely within the grid
            // But wait, the grid uses CSS grid. 
            // Better to append to the grid container and use transform translate?
            // Or append to the cell?
            // Drag and drop needs smooth movement across cells.
            // If I append to cell, animation is harder.
            // I will append all to grid container or body, but visual positioning is key.
            // For simplicity in "snapping", appending to the cell is easiest for layout, 
            // but for dragging, we need absolute.

            // Let's try appending to the specific cell.
            const cellIndex = desk.position.index;
            if (cellIndex >= 0 && cellIndex < gridState.length) {
                const cell = gridEl.children[cellIndex];

                // If teacher desk, it might span 2 cells visually, but logically anchored to one.
                if (desk.gender === 'teacher') {
                    deskEl.classList.add('desk-teacher');
                    // Adjust style to span
                }

                // If utilizing drag-drop API or mouse events. 
                // Let's just append to relocation or grid container positioned absolutely?
                // No, standard flow: Append to cell.
                // Dragging: set position fixed/absolute, on drop, re-append to new cell.

                cell.appendChild(deskEl);
                gridState[cellIndex] = desk.id;
            }
        } else {
            relocationEl.appendChild(deskEl);
            deskEl.style.position = 'relative';
            deskEl.style.transform = 'none';
        }
    });

    updateHallwayVisuals();
}

function createDeskElement(desk) {
    const el = document.createElement('div');
    el.className = `desk student-${desk.gender}`;
    el.id = desk.id;
    el.draggable = true;

    if (desk.gender === 'teacher') el.classList.add('desk-teacher');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'desk-name';
    nameSpan.innerText = desk.name;
    if (!namesVisible && desk.gender !== 'teacher') nameSpan.style.display = 'none';
    el.appendChild(nameSpan);

    // Controls
    if (desk.gender !== 'teacher') {
        const controls = document.createElement('div');
        controls.className = 'desk-controls';

        // Gender Toggle
        const genderBtn = document.createElement('button');
        genderBtn.className = 'desk-btn';
        genderBtn.innerHTML = '<i class="fa-solid fa-venus-mars"></i>';
        genderBtn.title = 'Switch Gender';
        genderBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent drag start
            toggleGender(desk.id);
        };

        controls.appendChild(genderBtn);

        // Delete button (only for custom students, not original list)
        if (!students.includes(desk.name)) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'desk-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = 'Delete Student';
            deleteBtn.style.background = 'rgba(255, 100, 100, 0.6)';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteStudent(desk.id);
            };
            controls.appendChild(deleteBtn);
        }

        el.appendChild(controls);
    }

    // Drag Events
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);

    return el;
}

function handleDragStart(e) {
    isDragging = true;
    draggedDeskId = e.target.id;
    e.target.classList.add('dragging');
    // e.dataTransfer.setData('text/plain', e.target.id); // For Firefox
    e.dataTransfer.effectAllowed = 'move';

    // Create a ghost image if needed, or let browser handle it.
    // Browser default is usually fine for these boxes.
}

function handleDragEnd(e) {
    isDragging = false;
    e.target.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// Drop Zones
function setupEventListeners() {
    const gridCells = document.querySelectorAll('.grid-cell');
    const relocationArea = document.getElementById('relocation-area');

    gridCells.forEach(cell => {
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDropGrid);
    });

    relocationArea.addEventListener('dragover', handleDragOver);
    relocationArea.addEventListener('dragleave', handleDragLeave);
    relocationArea.addEventListener('drop', handleDropRelocation);

    // Toolbar Buttons
    document.getElementById('save-layout-btn').addEventListener('click', saveLayout);
    document.getElementById('reset-layout-btn').addEventListener('click', () => {
        if (confirm('Reset all desks to relocation area?')) {
            desks = [];
            initDesks();
            renderDesks();
            saveLayout();
        }
    });

    document.getElementById('toggle-names-btn').addEventListener('click', () => {
        namesVisible = !namesVisible;
        renderDesks();
    });

    document.getElementById('add-student-btn').addEventListener('click', addNewStudent);
    document.getElementById('random-relocation-btn').addEventListener('click', randomRelocation);
    document.getElementById('export-btn').addEventListener('click', exportToJSON);
    document.getElementById('import-file').addEventListener('change', importFromJSON);
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDropGrid(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedDeskId) return;

    const targetCellIndex = parseInt(e.currentTarget.dataset.index);
    const draggedDesk = desks.find(d => d.id === draggedDeskId);

    if (!draggedDesk) return;

    // Check if cell is occupied
    const occupiedBy = gridState[targetCellIndex];

    if (occupiedBy && occupiedBy !== draggedDeskId) {
        // SWAP LOGIC
        const occupierDesk = desks.find(d => d.id === occupiedBy);

        // If dragged desk was in grid, move occupier to dragged desk's old spot
        if (draggedDesk.position.type === 'grid') {
            const oldIndex = draggedDesk.position.index;
            occupierDesk.position = { type: 'grid', index: oldIndex };
        } else {
            // Dragged from relocation -> Occupier goes to relocation? 
            // Or we just don't allow swapping from relocation to grid if occupied?
            // Auto-Swap logic says: "student previously in that cell should automatically move to the cell vacated"
            // If came from relocation, "vacated" is relocation.
            occupierDesk.position = { type: 'relocation', index: 0 }; // Append to end logic handles index
        }
    }

    // Move dragged desk to new spot
    draggedDesk.position = { type: 'grid', index: targetCellIndex };

    renderDesks();
    saveLayout();
}

function handleDropRelocation(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedDeskId) return;

    const draggedDesk = desks.find(d => d.id === draggedDeskId);
    if (draggedDesk) {
        draggedDesk.position = { type: 'relocation', index: 0 };
        renderDesks();
        saveLayout();
    }
}

function toggleGender(deskId) {
    const desk = desks.find(d => d.id === deskId);
    if (desk) {
        desk.gender = desk.gender === 'boy' ? 'girl' : 'boy';
        renderDesks();
        saveLayout();
    }
}

function toggleColumnWidth(colIndex) {
    // Check if column is empty
    const cellsInCol = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        cellsInCol.push(r * GRID_COLS + colIndex);
    }

    const hasDesks = cellsInCol.some(idx => gridState[idx] !== null);

    if (hasDesks) {
        alert('Cannot resize column with desks in it. Move desks first.');
        return;
    }

    const gridEl = document.getElementById('classroom-grid');
    const resizers = document.querySelectorAll('.column-resizer');

    // Toggle width logic
    // We need to update CSS Grid Template Columns directly
    const currentStyles = window.getComputedStyle(gridEl);
    // Since we are not storing column state in JS explicitly simply (just checks),
    // let's look at the resizer class

    resizers[colIndex].classList.toggle('hallway-active');

    updateHallwayVisuals();
}

function updateHallwayVisuals() {
    const gridEl = document.getElementById('classroom-grid');
    const relocationEl = document.getElementById('relocation-area');
    const resizersContainer = document.getElementById('column-resizers');
    const resizers = document.querySelectorAll('.column-resizer');

    let templateCols = '';
    let totalWidth = 0;

    resizers.forEach(resizer => {
        if (resizer.classList.contains('hallway-active')) {
            templateCols += '30px '; // Hallway width
            totalWidth += 30;
        } else {
            templateCols += '160px '; // Default width matches CSS --cell-width
            totalWidth += 160;
        }
    });

    gridEl.style.gridTemplateColumns = templateCols;

    // Also update the resizers container to match grid columns
    if (resizersContainer) {
        resizersContainer.style.gridTemplateColumns = templateCols;
    }

    // Adjust relocation area max-width based on grid width
    // Grid total width + gaps (6 gaps * 10px)
    const gridTotalWidth = totalWidth + (6 * 10);

    // If screen is wide enough (>= 1200px), we want the relocation area 
    // to be wider to show more columns of student names
    if (window.innerWidth >= 1200) {
        relocationEl.style.maxWidth = '800px';
    } else {
        // On narrow screens (stacked), match the grid width
        relocationEl.style.maxWidth = `${gridTotalWidth}px`;
    }
}

function addNewStudent() {
    const name = prompt('Enter student name:');
    if (name) {
        const newId = `student-${Date.now()}`;
        desks.push({
            id: newId,
            name: name.toUpperCase(),
            gender: 'boy',
            position: { type: 'relocation', index: 0 }
        });
        renderDesks();
        saveLayout();
    }
}

function deleteStudent(deskId) {
    if (confirm('Delete this student?')) {
        desks = desks.filter(d => d.id !== deskId);
        renderDesks();
        saveLayout();
        showNotification('Student deleted');
    }
}

function randomRelocation() {
    if (!confirm('Randomly relocate all students to grid positions?')) return;

    // Get all non-teacher desks
    const studentDesks = desks.filter(d => d.gender !== 'teacher');

    // Get all available grid cells (excluding teacher positions and hallway columns)
    const teacherPositions = desks
        .filter(d => d.gender === 'teacher')
        .map(d => d.position.index);

    // Get hallway columns (tight/narrow columns)
    const resizers = document.querySelectorAll('.column-resizer');
    const hallwayColumns = [];
    resizers.forEach((resizer, colIndex) => {
        if (resizer.classList.contains('hallway-active')) {
            hallwayColumns.push(colIndex);
        }
    });

    const availableCells = [];
    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
        const col = i % GRID_COLS;
        const isHallwayColumn = hallwayColumns.includes(col);
        const isTeacherPosition = teacherPositions.includes(i);

        if (!isTeacherPosition && !isHallwayColumn) {
            availableCells.push(i);
        }
    }

    // Shuffle available cells
    const shuffled = [...availableCells].sort(() => Math.random() - 0.5);

    // Assign random positions to students
    studentDesks.forEach((desk, index) => {
        if (index < shuffled.length) {
            desk.position = { type: 'grid', index: shuffled[index] };
        } else {
            // If more students than cells, put extras in relocation
            desk.position = { type: 'relocation', index: 0 };
        }
    });

    renderDesks();
    saveLayout();
    showNotification('Students randomly relocated!');
}

// --- Persistence ---

function saveLayout() {
    // Also save hallway states? Yes.
    const resizers = document.querySelectorAll('.column-resizer');
    const hallways = Array.from(resizers).map(r => r.classList.contains('hallway-active'));

    const data = {
        desks: desks,
        hallways: hallways,
        timestamp: Date.now()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showNotification('Layout saved!');
}

function loadLayout() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);
        desks = data.desks;
        // Restore hallways
        if (data.hallways) {
            const resizers = document.querySelectorAll('.column-resizer');
            data.hallways.forEach((isActive, i) => {
                if (isActive && resizers[i]) resizers[i].classList.add('hallway-active');
            });
            updateHallwayVisuals();
        }
        return true;
    } catch (e) {
        console.error('Failed to load layout', e);
        return false;
    }
}

function exportToJSON() {
    const resizers = document.querySelectorAll('.column-resizer');
    const hallways = Array.from(resizers).map(r => r.classList.contains('hallway-active'));

    const data = {
        desks: desks,
        hallways: hallways,
        version: 1.0
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom-layout-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importFromJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.desks) {
                desks = data.desks;

                // Clear hallways active classes first
                document.querySelectorAll('.column-resizer').forEach(r => r.classList.remove('hallway-active'));

                if (data.hallways) {
                    const resizers = document.querySelectorAll('.column-resizer');
                    data.hallways.forEach((isActive, i) => {
                        if (isActive && resizers[i]) resizers[i].classList.add('hallway-active');
                    });
                }
                updateHallwayVisuals();
                renderDesks();
                saveLayout();
                showNotification('Layout loaded successfully!');
            }
        } catch (err) {
            alert('Invalid JSON file');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
}

function showNotification(msg) {
    // Simple alert or custom toast?
    // Reuse specific toast logic if available, currently just alert or minimal DOM element
    // Creating a temporary toast
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = '#333';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = 9999;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
