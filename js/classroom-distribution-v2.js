const CLASSROOM_STORAGE_KEY = 'classroom_layout_data';
const CLASSROOM_SCHEMA_VERSION = 2;
const ZONE_COUNT = 30;

let desks = [];
let selectedPreset = 'banks-1-2-2';
let draggedDeskId = null;
let touchDeskElement = null;
let namesVisible = true;
let selectedDeskId = null;
let placementAnimationDeskId = null;
let touchStartPoint = null;
let touchWasDrag = false;
let ignoreDeskClickUntil = 0;

const PRESET_LAYOUTS = {
    'banks-1-2-2': {
        label: '1–2–2 Banks',
        rows: Array.from({ length: 6 }, () => [3, 27, 43, 67, 83])
    },
    'banks-2-2-1': {
        label: '2–2–1 Banks',
        rows: Array.from({ length: 6 }, () => [3, 19, 43, 59, 83])
    },
    'banks-2-1-2': {
        label: '2–1–2 Banks',
        rows: Array.from({ length: 6 }, () => [3, 19, 43, 67, 83])
    },
    'banks-1-3-1': {
        label: '1–3–1 Banks',
        rows: Array.from({ length: 6 }, () => [3, 27, 43, 59, 83])
    },
    'tapered-center': {
        label: 'Tapered Center',
        rows: [
            [3, 27, 43, 59, 83],
            [3, 27, 43, 59, 83],
            [3, 35, 51, 83],
            [3, 35, 51, 83],
            [3, 35, 51, 83],
            [3, 35, 51, 83],
            [3, 35, 51, 83]
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const loaded = loadLayout();
    if (!loaded) {
        initDesks();
    }

    document.getElementById('layout-preset').value = selectedPreset;
    initLayoutPicker();
    renderLayout();
    setupEventListeners();
});

function classroomRoster() {
    return (typeof STUDENTS_DATA !== 'undefined' ? STUDENTS_DATA : []).map((student, index) => ({
        id: `student-${index}`,
        name: student.name,
        gender: student.gender === 'girl' ? 'girl' : 'boy'
    }));
}

function initDesks() {
    desks = classroomRoster().map((student, index) => ({
        ...student,
        position: { type: 'zone', zoneId: index + 1 }
    }));
}

function presetZones() {
    const rows = PRESET_LAYOUTS[selectedPreset].rows;
    const yStart = selectedPreset === 'tapered-center' ? 17 : 18;
    const yStep = selectedPreset === 'tapered-center' ? 10.2 : 12;
    const zones = [];
    let id = 1;

    rows.forEach((xs, rowIndex) => {
        xs.forEach((x) => {
            zones.push({
                id,
                x,
                y: yStart + rowIndex * yStep,
                width: 14.3,
                height: selectedPreset === 'tapered-center' ? 9.1 : 10
            });
            id += 1;
        });
    });

    return zones;
}

function initLayoutPicker() {
    const trigger = document.getElementById('layout-preset-trigger');
    const menu = document.getElementById('layout-preset-menu');

    Object.entries(PRESET_LAYOUTS).forEach(([presetId, preset]) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'layout-picker-option';
        option.dataset.presetId = presetId;
        option.setAttribute('role', 'option');
        option.append(createLayoutThumbnail(presetId, 'layout-thumbnail'));

        const label = document.createElement('span');
        label.className = 'layout-picker-option-label';
        label.textContent = preset.label;
        option.append(label);

        option.addEventListener('click', () => {
            applyPreset(presetId);
            closeLayoutPicker();
        });
        menu.append(option);
    });

    trigger.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        trigger.setAttribute('aria-expanded', String(opening));
    });

    document.addEventListener('click', (event) => {
        if (!document.querySelector('.layout-picker').contains(event.target)) {
            closeLayoutPicker();
        }
    });
}

