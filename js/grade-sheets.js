/**
 * Grade Sheets Tool – Phase 1 + 2 + 3
 * Phase 1: Dashboard, LocalStorage CRUD, New Sheet modal, Delete confirm
 * Phase 2: Grid Editor, Add/Remove activities, Inline grade input, Color-coded cells,
 *          Row highlight, Drag-to-reorder, Hide/Show columns, Descriptions panel
 * Phase 3: Weighted averages, Fail-risk badges, Scale config, Missing grades report, Completion badge
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'gradeSheets';
    const CATEGORIES = ['cognitiva', 'laboral', 'ciudadana'];
    const CAT_LABELS = { cognitiva: 'Cognitiva', laboral: 'Laboral', ciudadana: 'Ciudadana' };
    const CAT_WEIGHTS = { cognitiva: 0.35, laboral: 0.35, ciudadana: 0.30 };

    let sheets = [];
    let selectedIds = new Set();
    let pendingDeleteId = null;
    let currentSheetId = null;
    let highlightedRow = null;
    let dragSrcColId = null;

    // ── DOM refs – Dashboard ─────────────────────────────
    const $ = id => document.getElementById(id);
    const $dashboardView = $('gs-dashboard-view');
    const $editorView = $('gs-editor-view');
    const $dashboardGrid = $('gs-dashboard-grid');
    const $emptyState = $('gs-empty-state');
    const $newSheetBtn = $('gs-new-sheet-btn');
    const $exportSelectedBtn = $('gs-export-selected-btn');
    const $driveBtn = $('gs-btn-drive');
    const $backToDashboard = $('gs-back-to-dashboard');
    const $editorTitle = $('gs-editor-title');
    const $modalOverlay = $('gs-modal-overlay');
    const $modalClose = $('gs-modal-close');
    const $modalCancel = $('gs-modal-cancel');
    const $modalCreate = $('gs-modal-create');
    const $fieldTeacher = $('gs-field-teacher');
    const $fieldSubject = $('gs-field-subject');
    const $fieldGroup = $('gs-field-group');
    const $fieldTerm = $('gs-field-term');
    const $fieldPmax = $('gs-field-pmax');
    const $fieldExig = $('gs-field-exig');
    const $fieldNmin = $('gs-field-nmin');
    const $fieldNmax = $('gs-field-nmax');
    const $fieldNapr = $('gs-field-napr');
    const $fieldImportScale = $('gs-field-import-scale');
    const $deleteOverlay = $('gs-delete-overlay');
    const $deleteName = $('gs-delete-name');
    const $deleteConfirm = $('gs-delete-confirm');

    // ── DOM refs – Editor ─────────────────────────────────
    const $infoTeacher = $('gs-info-teacher');
    const $infoSubject = $('gs-info-subject');
    const $infoGroup = $('gs-info-group');
    const $infoTerm = $('gs-info-term');
    const $thead = $('gs-grade-thead');
    const $tbody = $('gs-grade-tbody');
    const $gridEmpty = $('gs-grid-empty');
    const $descriptionsPanel = $('gs-descriptions-panel');
    const $descriptionsList = $('gs-descriptions-list');
    const $toggleDescriptions = $('gs-toggle-descriptions');

    // ── DOM refs – Phase 3 ─────────────────────────────────
    const $exportCsvBtn = $('gs-export-csv-btn');
    const $missingBtn = $('gs-missing-report-btn');
    const $missingOverlay = $('gs-missing-overlay');
    const $missingContent = $('gs-missing-content');
    const $scaleConfigBtn = $('gs-scale-config-btn');
    const $scaleOverlay = $('gs-scale-overlay');
    const $editPmax = $('gs-edit-pmax');
    const $editExig = $('gs-edit-exig');
    const $editNmin = $('gs-edit-nmin');
    const $editNmax = $('gs-edit-nmax');
    const $editNapr = $('gs-edit-napr');
    const $editImportScale = $('gs-edit-import-scale');
    const $scaleSave = $('gs-scale-save');

    // ── DOM refs – Phase 6 ─────────────────────────────────
    const $toggleViewBtn = $('gs-toggle-view');
    const $actSettingsOverlay = $('gs-activity-settings-overlay');
    const $actSettingsClose = document.querySelectorAll('.gs-act-settings-close');
    const $actSettingsSave = $('gs-act-settings-save');
    const $actScaleSelect = $('gs-act-scale-select');
    const $actScalePreview = $('gs-act-scale-preview');
    const $actSettingsLabel = $('gs-act-settings-label');

    let editingActId = null;
    let isGradesView = false;

    // ══════════════════════════════════════════════════════
    //                    STORAGE
    // ══════════════════════════════════════════════════════
    function saveToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets)); }
    function loadFromStorage() { try { sheets = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { sheets = []; } }
    function generateId() { return 'gs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
    function getSheet() { return sheets.find(s => s.id === currentSheetId) || null; }

    // ══════════════════════════════════════════════════════
    //                    HELPERS
    // ══════════════════════════════════════════════════════
    function getStudentCount(g) { return (typeof STUDENT_GROUPS !== 'undefined' && STUDENT_GROUPS[g]) ? STUDENT_GROUPS[g].length : 0; }
    function getStudentNames(g) { return (typeof STUDENT_GROUPS !== 'undefined' && STUDENT_GROUPS[g]) ? STUDENT_GROUPS[g] : []; }

    function getAllActivities(sheet) {
        const c = sheet.categories || {};
        const all = [];
        CATEGORIES.forEach(cat => (c[cat] || []).forEach(a => all.push({ ...a, category: cat })));
        return all;
    }
    function getAllActivityIds(sheet) { return getAllActivities(sheet).map(a => a.id); }

    function getCompletionPercent(sheet) {
        const students = getStudentNames(sheet.group);
        const aids = getAllActivityIds(sheet);
        if (!students.length || !aids.length) return 0;
        const total = students.length * aids.length;
        let filled = 0;
        const grades = sheet.grades || {};
        students.forEach(name => {
            const row = grades[name] || {};
            aids.forEach(aid => { if (row[aid] != null && row[aid] !== '') filled++; });
        });
        return Math.round((filled / total) * 100);
    }

    // ══════════════════════════════════════════════════════
    //              GOOGLE DRIVE INTEGRATION
    // ══════════════════════════════════════════════════════
    const driveService = window.GoogleDriveService ? new window.GoogleDriveService({
        folderName: 'ESL Platform Grade Sheets',
        fileExtension: '.json',
        onSave: () => sheets,
        onLoad: (data) => {
            if (Array.isArray(data)) {
                sheets = data;
                saveToStorage();
                renderDashboard();
                if (currentSheetId) renderGrid();
            } else {
                showToast('Invalid data format received from Drive.', 'error');
            }
        },
        onNotify: (msg, type) => showToast(msg, type)
    }) : null;

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    function calculateGrade(score, pmax, exig, nmin, nmax, napr) {
        if (score < 0) return nmin;
        if (score > pmax) return nmax;
        const eScore = pmax * (exig / 100);

        let grade = 0;
        if (score < eScore) {
            grade = ((napr - nmin) / eScore) * score + nmin;
        } else {
            grade = ((nmax - napr) / (pmax - eScore)) * (score - eScore) + napr;
        }
        return grade;
    }

    function gradeColorFromGrade(grade, sheet) {
        if (grade == null || grade === '') return '';
        const g = parseFloat(grade);
        if (isNaN(g)) return '';
        const pass = sheet.napr;
        const margin = (sheet.nmax - sheet.nmin) * 0.05;
        if (g < pass) return 'gs-fail';
        if (g < pass + margin) return 'gs-border';
        return 'gs-pass';
    }

    function getSavedScales() {
        try {
            const data = JSON.parse(localStorage.getItem('esl_grading_scale_data'));
            if (data && Array.isArray(data.savedScales)) return data.savedScales;
        } catch (e) { }
        return [];
    }

    function getScaleForActivity(act, sheet) {
        if (act && act.scaleId && act.scaleId !== 'global') {
            const scales = getSavedScales();
            const saved = scales.find(s => s.id === act.scaleId);
            if (saved) return saved;
        }
        return {
            name: 'Default Sheet Scale',
            pmax: act && act.maxScore ? act.maxScore : (sheet.pmax || 50),
            exig: sheet.exig,
            nmin: sheet.nmin,
            nmax: sheet.nmax,
            napr: sheet.napr
        };
    }

    function gradeColor(value, sheet, act) {
        if (value == null || value === '') return '';
        const v = parseFloat(value);
        if (isNaN(v)) return '';

        const sc = getScaleForActivity(act, sheet);
        const grade = calculateGrade(v, sc.pmax, sc.exig, sc.nmin, sc.nmax, sc.napr);
        // Margin based on activity's scale
        const margin = (sc.nmax - sc.nmin) * 0.05;
        if (grade < sc.napr) return 'gs-fail';
        if (grade < sc.napr + margin) return 'gs-border';
        return 'gs-pass';
    }

    // ── Phase 6: Weighted Average Calculation (From Grades) ────────────
    function calcWeightedAvg(studentName, sheet) {
        const grades = sheet.grades[studentName] || {};
        const cats = sheet.categories || {};
        let weightedSum = 0;
        let totalWeight = 0;
        let filledCats = 0;

        CATEGORIES.forEach(cat => {
            const acts = (cats[cat] || []);
            if (acts.length === 0) return;
            let sumGrades = 0, count = 0;
            acts.forEach(a => {
                const v = parseFloat(grades[a.id]);
                if (!isNaN(v)) {
                    const sc = getScaleForActivity(a, sheet);
                    const grade = calculateGrade(v, sc.pmax, sc.exig, sc.nmin, sc.nmax, sc.napr);
                    sumGrades += grade;
                    count++;
                }
            });
            if (count > 0) {
                const avgGrade = sumGrades / count;
                weightedSum += avgGrade * CAT_WEIGHTS[cat];
                totalWeight += CAT_WEIGHTS[cat];
                filledCats++;
            }
        });

        if (totalWeight === 0) return { avg: null, filledCats };
        return { avg: weightedSum / totalWeight, filledCats };
    }

    function isFailRisk(studentName, sheet) {
        const { avg, filledCats } = calcWeightedAvg(studentName, sheet);
        // Show fail-risk only when student has grades in at least 2 categories
        if (avg === null || filledCats < 2) return false;
        return avg < sheet.napr;
    }

    // ── Phase 3: Missing Grades ──────────────────────────
    function getMissingGrades(sheet) {
        const students = getStudentNames(sheet.group);
        const allActs = getAllActivities(sheet);
        if (!students.length || !allActs.length) return { missing: [], studentsWithGrades: 0, totalCells: 0, filledCells: 0 };

        const grades = sheet.grades || {};
        let studentsWithGrades = 0;
        const missing = [];
        let filledCells = 0;

        students.forEach(name => {
            const row = grades[name] || {};
            const filled = allActs.filter(a => row[a.id] != null && row[a.id] !== '');
            filledCells += filled.length;
            if (filled.length > 0) studentsWithGrades++;

            const missingActs = allActs.filter(a => row[a.id] == null || row[a.id] === '');
            if (missingActs.length > 0 && filled.length > 0) {
                // Only report missing for students who have at least 1 grade
                missing.push({ name, acts: missingActs });
            }
        });

        return { missing, studentsWithGrades, totalCells: students.length * allActs.length, filledCells };
    }

    // ══════════════════════════════════════════════════════
    //              POPULATE GROUP DROPDOWN
    // ══════════════════════════════════════════════════════
    function populateGroupDropdown() {
        $fieldGroup.innerHTML = '';
        if (typeof STUDENT_GROUPS === 'undefined') return;
        Object.keys(STUDENT_GROUPS).sort().forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g + ' (' + STUDENT_GROUPS[g].length + ' students)';
            $fieldGroup.appendChild(opt);
        });
    }

    // ══════════════════════════════════════════════════════
    //                DASHBOARD RENDERING
    // ══════════════════════════════════════════════════════
    function renderDashboard() {
        $dashboardGrid.innerHTML = '';
        if (!sheets.length) {
            $emptyState.style.display = '';
            $dashboardGrid.style.display = 'none';
            $exportSelectedBtn.disabled = true;
            return;
        }
        $emptyState.style.display = 'none';
        $dashboardGrid.style.display = '';

        sheets.forEach((sheet, idx) => {
            const pct = getCompletionPercent(sheet);
            const sc = getStudentCount(sheet.group);
            const ac = getAllActivityIds(sheet).length;
            const sel = selectedIds.has(sheet.id);

            const card = document.createElement('div');
            card.className = 'gs-card' + (sel ? ' selected' : '');
            card.style.animationDelay = (idx * 0.06) + 's';

            // Completion badge
            const badgeHtml = pct === 100 && ac > 0
                ? '<span class="gs-card-badge complete"><i class="fa-solid fa-check"></i> Complete</span>'
                : '';

            card.innerHTML = `
                <input type="checkbox" class="gs-card-checkbox" data-id="${sheet.id}" ${sel ? 'checked' : ''} title="Select for export">
                ${badgeHtml}
                <div class="gs-card-actions">
                    <button class="gs-card-action-btn delete" data-id="${sheet.id}" title="Delete sheet"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="gs-card-top">
                    <h3>${escHtml(sheet.subject)} — ${escHtml(sheet.group)}</h3>
                    <div class="gs-card-meta">
                        <span><i class="fa-solid fa-calendar-alt"></i> ${escHtml(sheet.term)} Term</span>
                        <span><i class="fa-solid fa-users"></i> ${sc} students</span>
                    </div>
                </div>
                <div class="gs-card-body">
                    <div class="gs-card-detail"><i class="fa-solid fa-chalkboard-user"></i> ${escHtml(sheet.teacherName)}</div>
                    <div class="gs-card-detail"><i class="fa-solid fa-list-check"></i> ${ac} ${ac === 1 ? 'activity' : 'activities'}</div>
                    <div class="gs-completion-label">${pct}% complete</div>
                    <div class="gs-completion-bar-wrap"><div class="gs-completion-bar" style="width:${pct}%"></div></div>
                </div>`;
            card.addEventListener('click', e => {
                if (e.target.closest('.gs-card-checkbox') || e.target.closest('.gs-card-action-btn')) return;
                openEditor(sheet.id);
            });
            $dashboardGrid.appendChild(card);
        });

        $dashboardGrid.querySelectorAll('.gs-card-checkbox').forEach(cb => {
            cb.addEventListener('change', e => {
                e.stopPropagation();
                cb.checked ? selectedIds.add(cb.dataset.id) : selectedIds.delete(cb.dataset.id);
                cb.closest('.gs-card').classList.toggle('selected', cb.checked);
                updateExportBtn();
            });
        });
        $dashboardGrid.querySelectorAll('.gs-card-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); showDeleteConfirm(btn.dataset.id); });
        });
        updateExportBtn();
    }

    function updateExportBtn() { $exportSelectedBtn.disabled = selectedIds.size === 0; }

    // ══════════════════════════════════════════════════════
    //                NEW SHEET MODAL
    // ══════════════════════════════════════════════════════
    function openNewSheetModal() {
        $fieldTeacher.value = sheets.length ? (sheets[sheets.length - 1].teacherName || '') : '';
        $fieldSubject.value = '';
        $fieldPmax.value = 50; $fieldExig.value = 60; $fieldNmin.value = 1.0; $fieldNmax.value = 5.0; $fieldNapr.value = 3.0;
        loadSavedScales($fieldImportScale);
        $modalOverlay.style.display = '';
        setTimeout(() => $fieldSubject.focus(), 200);
    }
    function closeNewSheetModal() { $modalOverlay.style.display = 'none'; }

    function createSheet() {
        const subject = $fieldSubject.value.trim();
        if (!subject) { $fieldSubject.focus(); $fieldSubject.style.borderColor = '#ff7675'; setTimeout(() => $fieldSubject.style.borderColor = '', 1500); return; }
        sheets.push({
            id: generateId(),
            teacherName: $fieldTeacher.value.trim() || 'Teacher',
            subject, group: $fieldGroup.value, term: $fieldTerm.value,
            pmax: parseFloat($fieldPmax.value) || 50,
            exig: parseFloat($fieldExig.value) || 60,
            nmin: parseFloat($fieldNmin.value) || 1.0,
            nmax: parseFloat($fieldNmax.value) || 5.0,
            napr: parseFloat($fieldNapr.value) || 3.0,
            categories: { cognitiva: [], laboral: [], ciudadana: [] },
            grades: {}, createdAt: Date.now(), updatedAt: Date.now()
        });
        saveToStorage(); closeNewSheetModal(); renderDashboard();
    }

    // ══════════════════════════════════════════════════════
    //                DELETE CONFIRM
    // ══════════════════════════════════════════════════════
    function showDeleteConfirm(id) {
        const s = sheets.find(x => x.id === id);
        if (!s) return;
        pendingDeleteId = id;
        $deleteName.textContent = s.subject + ' — ' + s.group + ' (' + s.term + ')';
        $deleteOverlay.style.display = '';
    }
    function closeDeleteConfirm() { $deleteOverlay.style.display = 'none'; pendingDeleteId = null; }
    function confirmDelete() {
        if (!pendingDeleteId) return;
        sheets = sheets.filter(s => s.id !== pendingDeleteId);
        selectedIds.delete(pendingDeleteId);
        saveToStorage(); closeDeleteConfirm(); renderDashboard();
    }

    // ══════════════════════════════════════════════════════
    //              EDITOR – OPEN / CLOSE
    // ══════════════════════════════════════════════════════
    function openEditor(id) {
        const sheet = sheets.find(s => s.id === id);
        if (!sheet) return;
        currentSheetId = id;
        highlightedRow = null;
        $dashboardView.style.display = 'none';
        $editorView.style.display = '';
        $editorTitle.textContent = sheet.subject + ' — ' + sheet.group + ' (' + sheet.term + ' Term)';
        $infoTeacher.textContent = sheet.teacherName;
        $infoSubject.textContent = sheet.subject;
        $infoGroup.textContent = 'Course ' + sheet.group;
        $infoTerm.textContent = sheet.term + ' Term';
        renderGrid();
        renderDescriptions();
    }

    function backToDashboard() {
        currentSheetId = null;
        $editorView.style.display = 'none';
        $dashboardView.style.display = '';
        renderDashboard();
    }

    // ══════════════════════════════════════════════════════
    //              GRID RENDERING (Phase 2 + 3)
    // ══════════════════════════════════════════════════════
    function renderGrid() {
        const sheet = getSheet();
        if (!sheet) return;
        const students = getStudentNames(sheet.group);
        const allActs = getAllActivities(sheet);
        const visibleActs = allActs.filter(a => !a.hidden);
        const hasActivities = allActs.length > 0;

        if (!hasActivities) {
            $gridEmpty.style.display = '';
            $('gs-grade-table').style.display = 'none';
            renderHiddenColsBar([]);
            return;
        }
        $gridEmpty.style.display = 'none';
        $('gs-grade-table').style.display = '';
        renderHiddenColsBar(allActs.filter(a => a.hidden));

        // ── THEAD ──
        $thead.innerHTML = '';
        const catRow = document.createElement('tr');

        // Sticky # + Name (rowSpan 2)
        const th1 = document.createElement('th');
        th1.className = 'gs-col-num-header'; th1.rowSpan = 2; th1.textContent = '#';
        catRow.appendChild(th1);
        const th2 = document.createElement('th');
        th2.className = 'gs-col-name-header'; th2.rowSpan = 2; th2.textContent = 'STUDENT';
        catRow.appendChild(th2);

        // Category group headers
        CATEGORIES.forEach(cat => {
            const acts = visibleActs.filter(a => a.category === cat);
            if (!acts.length) return;
            const th = document.createElement('th');
            th.className = 'gs-cat-group-th ' + cat;
            th.colSpan = acts.length;
            th.textContent = CAT_LABELS[cat];
            catRow.appendChild(th);
        });

        // Weighted Average header (rowSpan 2)
        const avgTh = document.createElement('th');
        avgTh.className = 'gs-avg-header';
        avgTh.rowSpan = 2;
        avgTh.innerHTML = 'WEIGHTED<br>AVG';
        catRow.appendChild(avgTh);

        $thead.appendChild(catRow);

        // Activity column headers row
        const actRow = document.createElement('tr');
        let colNum = 1;
        CATEGORIES.forEach(cat => {
            visibleActs.filter(a => a.category === cat).forEach(act => {
                const th = document.createElement('th');
                th.className = 'gs-act-th'; th.dataset.id = act.id; th.dataset.cat = cat; th.draggable = true;
                const sc = getScaleForActivity(act, sheet);
                const scaleLabel = (act.scaleId && act.scaleId !== 'global') ? escHtml(sc.name) : `/${sc.pmax}`;
                th.innerHTML = `
                    <i class="fa-solid fa-grip-vertical gs-drag-handle"></i>
                    <span class="gs-col-num">${colNum}</span>
                    <div class="gs-col-max gs-act-settings-trigger" data-id="${act.id}" title="Activity Settings">${scaleLabel}</div>
                    <button class="gs-col-delete" data-id="${act.id}" title="Remove column"><i class="fa-solid fa-xmark"></i></button>
                    <button class="gs-col-hide" data-id="${act.id}" title="Hide column"><i class="fa-solid fa-eye-slash"></i></button>`;
                th.querySelector('.gs-act-settings-trigger').addEventListener('click', (e) => openActivitySettings(e, act.id));
                th.addEventListener('dragstart', onDragStart);
                th.addEventListener('dragover', onDragOver);
                th.addEventListener('dragleave', onDragLeave);
                th.addEventListener('drop', onDrop);
                th.addEventListener('dragend', onDragEnd);
                actRow.appendChild(th);
                colNum++;
            });
        });
        $thead.appendChild(actRow);

        // ── TBODY ──
        $tbody.innerHTML = '';
        students.forEach((name, idx) => {
            const tr = document.createElement('tr');
            if (highlightedRow === name) tr.classList.add('gs-row-highlight');

            const numTd = document.createElement('td');
            numTd.className = 'gs-col-num-cell'; numTd.textContent = idx + 1;
            tr.appendChild(numTd);

            const nameTd = document.createElement('td');
            nameTd.className = 'gs-col-name-cell'; nameTd.textContent = name;
            nameTd.addEventListener('click', () => { highlightedRow = (highlightedRow === name) ? null : name; renderGrid(); });
            tr.appendChild(nameTd);

            // Grade cells
            visibleActs.forEach(act => {
                const td = document.createElement('td');
                td.className = 'gs-grade-cell';
                const val = (sheet.grades[name] || {})[act.id];
                const cc = gradeColor(val, sheet, act);
                if (cc) td.classList.add(cc);
                const input = document.createElement('input');
                input.type = 'text'; input.inputMode = 'numeric'; input.className = 'gs-grade-input';
                input.value = (val != null && val !== '') ? val : '';
                input.dataset.student = name; input.dataset.actId = act.id;
                input.addEventListener('change', onGradeChange);
                input.addEventListener('keydown', onGradeKeydown);

                const display = document.createElement('span');
                display.className = 'gs-grade-display';
                if (val != null && val !== '') {
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) {
                        const sc = getScaleForActivity(act, sheet);
                        const g = calculateGrade(parsed, sc.pmax, sc.exig, sc.nmin, sc.nmax, sc.napr);
                        display.innerText = (Math.round(g * 10) / 10).toFixed(1);
                    } else { display.innerText = '-'; }
                } else { display.innerText = '-'; }

                td.appendChild(input);
                td.appendChild(display);
                tr.appendChild(td);
            });

            // ── Phase 3: Weighted Average cell ──
            const avgTd = document.createElement('td');
            avgTd.className = 'gs-avg-cell';
            const { avg, filledCats } = calcWeightedAvg(name, sheet);

            if (avg !== null) {
                const rounded = Math.round(avg * 10) / 10;
                const cc = gradeColorFromGrade(rounded, sheet);
                if (cc) avgTd.classList.add(cc);
                avgTd.innerHTML = `<strong>${rounded}</strong>`;

                // Fail-risk badge
                if (isFailRisk(name, sheet)) {
                    avgTd.innerHTML += ' <span class="gs-fail-risk"><i class="fa-solid fa-triangle-exclamation"></i></span>';
                }
            } else {
                avgTd.innerHTML = '<span style="color:#ccc;">—</span>';
            }
            tr.appendChild(avgTd);

            $tbody.appendChild(tr);
        });

        // Bind delete/hide
        $thead.querySelectorAll('.gs-col-delete').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); removeActivity(btn.dataset.id); }));
        $thead.querySelectorAll('.gs-col-hide').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); toggleHideActivity(btn.dataset.id, true); }));
    }

    function renderHiddenColsBar(hiddenActs) {
        const existing = document.querySelector('.gs-hidden-cols-bar');
        if (existing) existing.remove();
        if (!hiddenActs.length) return;
        const bar = document.createElement('div');
        bar.className = 'gs-hidden-cols-bar';
        bar.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hidden columns: ';
        hiddenActs.forEach(act => {
            const btn = document.createElement('button');
            btn.className = 'gs-show-col-btn'; btn.textContent = act.label || act.id; btn.title = 'Show column';
            btn.addEventListener('click', () => toggleHideActivity(act.id, false));
            bar.appendChild(btn);
        });
        document.querySelector('.gs-table-wrap').insertBefore(bar, document.querySelector('.gs-table-wrap').firstChild);
    }

    // ══════════════════════════════════════════════════════
    //           GRADE INPUT HANDLERS
    // ══════════════════════════════════════════════════════
    function onGradeChange(e) {
        const input = e.target;
        const sheet = getSheet();
        if (!sheet) return;
        const name = input.dataset.student, actId = input.dataset.actId;
        let val = input.value.trim();
        if (val === '') {
            if (!sheet.grades[name]) sheet.grades[name] = {};
            delete sheet.grades[name][actId];
        } else {
            let num = parseFloat(val);
            let actObj = null;
            CATEGORIES.forEach(cat => {
                const f = (sheet.categories[cat] || []).find(a => a.id === actId);
                if (f) actObj = f;
            });
            if (!isNaN(num)) {
                const max = actObj && actObj.maxScore ? actObj.maxScore : (sheet.pmax || 50);
                if (num < 0) num = 0;
                if (num > max) num = max;
                val = num;
                input.value = num; // update DOM as well
            }
            if (!sheet.grades[name]) sheet.grades[name] = {};
            sheet.grades[name][actId] = val;
        }
        sheet.updatedAt = Date.now();
        saveToStorage();

        // Update cell color + pulse
        const td = input.closest('.gs-grade-cell');
        td.classList.remove('gs-pass', 'gs-fail', 'gs-border', 'gs-pulse');

        let actObjColors = null;
        CATEGORIES.forEach(cat => {
            const f = (sheet.categories[cat] || []).find(a => a.id === actId);
            if (f) actObjColors = f;
        });

        const cc = gradeColor(val, sheet, actObjColors);
        if (cc) td.classList.add(cc);
        void td.offsetWidth;
        td.classList.add('gs-pulse');

        // Re-render the avg cell for this row
        renderGrid();
    }

    function onGradeKeydown(e) {
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            const allInputs = Array.from($tbody.querySelectorAll('.gs-grade-input'));
            const idx = allInputs.indexOf(e.target);
            if (e.shiftKey) { if (idx > 0) allInputs[idx - 1].focus(); }
            else { if (idx < allInputs.length - 1) allInputs[idx + 1].focus(); }
        }
    }

    // ══════════════════════════════════════════════════════
    //         ADD / REMOVE / HIDE ACTIVITIES
    // ══════════════════════════════════════════════════════
    function addActivity(cat) {
        const sheet = getSheet();
        if (!sheet) return;
        const inp = $('gs-add-' + cat + '-input');
        const label = inp.value.trim() || (CAT_LABELS[cat] + ' Activity ' + ((sheet.categories[cat] || []).length + 1));
        if (!sheet.categories[cat]) sheet.categories[cat] = [];
        sheet.categories[cat].push({ id: generateId(), label, hidden: false, maxScore: sheet.pmax || 50 });
        sheet.updatedAt = Date.now();
        saveToStorage(); inp.value = '';
        renderGrid(); renderDescriptions();
    }

    function removeActivity(actId) {
        const sheet = getSheet();
        if (!sheet) return;
        CATEGORIES.forEach(cat => { sheet.categories[cat] = (sheet.categories[cat] || []).filter(a => a.id !== actId); });
        Object.keys(sheet.grades).forEach(name => delete sheet.grades[name][actId]);
        sheet.updatedAt = Date.now();
        saveToStorage(); renderGrid(); renderDescriptions();
    }

    function toggleHideActivity(actId, hide) {
        const sheet = getSheet();
        if (!sheet) return;
        CATEGORIES.forEach(cat => (sheet.categories[cat] || []).forEach(a => { if (a.id === actId) a.hidden = hide; }));
        sheet.updatedAt = Date.now();
        saveToStorage(); renderGrid();
    }

    function toggleViewMode() {
        isGradesView = !isGradesView;
        const table = $('gs-grade-table');
        if (isGradesView) {
            table.classList.add('show-grades');
            if ($toggleViewBtn) $toggleViewBtn.innerHTML = '<i class="fa-solid fa-exchange-alt"></i> Show Scores';
        } else {
            table.classList.remove('show-grades');
            if ($toggleViewBtn) $toggleViewBtn.innerHTML = '<i class="fa-solid fa-exchange-alt"></i> Show Grades';
        }
    }

    function openActivitySettings(e, actId) {
        e.stopPropagation();
        editingActId = actId;
        const sheet = getSheet();
        if (!sheet) return;
        let act = null;
        CATEGORIES.forEach(cat => {
            const found = (sheet.categories[cat] || []).find(a => a.id === actId);
            if (found) act = found;
        });
        if (!act) return;

        if ($actSettingsLabel) $actSettingsLabel.textContent = act.label;
        if ($actScaleSelect) {
            $actScaleSelect.innerHTML = '<option value="global">Default Sheet Scale</option>';
            const scales = getSavedScales();
            scales.forEach(sc => {
                const opt = document.createElement('option');
                opt.value = sc.id;
                opt.textContent = sc.name || 'Unnamed Scale';
                $actScaleSelect.appendChild(opt);
            });
            $actScaleSelect.value = act.scaleId || 'global';
        }
        updateActScalePreview();
        if ($actSettingsOverlay) $actSettingsOverlay.style.display = '';
    }

    function closeActivitySettings() {
        if ($actSettingsOverlay) $actSettingsOverlay.style.display = 'none';
        editingActId = null;
    }

    function updateActScalePreview() {
        if (!$actScaleSelect || !$actScalePreview) return;
        const sheet = getSheet();
        const val = $actScaleSelect.value;
        let sc;
        if (val === 'global' && sheet) {
            sc = { pmax: sheet.pmax, exig: sheet.exig, nmin: sheet.nmin, nmax: sheet.nmax, napr: sheet.napr };
        } else {
            const scales = getSavedScales();
            sc = scales.find(s => s.id === val);
        }
        if (!sc) {
            $actScalePreview.style.display = 'none';
            return;
        }
        $actScalePreview.style.display = '';
        $actScalePreview.innerHTML = `
            <strong>Max:</strong> ${sc.pmax} &nbsp;|&nbsp; <strong>Exigency:</strong> ${sc.exig}%<br>
            <strong>Grades:</strong> ${Number(sc.nmin).toFixed(1)} to ${Number(sc.nmax).toFixed(1)} &nbsp;|&nbsp; <strong>Pass:</strong> ${Number(sc.napr).toFixed(1)}
        `;
    }

    function saveActivitySettings() {
        const sheet = getSheet();
        if (!sheet || !editingActId || !$actScaleSelect) return;
        CATEGORIES.forEach(cat => {
            const found = (sheet.categories[cat] || []).find(a => a.id === editingActId);
            if (found) {
                found.scaleId = $actScaleSelect.value;
            }
        });
        sheet.updatedAt = Date.now();
        saveToStorage();
        closeActivitySettings();
        renderGrid();
    }

    // ══════════════════════════════════════════════════════
    //              DRAG-TO-REORDER COLUMNS
    // ══════════════════════════════════════════════════════
    function onDragStart(e) { dragSrcColId = e.currentTarget.dataset.id; e.currentTarget.style.opacity = '0.5'; e.dataTransfer.effectAllowed = 'move'; }
    function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (e.currentTarget.dataset.id !== dragSrcColId) e.currentTarget.classList.add('drag-over'); }
    function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
    function onDrop(e) {
        e.preventDefault();
        const targetId = e.currentTarget.dataset.id, targetCat = e.currentTarget.dataset.cat;
        e.currentTarget.classList.remove('drag-over');
        if (!dragSrcColId || dragSrcColId === targetId) return;
        const sheet = getSheet(); if (!sheet) return;
        let srcCat = null;
        CATEGORIES.forEach(cat => { if ((sheet.categories[cat] || []).find(a => a.id === dragSrcColId)) srcCat = cat; });
        if (!srcCat || srcCat !== targetCat) return;
        const acts = sheet.categories[srcCat];
        const si = acts.findIndex(a => a.id === dragSrcColId), ti = acts.findIndex(a => a.id === targetId);
        if (si === -1 || ti === -1) return;
        const [moved] = acts.splice(si, 1); acts.splice(ti, 0, moved);
        sheet.updatedAt = Date.now(); saveToStorage(); renderGrid(); renderDescriptions();
    }
    function onDragEnd(e) { e.currentTarget.style.opacity = ''; dragSrcColId = null; $thead.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); }

    // ══════════════════════════════════════════════════════
    //           DESCRIPTIONS PANEL
    // ══════════════════════════════════════════════════════
    function renderDescriptions() {
        const sheet = getSheet(); if (!sheet) return;
        $descriptionsList.innerHTML = '';
        let num = 1;
        CATEGORIES.forEach(cat => {
            (sheet.categories[cat] || []).forEach(act => {
                const div = document.createElement('div');
                div.className = 'gs-desc-item ' + cat;
                div.innerHTML = `<span class="gs-desc-num">${num}.</span> ${escHtml(act.label)}`;
                $descriptionsList.appendChild(div);
                num++;
            });
        });
        if (num === 1) $descriptionsList.innerHTML = '<p style="color:#b2bec3;font-size:0.85rem;font-weight:600;">No activities added yet.</p>';
    }

    // ══════════════════════════════════════════════════════
    //    Phase 3: SCALE CONFIG MODAL
    // ══════════════════════════════════════════════════════
    function openScaleConfig() {
        const sheet = getSheet(); if (!sheet) return;
        $editPmax.value = sheet.pmax || 50;
        $editExig.value = sheet.exig || 60;
        $editNmin.value = sheet.nmin || 1.0;
        $editNmax.value = sheet.nmax || 5.0;
        $editNapr.value = sheet.napr || 3.0;
        loadSavedScales($editImportScale);
        $scaleOverlay.style.display = '';
    }

    function closeScaleConfig() { $scaleOverlay.style.display = 'none'; }

    function saveScaleConfig() {
        const sheet = getSheet(); if (!sheet) return;
        sheet.pmax = parseFloat($editPmax.value) || 50;
        sheet.exig = parseFloat($editExig.value) || 60;
        sheet.nmin = parseFloat($editNmin.value) || 1.0;
        sheet.nmax = parseFloat($editNmax.value) || 5.0;
        sheet.napr = parseFloat($editNapr.value) || 3.0;
        sheet.updatedAt = Date.now();
        saveToStorage(); closeScaleConfig(); renderGrid();
    }

    function loadSavedScales(selectEl) {
        let scales = [];
        try {
            const data = JSON.parse(localStorage.getItem('esl_grading_scale_data'));
            if (data && Array.isArray(data.savedScales)) scales = data.savedScales;
        } catch (e) { }

        selectEl.innerHTML = '<option value="">-- Custom --</option>';
        scales.forEach(sc => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(sc);
            opt.textContent = `${sc.name} (Max: ${sc.pmax}, Pass: ${sc.napr})`;
            selectEl.appendChild(opt);
        });
    }

    // Auto-fill inputs when a saved scale is selected
    function applySavedScale(selectEl, prefix) {
        const val = selectEl.value;
        if (!val) return;
        try {
            const sc = JSON.parse(val);
            $(prefix + '-pmax').value = sc.pmax;
            $(prefix + '-exig').value = sc.exig;
            $(prefix + '-nmin').value = sc.nmin;
            $(prefix + '-nmax').value = sc.nmax;
            $(prefix + '-napr').value = sc.napr;
        } catch (e) { }
    }

    $fieldImportScale.addEventListener('change', () => applySavedScale($fieldImportScale, 'gs-field'));
    $editImportScale.addEventListener('change', () => applySavedScale($editImportScale, 'gs-edit'));

    // ══════════════════════════════════════════════════════
    //    Phase 3: MISSING GRADES REPORT
    // ══════════════════════════════════════════════════════
    function openMissingReport() {
        const sheet = getSheet(); if (!sheet) return;
        const { missing, studentsWithGrades, totalCells, filledCells } = getMissingGrades(sheet);
        const allActs = getAllActivities(sheet);
        const students = getStudentNames(sheet.group);

        $missingContent.innerHTML = '';

        // Summary stats
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'gs-missing-summary';
        summaryDiv.innerHTML = `
            <div class="gs-missing-stat"><i class="fa-solid fa-users"></i> <strong>${students.length}</strong> students</div>
            <div class="gs-missing-stat"><i class="fa-solid fa-list-check"></i> <strong>${allActs.length}</strong> activities</div>
            <div class="gs-missing-stat"><i class="fa-solid fa-chart-pie"></i> <strong>${filledCells}/${totalCells}</strong> grades entered</div>
            <div class="gs-missing-stat"><i class="fa-solid fa-user-check"></i> <strong>${studentsWithGrades}</strong> with grades</div>`;
        $missingContent.appendChild(summaryDiv);

        // Activation threshold: show report when >= 50% of students have at least 1 grade
        const threshold = Math.ceil(students.length * 0.5);
        if (studentsWithGrades < threshold) {
            const notice = document.createElement('div');
            notice.className = 'gs-missing-none';
            notice.innerHTML = `<i class="fa-solid fa-info-circle"></i> Enter grades for at least ${threshold} students to activate the missing grades report.`;
            $missingContent.appendChild(notice);
        } else if (missing.length === 0) {
            const notice = document.createElement('div');
            notice.className = 'gs-missing-none';
            notice.innerHTML = '<i class="fa-solid fa-circle-check"></i> All graded students have complete data!';
            $missingContent.appendChild(notice);
        } else {
            missing.forEach(({ name, acts }) => {
                const div = document.createElement('div');
                div.className = 'gs-missing-item';
                const actLabels = acts.map(a => a.label || 'Untitled').join(', ');
                div.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i>
                    <span class="gs-missing-name">${escHtml(name)}</span>
                    <span class="gs-missing-acts">Missing: ${escHtml(actLabels)}</span>`;
                $missingContent.appendChild(div);
            });
        }

        $missingOverlay.style.display = '';
    }

    function closeMissingReport() { $missingOverlay.style.display = 'none'; }

    // ══════════════════════════════════════════════════════
    //              CSV EXPORT (Phase 4)
    // ══════════════════════════════════════════════════════
    function csvEscape(val) {
        if (val == null) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    }

    function buildSheetCsv(sheet) {
        const students = getStudentNames(sheet.group);
        const allActs = getAllActivities(sheet);
        const rows = [];

        // Header block
        rows.push(['Grade Sheet Report'].map(csvEscape).join(','));
        rows.push(['Teacher:', sheet.teacherName, '', 'Subject:', sheet.subject].map(csvEscape).join(','));
        rows.push(['Group:', sheet.group, '', 'Term:', sheet.term + ' Term'].map(csvEscape).join(','));
        rows.push(['Scale:', 'Max ' + sheet.maxScore, 'Pass ' + sheet.passingGrade, 'Min ' + sheet.minGrade, 'Max ' + sheet.maxGrade].map(csvEscape).join(','));
        rows.push(''); // blank line

        // Category headers row
        const catHeaderCells = ['#', 'Student'];
        CATEGORIES.forEach(cat => {
            const acts = allActs.filter(a => a.category === cat);
            acts.forEach((_, i) => {
                catHeaderCells.push(i === 0 ? CAT_LABELS[cat] + ' (' + (CAT_WEIGHTS[cat] * 100) + '%)' : '');
                catHeaderCells.push(''); // For the Grade column
            });
        });
        catHeaderCells.push('Weighted Avg');
        rows.push(catHeaderCells.map(csvEscape).join(','));

        // Activity labels row
        const actLabelCells = ['', ''];
        let colNum = 1;
        CATEGORIES.forEach(cat => {
            allActs.filter(a => a.category === cat).forEach(act => {
                actLabelCells.push(colNum + '. ' + (act.label || '') + ' Score');
                actLabelCells.push(colNum + '. ' + (act.label || '') + ' Grade');
                colNum++;
            });
        });
        actLabelCells.push('');
        rows.push(actLabelCells.map(csvEscape).join(','));

        // Student rows
        students.forEach((name, idx) => {
            const row = [idx + 1, name];
            CATEGORIES.forEach(cat => {
                allActs.filter(a => a.category === cat).forEach(act => {
                    const val = (sheet.grades[name] || {})[act.id];
                    if (val != null && val !== '') {
                        row.push(val);
                        const sc = getScaleForActivity(act, sheet);
                        const g = calculateGrade(parseFloat(val), sc.pmax, sc.exig, sc.nmin, sc.nmax, sc.napr);
                        row.push((Math.round(g * 10) / 10).toFixed(1));
                    } else {
                        row.push('');
                        row.push('');
                    }
                });
            });
            // Weighted avg
            const { avg } = calcWeightedAvg(name, sheet);
            row.push(avg !== null ? Math.round(avg * 10) / 10 : '');
            rows.push(row.map(csvEscape).join(','));
        });

        return rows.join('\r\n');
    }

    function downloadCsv(filename, csvContent) {
        // UTF-8 BOM for tilde support in Excel
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function exportCurrentSheet() {
        const sheet = getSheet();
        if (!sheet) return;
        const csv = buildSheetCsv(sheet);
        const filename = (sheet.subject + '_' + sheet.group + '_' + sheet.term + '_Term').replace(/\s+/g, '_') + '.csv';
        downloadCsv(filename, csv);
    }

    function exportSelected() {
        if (selectedIds.size === 0) return;
        const selected = sheets.filter(s => selectedIds.has(s.id));
        if (selected.length === 1) {
            const s = selected[0];
            const csv = buildSheetCsv(s);
            downloadCsv((s.subject + '_' + s.group + '_' + s.term).replace(/\s+/g, '_') + '.csv', csv);
        } else {
            // Multi-sheet: combine with separators
            const parts = selected.map(s => buildSheetCsv(s));
            const combined = parts.join('\r\n\r\n' + '═'.repeat(60) + '\r\n\r\n');
            downloadCsv('Grade_Sheets_Export.csv', combined);
        }
    }

    // ══════════════════════════════════════════════════════
    //              EVENT BINDINGS
    // ══════════════════════════════════════════════════════
    function bindEvents() {
        // Dashboard
        $newSheetBtn.addEventListener('click', openNewSheetModal);
        if ($driveBtn && driveService) {
            $driveBtn.addEventListener('click', () => driveService.openModal());
        }
        $modalClose.addEventListener('click', closeNewSheetModal);
        $modalCancel.addEventListener('click', closeNewSheetModal);
        $modalCreate.addEventListener('click', createSheet);
        $modalOverlay.addEventListener('click', e => { if (e.target === $modalOverlay) closeNewSheetModal(); });
        $deleteOverlay.querySelectorAll('.gs-delete-cancel-btn').forEach(b => b.addEventListener('click', closeDeleteConfirm));
        $deleteConfirm.addEventListener('click', confirmDelete);
        $deleteOverlay.addEventListener('click', e => { if (e.target === $deleteOverlay) closeDeleteConfirm(); });
        $backToDashboard.addEventListener('click', backToDashboard);
        $exportSelectedBtn.addEventListener('click', exportSelected);

        // Editor – Add activity
        document.querySelectorAll('.gs-add-activity-bar .gs-btn-sm').forEach(btn => btn.addEventListener('click', () => addActivity(btn.dataset.cat)));

        // Phase 6 - Buttons
        if ($toggleViewBtn) $toggleViewBtn.addEventListener('click', toggleViewMode);
        if ($actSettingsClose) $actSettingsClose.forEach(b => b.addEventListener('click', closeActivitySettings));
        if ($actSettingsSave) $actSettingsSave.addEventListener('click', saveActivitySettings);
        if ($actScaleSelect) $actScaleSelect.addEventListener('change', updateActScalePreview);
        if ($actSettingsOverlay) $actSettingsOverlay.addEventListener('click', e => { if (e.target === $actSettingsOverlay) closeActivitySettings(); });
        CATEGORIES.forEach(cat => {
            const inp = $('gs-add-' + cat + '-input');
            if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addActivity(cat); });
        });
        $toggleDescriptions.addEventListener('click', () => $descriptionsPanel.classList.toggle('hidden'));

        // Phase 4 – Export CSV
        $exportCsvBtn.addEventListener('click', exportCurrentSheet);

        // Phase 3 – Scale config
        $scaleConfigBtn.addEventListener('click', openScaleConfig);
        document.querySelectorAll('.gs-scale-close').forEach(b => b.addEventListener('click', closeScaleConfig));
        $scaleSave.addEventListener('click', saveScaleConfig);
        $scaleOverlay.addEventListener('click', e => { if (e.target === $scaleOverlay) closeScaleConfig(); });

        // Phase 3 – Missing grades report
        $missingBtn.addEventListener('click', openMissingReport);
        document.querySelectorAll('.gs-missing-close').forEach(b => b.addEventListener('click', closeMissingReport));
        $missingOverlay.addEventListener('click', e => { if (e.target === $missingOverlay) closeMissingReport(); });

        // Keyboard
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if ($modalOverlay.style.display !== 'none') closeNewSheetModal();
                if ($deleteOverlay.style.display !== 'none') closeDeleteConfirm();
                if ($scaleOverlay.style.display !== 'none') closeScaleConfig();
                if ($missingOverlay.style.display !== 'none') closeMissingReport();
            }
            if (e.key === 'Enter' && $modalOverlay.style.display !== 'none') {
                if (!document.activeElement || !document.activeElement.classList.contains('gs-add-input')) createSheet();
            }
        });
    }

    // ══════════════════════════════════════════════════════
    //                      INIT
    // ══════════════════════════════════════════════════════
    function init() { populateGroupDropdown(); loadFromStorage(); renderDashboard(); bindEvents(); }
    document.addEventListener('DOMContentLoaded', init);
})();