function createLayoutThumbnail(presetId, className) {
    const preview = document.createElement('span');
    preview.className = className;
    const thumbnailRows = {
        'banks-1-2-2': Array.from({ length: 6 }, () => [12, 32, 45, 65, 78]),
        'banks-2-2-1': Array.from({ length: 6 }, () => [12, 25, 45, 58, 78]),
        'banks-2-1-2': Array.from({ length: 6 }, () => [12, 25, 45, 65, 78]),
        'banks-1-3-1': Array.from({ length: 6 }, () => [12, 32, 45, 58, 78]),
        'tapered-center': [
            [12, 32, 45, 58, 78],
            [12, 32, 45, 58, 78],
            [12, 38.5, 51.5, 78],
            [12, 38.5, 51.5, 78],
            [12, 38.5, 51.5, 78],
            [12, 38.5, 51.5, 78],
            [12, 38.5, 51.5, 78]
        ]
    };
    const rows = thumbnailRows[presetId];
    const isTapered = presetId === 'tapered-center';
    const yStart = isTapered ? 15.5 : 17;
    const yStep = isTapered ? 10.5 : 12;
    const zoneHeight = isTapered ? 8 : 9;

    rows.forEach((xs, rowIndex) => {
        xs.forEach((x) => {
            const miniZone = document.createElement('i');
            miniZone.className = 'layout-mini-zone';
            miniZone.style.left = `${x}%`;
            miniZone.style.top = `${yStart + rowIndex * yStep}%`;
            miniZone.style.setProperty('--mini-zone-height', `${zoneHeight}%`);
            preview.append(miniZone);
        });
    });
    return preview;
}

function applyPreset(presetId) {
    if (!PRESET_LAYOUTS[presetId]) return;
    selectedPreset = presetId;
    document.getElementById('layout-preset').value = presetId;
    renderLayout();
    saveLayout(false);
}

function updateLayoutPicker() {
    const trigger = document.getElementById('layout-preset-trigger');
    const menu = document.getElementById('layout-preset-menu');
    if (!trigger || !menu) return;

    const label = trigger.querySelector('.layout-picker-label');
    const preview = trigger.querySelector('.layout-picker-preview');
    label.textContent = PRESET_LAYOUTS[selectedPreset].label;
    preview.replaceChildren(...createLayoutThumbnail(selectedPreset, 'layout-picker-preview').children);
    menu.querySelectorAll('.layout-picker-option').forEach((option) => {
        option.setAttribute('aria-selected', String(option.dataset.presetId === selectedPreset));
    });
}

function closeLayoutPicker() {
    const trigger = document.getElementById('layout-preset-trigger');
    const menu = document.getElementById('layout-preset-menu');
    if (!trigger || !menu) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
}

function renderLayout() {
    renderStage();
    renderRelocationArea();
    updateLayoutPicker();
}

function renderStage() {
    const stage = document.getElementById('classroom-grid');
    if (!stage.querySelector('.classroom-board')) {
        stage.insertAdjacentHTML('afterbegin', `
            <div class="classroom-board">Board</div>
            <div class="classroom-teacher">TEACHER</div>
        `);
    }
    const zonesById = new Map(
        [...stage.querySelectorAll('.layout-zone')].map((zone) => [Number(zone.dataset.zoneId), zone])
    );

    const deskByZone = new Map();
    desks.forEach((desk) => {
        if (desk.position.type === 'zone') {
            deskByZone.set(desk.position.zoneId, desk);
        }
    });

    presetZones().forEach((zone) => {
        let zoneEl = zonesById.get(zone.id);
        if (!zoneEl) {
            zoneEl = document.createElement('div');
            zoneEl.className = 'layout-zone';
            zoneEl.dataset.zoneId = zone.id;
            zoneEl.innerHTML = `<span class="zone-number">${zone.id}</span>`;
            zoneEl.addEventListener('click', handleZoneClick);
            stage.appendChild(zoneEl);
        }
        zoneEl.style.setProperty('--zone-x', `${zone.x}%`);
        zoneEl.style.setProperty('--zone-y', `${zone.y}%`);
        zoneEl.style.setProperty('--zone-w', `${zone.width}%`);
        zoneEl.style.setProperty('--zone-h', `${zone.height}%`);

        zoneEl.querySelector('.desk')?.remove();
        const desk = deskByZone.get(zone.id);
        if (desk) zoneEl.appendChild(createDeskElement(desk));
    });
}

function renderRelocationArea() {
    const area = document.getElementById('relocation-area');
    area.innerHTML = '<span class="relocation-title">Waiting Area</span>';

    desks
        .filter((desk) => desk.position.type === 'relocation')
        .forEach((desk) => area.appendChild(createDeskElement(desk)));
}

function createDeskElement(desk) {
    const el = document.createElement('div');
    el.className = `desk student-${desk.gender}`;
    el.id = desk.id;
    el.draggable = true;
    el.innerHTML = `<span class="desk-name">${escapeHtml(desk.name)}</span>`;
    el.classList.toggle('desk-selected', desk.id === selectedDeskId);
    el.classList.toggle('desk-placement-enter', desk.id === placementAnimationDeskId);

    if (!namesVisible) {
        el.querySelector('.desk-name').style.display = 'none';
    }

    const controls = document.createElement('div');
    controls.className = 'desk-controls';

    if (desk.position.type === 'zone') {
        const returnBtn = document.createElement('button');
        returnBtn.type = 'button';
        returnBtn.className = 'desk-btn desk-return-btn';
        returnBtn.title = 'Move to waiting area';
        returnBtn.setAttribute('aria-label', `Move ${desk.name} to waiting area`);
        returnBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        returnBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            returnDeskToWaiting(desk.id, el);
        });
        controls.appendChild(returnBtn);
    }

    if (!classroomRoster().some((student) => student.id === desk.id)) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'desk-btn';
        deleteBtn.title = 'Delete student';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteStudent(desk.id);
        });
        controls.appendChild(deleteBtn);
    }

    if (controls.childElementCount) {
        controls.addEventListener('mousedown', (event) => event.stopPropagation());
        controls.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
        el.appendChild(controls);
    }

    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', clearDragState);
    el.addEventListener('click', handleDeskClick);
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return el;
}

function setupEventListeners() {
    const stage = document.getElementById('classroom-grid');
    const waitingArea = document.getElementById('relocation-area');

    stage.addEventListener('dragover', handleStageDragOver);
    stage.addEventListener('drop', handleStageDrop);
    stage.addEventListener('dragleave', (event) => {
        if (!stage.contains(event.relatedTarget)) clearSnapTarget();
    });

    waitingArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        waitingArea.classList.add('drag-over');
    });
    waitingArea.addEventListener('dragleave', () => waitingArea.classList.remove('drag-over'));
    waitingArea.addEventListener('drop', (event) => {
        event.preventDefault();
        waitingArea.classList.remove('drag-over');
        moveDraggedToRelocation();
    });

    document.getElementById('layout-preset').addEventListener('change', (event) => {
        applyPreset(event.target.value);
    });
    document.getElementById('save-layout-btn').addEventListener('click', () => saveLayout(true));
    document.getElementById('load-layout-btn').addEventListener('click', () => {
        if (loadLayout()) {
            document.getElementById('layout-preset').value = selectedPreset;
            renderLayout();
            showNotification('Saved layout loaded');
        } else {
            showNotification('No saved layout found');
        }
    });
    document.getElementById('reset-layout-btn').addEventListener('click', resetLayout);
    document.getElementById('toggle-names-btn').addEventListener('click', toggleNames);
    document.getElementById('add-student-btn').addEventListener('click', addNewStudent);
    document.getElementById('random-relocation-btn').addEventListener('click', randomizeZones);
    document.getElementById('export-btn').addEventListener('click', exportToJSON);
    document.getElementById('import-file').addEventListener('change', importFromJSON);
}

function handleDragStart(event) {
    draggedDeskId = event.currentTarget.id;
    event.currentTarget.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedDeskId);
}

function handleDeskClick(event) {
    event.stopPropagation();
    if (Date.now() < ignoreDeskClickUntil) return;
    if (event.target.closest('.desk-controls')) return;

    const targetDesk = desks.find((desk) => desk.id === event.currentTarget.id);
    if (selectedDeskId && selectedDeskId !== targetDesk?.id && targetDesk?.position.type === 'zone') {
        moveDeskToZone(selectedDeskId, targetDesk.position.zoneId);
        return;
    }

    selectDesk(event.currentTarget.id);
}

function handleZoneClick(event) {
    if (!selectedDeskId || event.target.closest('.desk')) return;
    moveDeskToZone(selectedDeskId, Number(event.currentTarget.dataset.zoneId));
}

function selectDesk(deskId) {
    selectedDeskId = selectedDeskId === deskId ? null : deskId;
    document.querySelectorAll('.desk').forEach((deskEl) => {
        deskEl.classList.toggle('desk-selected', deskEl.id === selectedDeskId);
    });
}

function clearDragState(event) {
    if (event && event.currentTarget) event.currentTarget.classList.remove('dragging');
    draggedDeskId = null;
    clearSnapTarget();
}

function handleStageDragOver(event) {
    event.preventDefault();
    const zone = nearestZone(event.clientX, event.clientY);
    setSnapTarget(zone);
}

function handleStageDrop(event) {
    event.preventDefault();
    const zone = nearestZone(event.clientX, event.clientY);
    if (zone) {
        moveDeskToZone(draggedDeskId, Number(zone.dataset.zoneId));
    } else {
        moveDraggedToRelocation();
    }
}

function nearestZone(clientX, clientY) {
    const stage = document.getElementById('classroom-grid');
    const stageRect = stage.getBoundingClientRect();
    const maxDistance = Math.max(72, Math.min(stageRect.width, stageRect.height) * 0.14);
    let closest = null;
    let closestDistance = Infinity;

    stage.querySelectorAll('.layout-zone').forEach((zone) => {
        const rect = zone.getBoundingClientRect();
        const distance = Math.hypot(
            clientX - (rect.left + rect.width / 2),
            clientY - (rect.top + rect.height / 2)
        );
        if (distance < closestDistance) {
            closest = zone;
            closestDistance = distance;
        }
    });

    return closestDistance <= maxDistance ? closest : null;
}

function setSnapTarget(zone) {
    document.querySelectorAll('.layout-zone.snap-target').forEach((el) => el.classList.remove('snap-target'));
    if (zone) zone.classList.add('snap-target');
}

function clearSnapTarget() {
    document.querySelectorAll('.layout-zone.snap-target').forEach((el) => el.classList.remove('snap-target'));
}

function handleTouchStart(event) {
    if (event.touches.length !== 1) return;
    const deskEl = event.currentTarget;
    const rect = deskEl.getBoundingClientRect();
    const touch = event.touches[0];
    draggedDeskId = deskEl.id;
    touchDeskElement = deskEl;
    touchStartPoint = { x: touch.clientX, y: touch.clientY };
    touchWasDrag = false;
    deskEl.classList.add('dragging');
    deskEl.style.width = `${rect.width}px`;
    deskEl.style.height = `${rect.height}px`;
    deskEl.style.position = 'fixed';
    deskEl.style.inset = 'auto';
    deskEl.style.left = `${rect.left}px`;
    deskEl.style.top = `${rect.top}px`;
    deskEl.style.right = 'auto';
    deskEl.style.bottom = 'auto';
    deskEl.style.zIndex = '1000';
    deskEl.style.pointerEvents = 'none';
}

function handleTouchMove(event) {
    if (!touchDeskElement) return;
    event.preventDefault();
    const touch = event.touches[0];
    if (touchStartPoint && Math.hypot(touch.clientX - touchStartPoint.x, touch.clientY - touchStartPoint.y) > 8) {
        touchWasDrag = true;
    }
    touchDeskElement.style.left = `${touch.clientX - touchDeskElement.offsetWidth / 2}px`;
    touchDeskElement.style.top = `${touch.clientY - touchDeskElement.offsetHeight / 2}px`;
    setSnapTarget(nearestZone(touch.clientX, touch.clientY));
}

function handleTouchEnd(event) {
    if (!touchDeskElement) return;
    const deskId = draggedDeskId;
    const touch = event.changedTouches[0];

    if (!touchWasDrag) {
        resetTouchDesk();
        selectDesk(deskId);
        ignoreDeskClickUntil = Date.now() + 400;
        return;
    }

    ignoreDeskClickUntil = Date.now() + 400;
    const zone = nearestZone(touch.clientX, touch.clientY);
    const waiting = document.getElementById('relocation-area').getBoundingClientRect();
    const releasedInWaiting = touch.clientX >= waiting.left && touch.clientX <= waiting.right
        && touch.clientY >= waiting.top && touch.clientY <= waiting.bottom;

    resetTouchDesk();
    if (zone) {
        moveDeskToZone(draggedDeskId, Number(zone.dataset.zoneId));
    } else if (releasedInWaiting) {
        moveDraggedToRelocation();
    } else {
        renderLayout();
    }
}

function resetTouchDesk() {
    if (!touchDeskElement) return;
    touchDeskElement.classList.remove('dragging');
    Object.assign(touchDeskElement.style, {
        width: '',
        height: '',
        position: '',
        inset: '',
        left: '',
        top: '',
        right: '',
        bottom: '',
        zIndex: '',
        pointerEvents: ''
    });
    touchDeskElement = null;
    touchStartPoint = null;
    touchWasDrag = false;
    clearSnapTarget();
}

function moveDeskToZone(deskId, zoneId) {
    const desk = desks.find((item) => item.id === deskId);
    if (!desk || zoneId < 1 || zoneId > ZONE_COUNT) return;

    const occupier = desks.find((item) => item.position.type === 'zone' && item.position.zoneId === zoneId);
    const previousPosition = { ...desk.position };

    if (occupier && occupier.id !== desk.id) {
        occupier.position = previousPosition.type === 'zone'
            ? { type: 'zone', zoneId: previousPosition.zoneId }
            : { type: 'relocation' };
    }

    desk.position = { type: 'zone', zoneId };
    selectedDeskId = null;
    placementAnimationDeskId = deskId;
    clearDragState();
    renderLayout();
    saveLayout(false);
    window.setTimeout(() => {
        if (placementAnimationDeskId === deskId) placementAnimationDeskId = null;
    }, 320);
}

function moveDraggedToRelocation() {
    const desk = desks.find((item) => item.id === draggedDeskId);
    if (!desk) return;
    desk.position = { type: 'relocation' };
    clearDragState();
    renderLayout();
    saveLayout(false);
}

function returnDeskToWaiting(deskId, deskEl) {
    const desk = desks.find((item) => item.id === deskId);
    if (!desk || desk.position.type !== 'zone') return;

    selectedDeskId = null;
    deskEl.draggable = false;
    deskEl.classList.add('desk-returning');
    window.setTimeout(() => {
        desk.position = { type: 'relocation' };
        renderLayout();
        saveLayout(false);
    }, 180);
}

function toggleNames() {
    namesVisible = !namesVisible;
    document.getElementById('toggle-names-btn').innerHTML = namesVisible
        ? '<i class="fa-solid fa-eye-slash"></i> Hide Names'
        : '<i class="fa-solid fa-eye"></i> Show Names';
    renderLayout();
}

function addNewStudent() {
    const name = prompt('Enter student name:');
    if (!name) return;
    const gender = prompt('Choose a color category: boy or girl', 'boy');
    if (!['boy', 'girl'].includes(String(gender).toLowerCase())) {
        alert('Please choose either boy or girl.');
        return;
    }
    desks.push({
        id: `custom-${Date.now()}`,
        name: name.trim().toUpperCase(),
        gender: gender.toLowerCase(),
        position: { type: 'relocation' }
    });
    renderLayout();
    saveLayout(false);
}

function deleteStudent(deskId) {
    const desk = desks.find((item) => item.id === deskId);
    if (desk && confirm(`Delete ${desk.name}?`)) {
        desks = desks.filter((item) => item.id !== deskId);
        renderLayout();
        saveLayout(false);
    }
}

function randomizeZones() {
    if (!confirm('Randomly assign students to the 30 classroom zones?')) return;
    const zoneIds = Array.from({ length: ZONE_COUNT }, (_, index) => index + 1)
        .sort(() => Math.random() - 0.5);
    desks.forEach((desk, index) => {
        desk.position = index < zoneIds.length
            ? { type: 'zone', zoneId: zoneIds[index] }
            : { type: 'relocation' };
    });
    renderLayout();
    saveLayout(false);
    showNotification('Students randomly assigned');
}

function resetLayout() {
    if (!confirm('Reset all students to their roster-order classroom zones?')) return;
    initDesks();
    renderLayout();
    saveLayout(false);
}

function saveLayout(notify = false) {
    const data = {
        version: CLASSROOM_SCHEMA_VERSION,
        presetId: selectedPreset,
        desks,
        timestamp: Date.now()
    };
    localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(data));
    if (notify) showNotification('Layout saved');
}

function loadLayout() {
    const raw = localStorage.getItem(CLASSROOM_STORAGE_KEY);
    if (!raw) return false;
    try {
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.desks)) return false;
        selectedPreset = PRESET_LAYOUTS[data.presetId] ? data.presetId : 'banks-1-2-2';
        desks = reconcileDesks(data.desks);
        return true;
    } catch {
        return false;
    }
}

function reconcileDesks(savedDesks) {
    const roster = classroomRoster();
    const rosterByName = new Map(roster.map((student) => [student.name, student]));
    const occupiedZones = new Set();
    const reconciled = [];

    savedDesks
        .filter((desk) => desk && desk.gender !== 'teacher')
        .forEach((savedDesk) => {
            const rosterStudent = rosterByName.get(savedDesk.name);
            const id = rosterStudent ? rosterStudent.id : savedDesk.id;
            if (!id || reconciled.some((desk) => desk.id === id)) return;

            let position = normalizePosition(savedDesk.position);
            if (position.type === 'zone' && occupiedZones.has(position.zoneId)) {
                position = { type: 'relocation' };
            }
            if (position.type === 'zone') occupiedZones.add(position.zoneId);

            reconciled.push({
                id,
                name: rosterStudent ? rosterStudent.name : String(savedDesk.name || 'CUSTOM STUDENT'),
                gender: rosterStudent ? rosterStudent.gender : (savedDesk.gender === 'girl' ? 'girl' : 'boy'),
                position
            });
        });

    roster.forEach((student) => {
        if (!reconciled.some((desk) => desk.id === student.id)) {
            const zoneId = firstAvailableZone(occupiedZones);
            if (zoneId) occupiedZones.add(zoneId);
            reconciled.push({
                ...student,
                position: zoneId ? { type: 'zone', zoneId } : { type: 'relocation' }
            });
        }
    });

    return reconciled;
}

function normalizePosition(position) {
    if (position && position.type === 'zone' && Number.isInteger(Number(position.zoneId))
        && Number(position.zoneId) >= 1 && Number(position.zoneId) <= ZONE_COUNT) {
        return { type: 'zone', zoneId: Number(position.zoneId) };
    }
    if (position && position.type === 'grid' && Number.isInteger(Number(position.index))) {
        const zoneId = Number(position.index) + 1;
        return zoneId <= ZONE_COUNT ? { type: 'zone', zoneId } : { type: 'relocation' };
    }
    return { type: 'relocation' };
}

function firstAvailableZone(occupiedZones) {
    return Array.from({ length: ZONE_COUNT }, (_, index) => index + 1)
        .find((zoneId) => !occupiedZones.has(zoneId));
}

function exportToJSON() {
    const data = {
        version: CLASSROOM_SCHEMA_VERSION,
        presetId: selectedPreset,
        desks
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `classroom-layout-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || !Array.isArray(data.desks)) throw new Error('Invalid data');
            selectedPreset = PRESET_LAYOUTS[data.presetId] ? data.presetId : selectedPreset;
            desks = reconcileDesks(data.desks);
            document.getElementById('layout-preset').value = selectedPreset;
            renderLayout();
            saveLayout(false);
            showNotification('Layout imported');
        } catch {
            alert('Invalid classroom layout file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showNotification(message) {
    document.querySelectorAll('.classroom-toast').forEach((toast) => toast.remove());
    const toast = document.createElement('div');
    toast.className = 'classroom-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
}
