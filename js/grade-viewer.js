(() => {
    'use strict';

    const STORAGE_KEY = 'grade-viewer-data';
    const SUBJECTS = [
        { key: 'ART', name: 'Arts' },
        { key: 'CATEDRA', name: 'Cátedra por la Paz' },
        { key: 'CN', name: 'Ciencias Naturales' },
        { key: 'CS', name: 'Ciencias Sociales' },
        { key: 'EFIS', name: 'Educación Física' },
        { key: 'ESP', name: 'Lenguaje' },
        { key: 'ETI', name: 'Ethics' },
        { key: 'GEO', name: 'Geometry' },
        { key: 'GRA', name: 'Grammar' },
        { key: 'LIS', name: 'Listening' },
        { key: 'MAT', name: 'Matemáticas' },
        { key: 'PLEC', name: 'Plan Lector' },
        { key: 'REA', name: 'Reading' },
        { key: 'REL', name: 'Religión' },
        { key: 'SC', name: 'Science' },
        { key: 'SPE', name: 'Speaking' },
        { key: 'TECH', name: 'Technology' },
        { key: 'WRI', name: 'Writing' }
    ];
    const SUBJECT_KEYS = new Set(SUBJECTS.map((subject) => subject.key));
    const SCORE_ROWS = [
        { key: 's1', recKey: 'recS1', label: 'S1' },
        { key: 's2', recKey: 'recS2', label: 'S2' },
        { key: 's3', recKey: 'recS3', label: 'S3' },
        { key: 'def', recKey: 'recDef', label: 'D' }
    ];
    const GRADE_FIELDS = SCORE_ROWS.flatMap((row) => [row.key, row.recKey]);

    const ROSTER = typeof STUDENT_GROUPS !== 'undefined' ? STUDENT_GROUPS : {};
    const CLASS_GROUP_LIST = typeof CLASS_GROUPS !== 'undefined' && Array.isArray(CLASS_GROUPS)
        ? CLASS_GROUPS
        : Object.keys(ROSTER).map((id) => ({ id, label: id, students: ROSTER[id] || [] }));
    const ALL_ROSTER_STUDENTS = CLASS_GROUP_LIST.flatMap((group) =>
        (group.students || []).map((name) => ({ name, group: group.id, groupLabel: group.label }))
    );

    let data = emptyData();
    let currentView = 'parent';
    let selectedStudentId = null;
    let selectedStudentName = '';
    let selectedStudentGroup = '';
    let parentTermKey = '';
    let manageTermKey = '';
    let manageGroupId = CLASS_GROUP_LIST.some((group) => group.id === '4C') ? '4C' : (CLASS_GROUP_LIST[0]?.id || '__all__');
    let parentPanel = 'snapshot';
    let suggestionIndex = -1;
    let addSuggestionIndex = -1;
    let statusTimer = null;
    let gridDirty = false;
    let showSubRows = null; // null = automatic (shown only when the term has S1–S3 grades)

    const elements = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindEvents();
        loadData();
        populateGroupSelect();
        populateTermSelects();
        setView('parent');
        renderParent();
    }

    function cacheElements() {
        elements.status = document.getElementById('gv-status');
        elements.manageBtn = document.getElementById('gv-manage-btn');
        elements.parentBtn = document.getElementById('gv-parent-btn');
        elements.exportBtn = document.getElementById('gv-export-btn');
        elements.importBtn = document.getElementById('gv-import-btn');
        elements.importInput = document.getElementById('gv-import-input');
        elements.driveBtn = document.getElementById('gv-drive-btn');
        elements.parentView = document.getElementById('gv-parent-view');
        elements.manageView = document.getElementById('gv-manage-view');
        elements.studentSearch = document.getElementById('gv-student-search');
        elements.studentSuggestions = document.getElementById('gv-student-suggestions');
        elements.parentEmpty = document.getElementById('gv-parent-empty');
        elements.parentDetail = document.getElementById('gv-parent-detail');
        elements.selectedInline = document.getElementById('gv-selected-inline');
        elements.selectedName = document.getElementById('gv-selected-name');
        elements.selectedMeta = document.getElementById('gv-selected-meta');
        elements.clearStudent = document.getElementById('gv-clear-student');
        elements.parentTerm = document.getElementById('gv-parent-term');
        elements.tierFilter = document.getElementById('gv-tier-filter');
        elements.tabSnapshot = document.getElementById('gv-tab-snapshot');
        elements.tabCompare = document.getElementById('gv-tab-compare');
        elements.panelSnapshot = document.getElementById('gv-panel-snapshot');
        elements.panelCompare = document.getElementById('gv-panel-compare');
        elements.summary = document.getElementById('gv-summary');
        elements.stats = document.getElementById('gv-stats');
        elements.subjectGrid = document.getElementById('gv-subject-grid');
        elements.compareHost = document.getElementById('gv-compare-host');
        elements.manageTerm = document.getElementById('gv-manage-term');
        elements.createTermBtn = document.getElementById('gv-create-term-btn');
        elements.deleteTermBtn = document.getElementById('gv-delete-term-btn');
        elements.manageGroup = document.getElementById('gv-manage-group');
        elements.addGroupBtn = document.getElementById('gv-add-group-btn');
        elements.saveTermBtn = document.getElementById('gv-save-term-btn');
        elements.addStudentSearch = document.getElementById('gv-add-student-search');
        elements.addStudentSuggestions = document.getElementById('gv-add-student-suggestions');
        elements.gridHost = document.getElementById('gv-grid-host');
        elements.showSubRows = document.getElementById('gv-show-sub-rows');
        elements.termModal = document.getElementById('gv-term-modal');
        elements.closeTermModal = document.getElementById('gv-close-term-modal');
        elements.cancelTerm = document.getElementById('gv-cancel-term');
        elements.termForm = document.getElementById('gv-term-form');
        elements.termPeriod = document.getElementById('gv-term-period');
        elements.termYear = document.getElementById('gv-term-year');
        elements.termLabel = document.getElementById('gv-term-label');
        elements.termFormError = document.getElementById('gv-term-form-error');
    }

    function bindEvents() {
        elements.manageBtn.addEventListener('click', () => setView('manage'));
        elements.parentBtn.addEventListener('click', () => setView('parent'));
        elements.exportBtn.addEventListener('click', exportGrades);
        elements.importBtn.addEventListener('click', () => elements.importInput.click());
        elements.importInput.addEventListener('change', importGrades);
        elements.driveBtn.addEventListener('click', openDrive);

        elements.studentSearch.addEventListener('input', () => renderStudentSuggestions(elements.studentSearch.value));
        elements.studentSearch.addEventListener('focus', () => renderStudentSuggestions(elements.studentSearch.value));
        elements.studentSearch.addEventListener('keydown', (event) => handleSuggestionKeys(event, 'parent'));
        elements.studentSuggestions.addEventListener('mousedown', (event) => {
            const item = event.target.closest('[data-name]');
            if (!item) return;
            event.preventDefault();
            selectParentStudent(item.dataset.name, item.dataset.group || '');
        });

        elements.clearStudent.addEventListener('click', clearParentStudent);
        elements.parentTerm.addEventListener('change', () => {
            parentTermKey = elements.parentTerm.value;
            renderParentDetail();
        });
        elements.tierFilter.addEventListener('change', renderParentDetail);
        elements.tabSnapshot.addEventListener('click', () => setParentPanel('snapshot'));
        elements.tabCompare.addEventListener('click', () => setParentPanel('compare'));

        elements.showSubRows.addEventListener('change', () => {
            showSubRows = elements.showSubRows.checked;
            renderGrid();
        });
        elements.manageTerm.addEventListener('change', () => {
            showSubRows = null;
            manageTermKey = elements.manageTerm.value;
            renderGrid();
        });
        elements.createTermBtn.addEventListener('click', openTermModal);
        elements.deleteTermBtn.addEventListener('click', deleteCurrentTerm);
        elements.manageGroup.addEventListener('change', () => {
            manageGroupId = elements.manageGroup.value;
            renderGrid();
        });
        elements.addGroupBtn.addEventListener('click', addSelectedGroup);
        elements.saveTermBtn.addEventListener('click', saveTermSession);

        elements.addStudentSearch.addEventListener('input', () => renderAddStudentSuggestions(elements.addStudentSearch.value));
        elements.addStudentSearch.addEventListener('focus', () => renderAddStudentSuggestions(elements.addStudentSearch.value));
        elements.addStudentSearch.addEventListener('keydown', (event) => handleSuggestionKeys(event, 'add'));
        elements.addStudentSuggestions.addEventListener('mousedown', (event) => {
            const item = event.target.closest('[data-action]');
            if (!item) return;
            event.preventDefault();
            if (item.dataset.action === 'add') {
                addStudent(item.dataset.name, item.dataset.group || '');
            }
        });

        elements.gridHost.addEventListener('keydown', handleGridKeydown);
        elements.gridHost.addEventListener('focusin', (event) => {
            if (event.target.classList.contains('gv-cell')) event.target.select();
        });
        elements.gridHost.addEventListener('input', handleGridInput);
        elements.gridHost.addEventListener('focusout', handleGridFocusOut);
        elements.gridHost.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-remove-student]');
            if (!removeBtn) return;
            removeStudent(removeBtn.dataset.removeStudent);
        });

        elements.closeTermModal.addEventListener('click', closeTermModal);
        elements.cancelTerm.addEventListener('click', closeTermModal);
        elements.termModal.addEventListener('click', (event) => {
            if (event.target === elements.termModal) closeTermModal();
        });
        elements.termForm.addEventListener('submit', createTermFromForm);
        elements.termPeriod.addEventListener('change', syncTermLabelPlaceholder);
        elements.termYear.addEventListener('input', syncTermLabelPlaceholder);

        document.addEventListener('click', (event) => {
            if (!event.target.closest('#gv-student-search, #gv-student-suggestions')) {
                hideSuggestions(elements.studentSuggestions, elements.studentSearch);
            }
            if (!event.target.closest('#gv-add-student-search, #gv-add-student-suggestions')) {
                hideSuggestions(elements.addStudentSuggestions, elements.addStudentSearch);
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !elements.termModal.hidden) closeTermModal();
        });
    }

    function emptyData() {
        return { students: [], terms: {} };
    }

    function emptySubjectGrades() {
        return {
            s1: null, s2: null, s3: null, def: null,
            recS1: null, recS2: null, recS3: null, recDef: null
        };
    }

    function loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const validation = validateData(parsed);
            if (!validation.valid) {
                showStatus(`Saved grade data could not be loaded: ${validation.message}`, 'error', false);
                return;
            }
            data = normalizeData(parsed);
        } catch (error) {
            showStatus('Saved grade data is malformed and was not loaded.', 'error', false);
        }
    }

    function persist(successMessage, options = {}) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            if (successMessage) showStatus(successMessage, 'success', options.autoHide !== false);
            return true;
        } catch (error) {
            showStatus('Could not save grades to this browser. Export a backup immediately.', 'error', false);
            return false;
        }
    }

    function normalizeData(value) {
        const next = emptyData();
        const seenIds = new Set();
        (value.students || []).forEach((student) => {
            if (!student || typeof student.id !== 'string' || typeof student.name !== 'string') return;
            const id = student.id.trim();
            const name = student.name.trim();
            if (!id || !name || seenIds.has(id)) return;
            seenIds.add(id);
            next.students.push({ id, name });
        });

        Object.entries(value.terms || {}).forEach(([key, term]) => {
            const grades = {};
            Object.entries(term.grades || {}).forEach(([studentId, subjects]) => {
                const subjectMap = {};
                Object.entries(subjects || {}).forEach(([subjectKey, entry]) => {
                    if (!SUBJECT_KEYS.has(subjectKey)) return;
                    subjectMap[subjectKey] = normalizeGradeEntry(entry);
                });
                grades[studentId] = subjectMap;
            });
            next.terms[key] = {
                label: String(term.label || key),
                grades
            };
        });
        return next;
    }

    function normalizeGradeEntry(entry) {
        const next = emptySubjectGrades();
        if (!entry || typeof entry !== 'object') return next;
        GRADE_FIELDS.forEach((field) => {
            next[field] = toScaleGrade(entry[field]);
        });
        return next;
    }

    function validateData(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return { valid: false, message: 'the backup must be an object with students and terms.' };
        }
        if (!Array.isArray(value.students)) {
            return { valid: false, message: 'students must be an array.' };
        }
        const ids = new Set();
        for (let index = 0; index < value.students.length; index += 1) {
            const student = value.students[index];
            if (!student || typeof student !== 'object' || Array.isArray(student)) {
                return { valid: false, message: `student ${index + 1} is not an object.` };
            }
            if (typeof student.id !== 'string' || !student.id.trim()) {
                return { valid: false, message: `student ${index + 1} is missing an id.` };
            }
            if (ids.has(student.id)) {
                return { valid: false, message: `student ${index + 1} has a duplicate id.` };
            }
            ids.add(student.id);
            if (typeof student.name !== 'string' || !student.name.trim()) {
                return { valid: false, message: `student ${index + 1} is missing a name.` };
            }
        }
        if (!value.terms || typeof value.terms !== 'object' || Array.isArray(value.terms)) {
            return { valid: false, message: 'terms must be an object.' };
        }
        const keys = Object.keys(value.terms);
        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            const term = value.terms[key];
            if (!key.trim()) {
                return { valid: false, message: 'a term key is empty.' };
            }
            if (!term || typeof term !== 'object' || Array.isArray(term)) {
                return { valid: false, message: `term ${key} is not an object.` };
            }
            if (typeof term.label !== 'string' || !term.label.trim()) {
                return { valid: false, message: `term ${key} is missing a label.` };
            }
            if (!term.grades || typeof term.grades !== 'object' || Array.isArray(term.grades)) {
                return { valid: false, message: `term ${key} is missing a grades object.` };
            }
            const studentIds = Object.keys(term.grades);
            for (let s = 0; s < studentIds.length; s += 1) {
                const studentId = studentIds[s];
                const subjects = term.grades[studentId];
                if (!subjects || typeof subjects !== 'object' || Array.isArray(subjects)) {
                    return { valid: false, message: `grades for ${studentId} in ${key} are invalid.` };
                }
                const subjectKeys = Object.keys(subjects);
                for (let k = 0; k < subjectKeys.length; k += 1) {
                    const subjectKey = subjectKeys[k];
                    if (!SUBJECT_KEYS.has(subjectKey)) {
                        return { valid: false, message: `unknown subject "${subjectKey}" in ${key}.` };
                    }
                    const entry = subjects[subjectKey];
                    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                        return { valid: false, message: `${subjectKey} grades for ${studentId} in ${key} are invalid.` };
                    }
                    for (let f = 0; f < GRADE_FIELDS.length; f += 1) {
                        const field = GRADE_FIELDS[f];
                        if (!(field in entry) || entry[field] == null || entry[field] === '') continue;
                        if (toScaleGrade(entry[field]) == null) {
                            return { valid: false, message: `${subjectKey}.${field} for ${studentId} in ${key} is not a valid grade.` };
                        }
                    }
                }
            }
        }
        return { valid: true };
    }

    /**
     * Convert a stored or typed value onto the 1.0–5.0 scale.
     * Report cells are printed as grade × 10 (47 = 4.7). Values already on
     * the 1–5 scale are left as-is. Tiers always use this converted value.
     */
    function toScaleGrade(value) {
        if (value == null || value === '') return null;
        const numeric = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
        if (!Number.isFinite(numeric)) return null;
        const grade = numeric > 5 ? numeric / 10 : numeric;
        if (grade < 1 || grade > 5) return null;
        return Math.round(grade * 10) / 10;
    }

    function parseGradeInput(raw) {
        const text = String(raw ?? '').trim();
        if (!text) return { ok: true, value: null };
        const value = toScaleGrade(text);
        if (value == null) return { ok: false, value: null };
        return { ok: true, value };
    }

    function getTier(value) {
        const grade = toScaleGrade(value);
        if (grade == null) return null;
        if (grade >= 4.7) return 'superior';
        if (grade >= 4.0) return 'alto';
        if (grade >= 3.5) return 'basico';
        return 'bajo';
    }

    /**
     * Tier for an average (PROM). Uses the same precision the school report
     * prints (39,56 → 3.956 is Básico) instead of rounding to 1 decimal first.
     */
    function getAverageTier(average) {
        if (average == null || !Number.isFinite(average)) return null;
        const value = Math.round(average * 1000) / 1000;
        if (value >= 4.7) return 'superior';
        if (value >= 4.0) return 'alto';
        if (value >= 3.5) return 'basico';
        return 'bajo';
    }

    function formatAverage(average) {
        return average == null ? '—' : average.toFixed(2);
    }

    function formatGrade(value) {
        const grade = toScaleGrade(value);
        return grade == null ? '' : grade.toFixed(1);
    }

    function displayGrade(value) {
        return formatGrade(value) || '—';
    }

    function setView(view) {
        if (currentView === 'manage' && view === 'parent' && gridDirty) {
            showStatus("Don't forget to export a backup.", 'info');
            gridDirty = false;
        }
        currentView = view;
        elements.parentView.hidden = view !== 'parent';
        elements.manageView.hidden = view !== 'manage';
        elements.manageBtn.hidden = view === 'manage';
        elements.parentBtn.hidden = view === 'parent';
        if (view === 'manage') {
            if (!manageTermKey) manageTermKey = latestTermKey();
            populateTermSelects();
            renderGrid();
        } else {
            renderParent();
        }
    }

    function termKeysSorted() {
        return Object.keys(data.terms).sort(compareTermKeys);
    }

    function compareTermKeys(a, b) {
        const pa = parseTermKey(a);
        const pb = parseTermKey(b);
        if (pa.year !== pb.year) return pa.year - pb.year;
        if (pa.period !== pb.period) return pa.period - pb.period;
        return a.localeCompare(b);
    }

    function parseTermKey(key) {
        const match = /^P([1-4])-(\d{4})$/.exec(key);
        if (!match) return { period: 99, year: 0 };
        return { period: Number(match[1]), year: Number(match[2]) };
    }

    function latestTermKey() {
        const keys = termKeysSorted();
        return keys[keys.length - 1] || '';
    }

    function populateTermSelects() {
        const keys = termKeysSorted();
        if (!parentTermKey || !data.terms[parentTermKey]) parentTermKey = latestTermKey();
        if (!manageTermKey || !data.terms[manageTermKey]) manageTermKey = latestTermKey();
        fillTermSelect(elements.parentTerm, parentTermKey, keys);
        fillTermSelect(elements.manageTerm, manageTermKey, keys);
        parentTermKey = elements.parentTerm.value;
        manageTermKey = elements.manageTerm.value;
    }

    function fillTermSelect(select, selected, keys) {
        if (!select) return;
        if (!keys.length) {
            select.innerHTML = '<option value="">No terms yet</option>';
            select.disabled = true;
            return;
        }
        select.disabled = false;
        select.innerHTML = keys.map((key) => {
            const label = escapeHtml(data.terms[key].label || key);
            const isSelected = key === selected ? ' selected' : '';
            return `<option value="${escapeHtml(key)}"${isSelected}>${label}</option>`;
        }).join('');
    }

    function populateGroupSelect() {
        const extra = [
            { id: '__all__', label: 'All students in file' },
            { id: '__other__', label: 'Other / not in a group' }
        ];
        const options = [...CLASS_GROUP_LIST, ...extra];
        elements.manageGroup.innerHTML = options.map((group) => {
            const selected = group.id === manageGroupId ? ' selected' : '';
            return `<option value="${escapeHtml(group.id)}"${selected}>${escapeHtml(group.label)}</option>`;
        }).join('');
    }

    function setParentPanel(panel) {
        parentPanel = panel;
        const snapshot = panel === 'snapshot';
        elements.tabSnapshot.classList.toggle('active', snapshot);
        elements.tabCompare.classList.toggle('active', !snapshot);
        elements.tabSnapshot.setAttribute('aria-selected', snapshot ? 'true' : 'false');
        elements.tabCompare.setAttribute('aria-selected', snapshot ? 'false' : 'true');
        elements.panelSnapshot.hidden = !snapshot;
        elements.panelCompare.hidden = snapshot;
    }

    function normalizeLookup(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokenizeLookup(value) {
        return normalizeLookup(value).split(' ').filter(Boolean);
    }

    function tokensMatchNameWords(words, tokens) {
        const used = new Set();
        return tokens.every((token) => {
            const idx = words.findIndex((word, i) => !used.has(i) && word.startsWith(token));
            if (idx === -1) return false;
            used.add(idx);
            return true;
        });
    }

    function nameMatchScore(words, tokens) {
        return tokens.reduce((score, token) => {
            if (words.some((word) => word === token)) return score + 3;
            if (words.some((word) => word.startsWith(token))) return score + 1;
            return score;
        }, 0);
    }

    function highlightMatch(name, tokens) {
        const escaped = escapeHtml(name);
        if (!tokens.length) return escaped;
        return escaped.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (word) => {
            const normalized = normalizeLookup(word);
            const token = tokens.find((item) => normalized.startsWith(item));
            if (!token) return word;
            return `<span class="gv-match">${escapeHtml(word.slice(0, token.length))}</span>${escapeHtml(word.slice(token.length))}`;
        });
    }

    function searchRoster(query, limit = 12) {
        const tokens = tokenizeLookup(query);
        if (!tokens.length) return [];
        return ALL_ROSTER_STUDENTS
            .map((student) => {
                const words = tokenizeLookup(student.name);
                return { student, words, matched: tokensMatchNameWords(words, tokens) };
            })
            .filter((item) => item.matched)
            .sort((a, b) => {
                const scoreDiff = nameMatchScore(b.words, tokens) - nameMatchScore(a.words, tokens);
                if (scoreDiff) return scoreDiff;
                return a.student.name.localeCompare(b.student.name, 'es');
            })
            .slice(0, limit)
            .map((item) => item.student);
    }

    function storedStudentMatches(query) {
        const tokens = tokenizeLookup(query);
        if (!tokens.length) return [];
        return data.students.filter((student) => tokensMatchNameWords(tokenizeLookup(student.name), tokens));
    }

    function groupForName(name) {
        const normalized = normalizeLookup(name);
        const match = ALL_ROSTER_STUDENTS.find((student) => normalizeLookup(student.name) === normalized);
        return match ? match.group : '';
    }

    function groupLabel(groupId) {
        return CLASS_GROUP_LIST.find((group) => group.id === groupId)?.label || groupId || '';
    }

    function findStoredStudent(name) {
        const normalized = normalizeLookup(name);
        return data.students.find((student) => normalizeLookup(student.name) === normalized) || null;
    }

    function studentIdFromName(name) {
        const slug = normalizeLookup(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return slug || `student-${Date.now()}`;
    }

    function ensureStudent(name) {
        const existing = findStoredStudent(name);
        if (existing) return existing;
        const student = { id: studentIdFromName(name), name: name.trim() };
        if (data.students.some((item) => item.id === student.id)) {
            student.id = `${student.id}-${Date.now()}`;
        }
        data.students.push(student);
        data.students.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        return student;
    }

    function renderStudentSuggestions(query) {
        suggestionIndex = -1;
        const list = elements.studentSuggestions;
        const tokens = tokenizeLookup(query);
        const rosterHits = searchRoster(query);
        const extraStored = storedStudentMatches(query).filter((student) =>
            !rosterHits.some((hit) => normalizeLookup(hit.name) === normalizeLookup(student.name))
        );
        const combined = [
            ...rosterHits,
            ...extraStored.map((student) => ({ name: student.name, group: groupForName(student.name), groupLabel: groupLabel(groupForName(student.name)) || 'File' }))
        ];

        if (!tokens.length) {
            list.hidden = true;
            elements.studentSearch.setAttribute('aria-expanded', 'false');
            return;
        }
        if (!combined.length) {
            list.innerHTML = '<li class="gv-suggestion-empty">No students found</li>';
            list.hidden = false;
            elements.studentSearch.setAttribute('aria-expanded', 'true');
            return;
        }
        list.innerHTML = combined.map((student, index) => `
            <li class="gv-suggestion" role="option" data-index="${index}" data-name="${escapeHtml(student.name)}" data-group="${escapeHtml(student.group || '')}">
                <span>${highlightMatch(student.name, tokens)}</span>
                <strong class="gv-suggestion-group">${escapeHtml(student.groupLabel || student.group || '')}</strong>
            </li>
        `).join('');
        list.hidden = false;
        elements.studentSearch.setAttribute('aria-expanded', 'true');
    }

    function renderAddStudentSuggestions(query) {
        addSuggestionIndex = -1;
        const list = elements.addStudentSuggestions;
        const tokens = tokenizeLookup(query);
        const rosterHits = searchRoster(query);
        if (!tokens.length) {
            list.hidden = true;
            return;
        }
        const items = rosterHits.map((student, index) => `
            <li class="gv-suggestion" role="option" data-action="add" data-index="${index}" data-name="${escapeHtml(student.name)}" data-group="${escapeHtml(student.group || '')}">
                <span>${highlightMatch(student.name, tokens)}</span>
                <strong class="gv-suggestion-group">${escapeHtml(student.groupLabel || student.group)}</strong>
            </li>
        `);
        const exactRoster = rosterHits.some((student) => normalizeLookup(student.name) === normalizeLookup(query));
        const exactStored = findStoredStudent(query);
        if (!exactRoster && !exactStored && query.trim().length > 2) {
            items.push(`
                <li class="gv-suggestion" role="option" data-action="add" data-index="${items.length}" data-name="${escapeHtml(query.trim())}" data-group="">
                    <span>Add “${escapeHtml(query.trim())}”</span>
                    <strong class="gv-suggestion-action">New</strong>
                </li>
            `);
        }
        if (!items.length) {
            list.innerHTML = '<li class="gv-suggestion-empty">No matching roster names</li>';
        } else {
            list.innerHTML = items.join('');
        }
        list.hidden = false;
    }

    function handleSuggestionKeys(event, mode) {
        const list = mode === 'parent' ? elements.studentSuggestions : elements.addStudentSuggestions;
        const items = [...list.querySelectorAll('.gv-suggestion')];
        if (!items.length || list.hidden) {
            if (mode === 'add' && event.key === 'Enter' && elements.addStudentSearch.value.trim().length > 2) {
                event.preventDefault();
                addStudent(elements.addStudentSearch.value.trim(), '');
            }
            return;
        }
        let index = mode === 'parent' ? suggestionIndex : addSuggestionIndex;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            index = (index + 1) % items.length;
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            index = index <= 0 ? items.length - 1 : index - 1;
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const target = items[index] || items[0];
            if (!target) return;
            if (mode === 'parent') {
                selectParentStudent(target.dataset.name, target.dataset.group || '');
            } else {
                addStudent(target.dataset.name, target.dataset.group || '');
            }
            return;
        } else if (event.key === 'Escape') {
            hideSuggestions(list, mode === 'parent' ? elements.studentSearch : elements.addStudentSearch);
            return;
        } else {
            return;
        }
        if (mode === 'parent') suggestionIndex = index;
        else addSuggestionIndex = index;
        items.forEach((item, i) => item.classList.toggle('is-active', i === index));
        items[index]?.scrollIntoView({ block: 'nearest' });
    }

    function hideSuggestions(list, input) {
        list.hidden = true;
        list.innerHTML = '';
        input?.setAttribute('aria-expanded', 'false');
    }

    function selectParentStudent(name, group) {
        const stored = findStoredStudent(name);
        selectedStudentId = stored ? stored.id : studentIdFromName(name);
        selectedStudentName = name;
        selectedStudentGroup = group || groupForName(name);
        elements.studentSearch.value = name;
        hideSuggestions(elements.studentSuggestions, elements.studentSearch);
        renderParent();
    }

    function clearParentStudent() {
        selectedStudentId = null;
        selectedStudentName = '';
        selectedStudentGroup = '';
        elements.studentSearch.value = '';
        renderParent();
        elements.studentSearch.focus();
    }

    function renderParent() {
        populateTermSelects();
        const hasStudent = Boolean(selectedStudentName);
        elements.parentEmpty.hidden = hasStudent;
        elements.parentDetail.hidden = !hasStudent;
        elements.selectedInline.hidden = !hasStudent;
        if (!hasStudent) return;
        elements.selectedName.textContent = selectedStudentName;
        elements.selectedMeta.textContent = selectedStudentGroup
            ? `Group ${groupLabel(selectedStudentGroup)}`
            : 'Not linked to a class group';
        renderParentDetail();
    }

    function studentGradesForTerm(termKey, studentId) {
        return data.terms[termKey]?.grades?.[studentId] || {};
    }

    function resolveStudentId() {
        const stored = findStoredStudent(selectedStudentName);
        return stored ? stored.id : selectedStudentId;
    }

    function renderParentDetail() {
        const studentId = resolveStudentId();
        const termKey = parentTermKey;
        const term = termKey ? data.terms[termKey] : null;
        const grades = studentId && term ? studentGradesForTerm(termKey, studentId) : {};
        const filter = elements.tierFilter.value;
        const defs = SUBJECTS
            .map((subject) => toScaleGrade(grades[subject.key]?.def))
            .filter((value) => value != null);
        const prom = defs.length ? defs.reduce((sum, value) => sum + value, 0) / defs.length : null;
        const perd = defs.filter((value) => value < 3.5).length;
        const promTier = getAverageTier(prom);

        elements.summary.innerHTML = `
            <article class="gv-summary-card">
                <div class="gv-summary-label">PROM</div>
                <div class="gv-summary-value ${promTier ? `gv-tier-${promTier}` : ''}">${formatAverage(prom)}</div>
            </article>
            <article class="gv-summary-card ${perd > 0 ? 'is-alert' : ''}">
                <div class="gv-summary-label">Perd</div>
                <div class="gv-summary-value">${perd}</div>
            </article>
            <article class="gv-summary-card">
                <div class="gv-summary-label">Term</div>
                <div class="gv-summary-value" style="font-size:1.15rem">${term ? escapeHtml(term.label) : 'No term'}</div>
            </article>
        `;

        renderStats(studentId, termKey);

        const visibleSubjects = SUBJECTS.filter((subject) => {
            const defTier = getTier(grades[subject.key]?.def);
            return subjectMatchesFilter(defTier, filter);
        });

        if (!term) {
            elements.subjectGrid.innerHTML = '<div class="gv-empty-card"><h3>No terms yet</h3><p>Use Manage Grades to create a period and enter scores.</p></div>';
        } else if (!visibleSubjects.length) {
            elements.subjectGrid.innerHTML = '<div class="gv-empty-card"><h3>No subjects match this filter</h3><p>Choose “All subjects” or another tier.</p></div>';
        } else {
            // Show S1–S3 only when this student has them this term; otherwise just the term grade
            const hasSub = termHasSubScores(termKey, studentId);
            const cardRows = hasSub ? SCORE_ROWS : [{ ...DEF_ROW, label: 'Term grade' }];
            elements.subjectGrid.innerHTML = visibleSubjects.map((subject) => {
                const entry = grades[subject.key] || emptySubjectGrades();
                const blocks = cardRows.map((row) => scoreBlock(row.label, entry[row.key], entry[row.recKey])).join('');
                return `
                    <article class="gv-subject-card">
                        <h4>${escapeHtml(subject.key)} <span>${escapeHtml(subject.name)}</span></h4>
                        <div class="gv-score-row${hasSub ? '' : ' is-single'}">${blocks}</div>
                    </article>
                `;
            }).join('');
        }

        renderComparison(studentId);
    }

    /* ---------- Automatic term statistics (parent view) ---------- */

    const TIER_ORDER = [
        { key: 'superior', label: 'Superior' },
        { key: 'alto', label: 'Alto' },
        { key: 'basico', label: 'Básico' },
        { key: 'bajo', label: 'Bajo' }
    ];

    /** Final (D) grades for one student in one term, keyed by subject. */
    function termDefs(termKey, studentId) {
        const grades = studentGradesForTerm(termKey, studentId);
        return SUBJECTS
            .map((subject) => ({ subject, value: toScaleGrade(grades[subject.key]?.def) }))
            .filter((item) => item.value != null);
    }

    function averageOf(items) {
        return items.length ? items.reduce((sum, item) => sum + item.value, 0) / items.length : null;
    }

    /** Every stored student in the group with at least one D grade in the term, with their average. */
    function groupAverages(groupId, termKey) {
        const group = CLASS_GROUP_LIST.find((item) => item.id === groupId);
        const names = new Set((group?.students || ROSTER[groupId] || []).map((name) => normalizeLookup(name)));
        return data.students
            .filter((student) => names.has(normalizeLookup(student.name)))
            .map((student) => ({ id: student.id, avg: averageOf(termDefs(termKey, student.id)) }))
            .filter((item) => item.avg != null);
    }

    function previousTermKey(termKey) {
        const keys = termKeysSorted();
        const index = keys.indexOf(termKey);
        return index > 0 ? keys[index - 1] : '';
    }

    function subjectList(items) {
        return items.map((item) => `<span class="gv-stat-subject" title="${escapeHtml(item.subject.name)}">${escapeHtml(item.subject.key)}</span>`).join('');
    }

    function signed(value, digits = 1) {
        const rounded = Number(value.toFixed(digits));
        if (rounded === 0) return (0).toFixed(digits);
        return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
    }

    function deltaClass(value) {
        if (Math.abs(value) < 0.05) return 'gv-delta-same';
        return value > 0 ? 'gv-delta-up' : 'gv-delta-down';
    }

    function renderStats(studentId, termKey) {
        const defs = termKey && studentId ? termDefs(termKey, studentId) : [];
        if (!defs.length) {
            elements.stats.innerHTML = '';
            elements.stats.hidden = true;
            return;
        }
        elements.stats.hidden = false;
        const cards = [];
        const myAvg = averageOf(defs);

        // Highest / lowest subjects (ties listed together)
        const max = Math.max(...defs.map((item) => item.value));
        const min = Math.min(...defs.map((item) => item.value));
        cards.push(`
            <article class="gv-stat-card">
                <div class="gv-summary-label"><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i> Highest grade</div>
                <div class="gv-stat-headline"><span class="gv-stat-grade gv-tier-${getTier(max)}">${formatGrade(max)}</span></div>
                <div class="gv-stat-subjects">${subjectList(defs.filter((item) => item.value === max))}</div>
            </article>
            <article class="gv-stat-card">
                <div class="gv-summary-label"><i class="fa-solid fa-arrow-trend-down" aria-hidden="true"></i> Lowest grade</div>
                <div class="gv-stat-headline"><span class="gv-stat-grade gv-tier-${getTier(min)}">${formatGrade(min)}</span></div>
                <div class="gv-stat-subjects">${subjectList(defs.filter((item) => item.value === min))}</div>
            </article>
        `);

        // Subjects per tier
        const counts = Object.fromEntries(TIER_ORDER.map((tier) => [tier.key, 0]));
        defs.forEach((item) => { counts[getTier(item.value)] += 1; });
        const bar = TIER_ORDER
            .filter((tier) => counts[tier.key])
            .map((tier) => `<span class="gv-tier-bar-seg gv-tier-${tier.key}" style="flex-grow:${counts[tier.key]}" title="${tier.label}: ${counts[tier.key]}"></span>`)
            .join('');
        const rows = TIER_ORDER.map((tier) => `
            <li><span class="gv-chip gv-tier-${tier.key}">${tier.label}</span><strong>${counts[tier.key]}</strong></li>
        `).join('');
        cards.push(`
            <article class="gv-stat-card gv-stat-wide">
                <div class="gv-summary-label"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Subjects by level <span class="gv-stat-note">${defs.length} graded</span></div>
                <div class="gv-tier-bar" aria-hidden="true">${bar}</div>
                <ul class="gv-tier-counts">${rows}</ul>
            </article>
        `);

        // Position in the class group
        if (selectedStudentGroup) {
            const peers = groupAverages(selectedStudentGroup, termKey);
            if (peers.length > 1 && peers.some((item) => item.id === studentId)) {
                const position = 1 + peers.filter((item) => item.avg > myAvg + 1e-9).length;
                const tied = peers.filter((item) => Math.abs(item.avg - myAvg) <= 1e-9).length > 1;
                const groupAvg = peers.reduce((sum, item) => sum + item.avg, 0) / peers.length;
                const diff = myAvg - groupAvg;
                cards.push(`
                    <article class="gv-stat-card">
                        <div class="gv-summary-label"><i class="fa-solid fa-ranking-star" aria-hidden="true"></i> Position in ${escapeHtml(groupLabel(selectedStudentGroup))}</div>
                        <div class="gv-stat-headline">${position}<span class="gv-stat-of">/ ${peers.length}</span></div>
                        <div class="gv-stat-detail">${tied ? 'Tied · ' : ''}Group average ${groupAvg.toFixed(2)} · <span class="${deltaClass(diff)}">${signed(diff, 2)}</span></div>
                    </article>
                `);
            }
        }

        // Change since the previous term
        const prevKey = previousTermKey(termKey);
        const prevDefs = prevKey ? termDefs(prevKey, studentId) : [];
        if (prevDefs.length) {
            const prevAvg = averageOf(prevDefs);
            const diff = myAvg - prevAvg;
            const prevMap = Object.fromEntries(prevDefs.map((item) => [item.subject.key, item.value]));
            let up = 0;
            let down = 0;
            let same = 0;
            defs.forEach((item) => {
                const before = prevMap[item.subject.key];
                if (before == null) return;
                if (item.value > before) up += 1;
                else if (item.value < before) down += 1;
                else same += 1;
            });
            cards.push(`
                <article class="gv-stat-card">
                    <div class="gv-summary-label"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Since ${escapeHtml(data.terms[prevKey].label)}</div>
                    <div class="gv-stat-headline"><span class="${deltaClass(diff)}">${signed(diff, 2)}</span></div>
                    <div class="gv-stat-detail"><span class="gv-delta-up">▲ ${up}</span> · <span class="gv-delta-down">▼ ${down}</span> · <span class="gv-delta-same">■ ${same}</span> subjects</div>
                </article>
            `);
        }

        elements.stats.innerHTML = cards.join('');
    }

    function subjectMatchesFilter(tier, filter) {
        if (filter === 'all') return true;
        if (!tier) return false;
        if (filter === 'basico-below') return tier === 'basico' || tier === 'bajo';
        if (filter === 'alto-below') return tier === 'alto' || tier === 'basico' || tier === 'bajo';
        return tier === filter;
    }

    function scoreBlock(label, value, recValue) {
        const tier = getTier(value) || 'empty';
        const recTier = getTier(recValue);
        const recHtml = recValue == null
            ? ''
            : `<span class="gv-rec-value ${recTier ? `gv-tier-${recTier}` : ''}">Rec ${displayGrade(recValue)}</span>`;
        return `
            <div class="gv-score-block gv-tier-${tier}">
                <span class="gv-score-label">${escapeHtml(label)}</span>
                <span class="gv-score-value">${displayGrade(value)}</span>
                ${recHtml}
            </div>
        `;
    }

    const SUB_ROWS = SCORE_ROWS.filter((row) => row.key !== 'def');
    const DEF_ROW = SCORE_ROWS.find((row) => row.key === 'def');

    /** True when any S1–S3 grade (or its Rec) is filled in for this student in this term. */
    function termHasSubScores(termKey, studentId) {
        const subjects = studentGradesForTerm(termKey, studentId);
        return Object.values(subjects).some((entry) =>
            SUB_ROWS.some((row) => toScaleGrade(entry?.[row.key]) != null || toScaleGrade(entry?.[row.recKey]) != null)
        );
    }

    function compareCell(value, rec, extra = '', className = '') {
        const tier = getTier(value) || 'empty';
        const recHtml = rec == null ? '' : `<div class="gv-rec-value ${getTier(rec) ? `gv-tier-${getTier(rec)}` : ''}">Rec ${displayGrade(rec)}</div>`;
        return `<td class="gv-tier-${tier} ${className}"><strong>${displayGrade(value)}</strong>${recHtml}${extra}</td>`;
    }

    function renderComparison(studentId) {
        const termsWithData = termKeysSorted().filter((key) => {
            const subjects = data.terms[key]?.grades?.[studentId];
            if (!subjects) return false;
            return Object.values(subjects).some((entry) => GRADE_FIELDS.some((field) => toScaleGrade(entry?.[field]) != null));
        });
        if (!termsWithData.length) {
            elements.compareHost.innerHTML = '<div class="gv-empty-card"><h3>No term history yet</h3><p>Enter grades in Manage Grades to build a year-long comparison.</p></div>';
            return;
        }

        // Columns: one per term (plus S1–S3 only for terms that have them), then a Year column after each year's terms
        const columns = [];
        termsWithData.forEach((key, index) => {
            const year = parseTermKey(key).year;
            columns.push({ type: 'term', key, sub: termHasSubScores(key, studentId) });
            const nextYear = index + 1 < termsWithData.length ? parseTermKey(termsWithData[index + 1]).year : null;
            if (year && nextYear !== year) {
                columns.push({ type: 'year', year, keys: termsWithData.filter((k) => parseTermKey(k).year === year) });
            }
        });
        const anySub = columns.some((col) => col.sub);

        const headTop = columns.map((col) => {
            if (col.type === 'year') {
                return `<th class="gv-compare-year" ${anySub ? 'rowspan="2"' : ''} title="Average of the ${col.keys.length} term(s) entered for ${col.year}">Year ${col.year}</th>`;
            }
            const label = escapeHtml(data.terms[col.key].label);
            return col.sub ? `<th colspan="4">${label}</th>` : `<th ${anySub ? 'rowspan="2"' : ''}>${label}</th>`;
        }).join('');
        const headSub = anySub
            ? columns.filter((col) => col.sub).map(() => SCORE_ROWS.map((row) => `<th>${row.label}</th>`).join('')).join('')
            : '';

        const termDef = (key, subjectKey) => toScaleGrade(studentGradesForTerm(key, studentId)[subjectKey]?.def);
        const yearAverage = (keys, subjectKey) => {
            const values = keys.map((key) => termDef(key, subjectKey)).filter((value) => value != null);
            return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        };

        const rows = SUBJECTS.map((subject) => {
            const cells = columns.map((col) => {
                if (col.type === 'year') {
                    return compareCell(toScaleGrade(yearAverage(col.keys, subject.key)), null, '', 'gv-compare-year');
                }
                const entry = studentGradesForTerm(col.key, studentId)[subject.key] || emptySubjectGrades();
                const termIndex = termsWithData.indexOf(col.key);
                const trend = termIndex === 0 ? '' : trendMarkup(entry.def, termDef(termsWithData[termIndex - 1], subject.key));
                const subCells = col.sub ? SUB_ROWS.map((row) => compareCell(entry[row.key], entry[row.recKey])).join('') : '';
                return subCells + compareCell(entry.def, entry.recDef, trend);
            }).join('');
            return `<tr><th class="gv-compare-subject">${escapeHtml(subject.key)}</th>${cells}</tr>`;
        }).join('');

        // PROM row: average of the D grades in each term, and of the yearly averages
        const average = (values) => {
            const list = values.filter((value) => value != null);
            return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;
        };
        const promCell = (value, className = '') =>
            `<td class="gv-tier-${getAverageTier(value) || 'empty'} ${className}"><strong>${formatAverage(value)}</strong></td>`;
        const promCells = columns.map((col) => {
            if (col.type === 'year') {
                return promCell(average(SUBJECTS.map((subject) => yearAverage(col.keys, subject.key))), 'gv-compare-year');
            }
            const blanks = col.sub ? SUB_ROWS.map(() => '<td class="gv-tier-empty"></td>').join('') : '';
            return blanks + promCell(average(SUBJECTS.map((subject) => termDef(col.key, subject.key))));
        }).join('');

        elements.compareHost.innerHTML = `
            <table class="gv-compare-table">
                <thead>
                    <tr><th ${anySub ? 'rowspan="2"' : ''} class="gv-compare-subject">Subject</th>${headTop}</tr>
                    ${anySub ? `<tr>${headSub}</tr>` : ''}
                </thead>
                <tbody>${rows}</tbody>
                <tfoot><tr class="gv-compare-prom"><th class="gv-compare-subject">PROM</th>${promCells}</tr></tfoot>
            </table>
        `;
    }

    function trendMarkup(current, previous) {
        if (current == null || previous == null) return '';
        if (current > previous) return '<span class="gv-trend gv-trend-up" title="Up from previous term">▲</span>';
        if (current < previous) return '<span class="gv-trend gv-trend-down" title="Down from previous term">▼</span>';
        return '<span class="gv-trend gv-trend-same" title="Same as previous term">■</span>';
    }

    function visibleManageStudents() {
        if (manageGroupId === '__all__') return data.students.slice();
        if (manageGroupId === '__other__') {
            const rosterNames = new Set(ALL_ROSTER_STUDENTS.map((student) => normalizeLookup(student.name)));
            return data.students.filter((student) => !rosterNames.has(normalizeLookup(student.name)));
        }
        const group = CLASS_GROUP_LIST.find((item) => item.id === manageGroupId);
        const names = new Set((group?.students || ROSTER[manageGroupId] || []).map((name) => normalizeLookup(name)));
        return data.students.filter((student) => names.has(normalizeLookup(student.name)));
    }

    function addSelectedGroup() {
        if (manageGroupId === '__all__' || manageGroupId === '__other__') {
            showStatus('Choose a class group before adding it to the roster.', 'error');
            return;
        }
        const group = CLASS_GROUP_LIST.find((item) => item.id === manageGroupId);
        const names = group?.students || ROSTER[manageGroupId] || [];
        if (!names.length) {
            showStatus('That group has no roster names.', 'error');
            return;
        }
        let added = 0;
        names.forEach((name) => {
            const before = data.students.length;
            ensureStudent(name);
            if (data.students.length > before) added += 1;
        });
        persist();
        renderGrid();
        showStatus(added ? `Added ${added} student${added === 1 ? '' : 's'} from ${groupLabel(manageGroupId)}.` : 'All students from that group are already in the file.', 'success');
    }

    function addStudent(name, group) {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        const before = data.students.length;
        ensureStudent(trimmed);
        persist();
        elements.addStudentSearch.value = '';
        hideSuggestions(elements.addStudentSuggestions, elements.addStudentSearch);
        if (group) manageGroupId = group;
        elements.manageGroup.value = manageGroupId;
        renderGrid();
        showStatus(before === data.students.length ? `${trimmed} was already in the file.` : `Added ${trimmed}.`, 'success');
    }

    function removeStudent(studentId) {
        const student = data.students.find((item) => item.id === studentId);
        if (!student) return;
        if (!window.confirm(`Remove ${student.name} from the grade viewer? Their entered grades will also be deleted.`)) return;
        data.students = data.students.filter((item) => item.id !== studentId);
        Object.values(data.terms).forEach((term) => {
            delete term.grades[studentId];
        });
        persist();
        renderGrid();
        if (selectedStudentId === studentId) clearParentStudent();
        showStatus(`Removed ${student.name}.`, 'success');
    }

    function currentTerm() {
        if (!manageTermKey || !data.terms[manageTermKey]) return null;
        return data.terms[manageTermKey];
    }

    function ensureTermGrades(studentId, subjectKey) {
        const term = currentTerm();
        if (!term) return emptySubjectGrades();
        if (!term.grades[studentId]) term.grades[studentId] = {};
        if (!term.grades[studentId][subjectKey]) term.grades[studentId][subjectKey] = emptySubjectGrades();
        return term.grades[studentId][subjectKey];
    }

    function renderGrid() {
        const term = currentTerm();
        if (!term) {
            elements.gridHost.innerHTML = '<div class="gv-grid-empty"><h3>Create a term first</h3><p>Use New Term to add Período 1–4 for any year, then add a class group.</p></div>';
            return;
        }
        const students = visibleManageStudents();
        if (!students.length) {
            elements.gridHost.innerHTML = '<div class="gv-grid-empty"><h3>No students in this group</h3><p>Add the class group from the roster, or search for a student above.</p></div>';
            return;
        }

        const subjectHeads = SUBJECTS.map((subject) =>
            `<th colspan="2" title="${escapeHtml(subject.name)}">${escapeHtml(subject.key)}</th>`
        ).join('');
        const subHeads = SUBJECTS.map(() => '<th>Nota</th><th>Rec</th>').join('');
        const autoSub = students.some((student) => termHasSubScores(manageTermKey, student.id));
        const withSub = showSubRows == null ? autoSub : showSubRows;
        elements.showSubRows.checked = withSub;
        const gridRows = withSub ? SCORE_ROWS : [DEF_ROW];

        const body = students.map((student, studentIndex) => {
            const nameCell = `
                <th class="gv-student-cell" rowspan="${gridRows.length}">
                    ${escapeHtml(student.name)}
                    <button type="button" class="gv-remove-student" data-remove-student="${escapeHtml(student.id)}" title="Remove student" aria-label="Remove ${escapeHtml(student.name)}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </th>
            `;
            const band = studentIndex % 2 === 0 ? ' class="gv-band"' : '';
            return gridRows.map((row, rowIndex) => {
                const r = studentIndex * gridRows.length + rowIndex;
                const cells = SUBJECTS.flatMap((subject, subjectIndex) => {
                    const entry = term.grades[student.id]?.[subject.key] || emptySubjectGrades();
                    return [
                        gradeInput(student.id, subject.key, row.key, entry[row.key], r, subjectIndex * 2),
                        gradeInput(student.id, subject.key, row.recKey, entry[row.recKey], r, subjectIndex * 2 + 1)
                    ];
                }).join('');
                return `
                    <tr${band}>
                        ${rowIndex === 0 ? nameCell : ''}
                        <th class="gv-score-head">${escapeHtml(row.label)}</th>
                        ${cells}
                    </tr>
                `;
            }).join('');
        }).join('');

        elements.gridHost.innerHTML = `
            <table class="gv-grid" id="gv-grid">
                <thead>
                    <tr>
                        <th class="gv-corner" rowspan="2">Student</th>
                        <th class="gv-row-head" rowspan="2"></th>
                        ${subjectHeads}
                    </tr>
                    <tr>${subHeads}</tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    function gradeInput(studentId, subjectKey, field, value, row, col) {
        const display = formatGrade(value);
        const tier = getTier(value);
        const tierClass = tier ? `gv-tier-${tier}` : '';
        return `<td class="${tierClass}"><input class="gv-cell ${tierClass}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${escapeHtml(display)}" data-sid="${escapeHtml(studentId)}" data-subj="${escapeHtml(subjectKey)}" data-field="${escapeHtml(field)}" data-r="${row}" data-c="${col}" aria-label="${escapeHtml(subjectKey)} ${escapeHtml(field)}"></td>`;
    }

    function handleGridInput(event) {
        const input = event.target.closest('.gv-cell');
        if (!input) return;
        const parsed = parseGradeInput(input.value);
        applyCellAppearance(input, parsed.ok ? parsed.value : undefined, !parsed.ok && input.value.trim() !== '');
    }

    function handleGridFocusOut(event) {
        const input = event.target.closest('.gv-cell');
        if (!input) return;
        commitGridCell(input);
    }

    function commitGridCell(input) {
        const parsed = parseGradeInput(input.value);
        if (!parsed.ok) {
            applyCellAppearance(input, null, true);
            showStatus('Grades must be 1.0–5.0, or report values 10–50 (47 = 4.7). Blank is allowed.', 'error');
            return false;
        }
        const entry = ensureTermGrades(input.dataset.sid, input.dataset.subj);
        const previous = entry[input.dataset.field];
        entry[input.dataset.field] = parsed.value;
        input.value = formatGrade(parsed.value);
        applyCellAppearance(input, parsed.value, false);
        pruneEmptyStudentGrades(input.dataset.sid);
        if (previous !== parsed.value) {
            gridDirty = true;
            persist();
        }
        return true;
    }

    function pruneEmptyStudentGrades(studentId) {
        const term = currentTerm();
        if (!term?.grades[studentId]) return;
        Object.keys(term.grades[studentId]).forEach((subjectKey) => {
            const entry = term.grades[studentId][subjectKey];
            const hasValue = GRADE_FIELDS.some((field) => entry[field] != null);
            if (!hasValue) delete term.grades[studentId][subjectKey];
        });
        if (!Object.keys(term.grades[studentId]).length) delete term.grades[studentId];
    }

    function applyCellAppearance(input, value, invalid) {
        const td = input.parentElement;
        input.classList.remove('gv-invalid', 'gv-tier-superior', 'gv-tier-alto', 'gv-tier-basico', 'gv-tier-bajo');
        td.classList.remove('gv-tier-superior', 'gv-tier-alto', 'gv-tier-basico', 'gv-tier-bajo');
        if (invalid) {
            input.classList.add('gv-invalid');
            return;
        }
        const tier = getTier(value);
        if (tier) {
            input.classList.add(`gv-tier-${tier}`);
            td.classList.add(`gv-tier-${tier}`);
        }
    }

    function handleGridKeydown(event) {
        const input = event.target.closest('.gv-cell');
        if (!input) return;
        const key = event.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Home', 'End'].includes(key)) return;

        const row = Number(input.dataset.r);
        const col = Number(input.dataset.c);
        const cells = elements.gridHost.querySelectorAll('.gv-cell');
        const maxRow = cells.length ? Number(cells[cells.length - 1].dataset.r) : 0;
        const maxCol = SUBJECTS.length * 2 - 1;
        let nextRow = row;
        let nextCol = col;

        if (key === 'ArrowLeft' || (key === 'Tab' && event.shiftKey)) {
            event.preventDefault();
            if (col > 0) nextCol = col - 1;
            else if (row > 0) {
                nextRow = row - 1;
                nextCol = maxCol;
            }
        } else if (key === 'ArrowRight' || (key === 'Tab' && !event.shiftKey)) {
            event.preventDefault();
            if (col < maxCol) nextCol = col + 1;
            else if (row < maxRow) {
                nextRow = row + 1;
                nextCol = 0;
            }
        } else if (key === 'ArrowUp' || (key === 'Enter' && event.shiftKey)) {
            event.preventDefault();
            if (row > 0) nextRow = row - 1;
        } else if (key === 'ArrowDown' || (key === 'Enter' && !event.shiftKey)) {
            event.preventDefault();
            if (row < maxRow) nextRow = row + 1;
        } else if (key === 'Home') {
            event.preventDefault();
            nextCol = 0;
        } else if (key === 'End') {
            event.preventDefault();
            nextCol = maxCol;
        }

        if (nextRow === row && nextCol === col) return;
        if (!commitGridCell(input)) return;
        const next = elements.gridHost.querySelector(`[data-r="${nextRow}"][data-c="${nextCol}"]`);
        next?.focus();
    }

    function saveTermSession() {
        const active = document.activeElement;
        if (active?.classList.contains('gv-cell')) commitGridCell(active);
        if (!currentTerm()) {
            showStatus('Create a term before saving.', 'error');
            return;
        }
        if (persist("Term saved. Don't forget to export a backup.")) {
            gridDirty = false;
        }
    }

    function openTermModal() {
        elements.termYear.value = String(new Date().getFullYear());
        elements.termPeriod.value = '3';
        elements.termLabel.value = '';
        elements.termFormError.hidden = true;
        syncTermLabelPlaceholder();
        elements.termModal.hidden = false;
        document.body.classList.add('cc-modal-open');
        elements.termPeriod.focus();
    }

    function closeTermModal() {
        elements.termModal.hidden = true;
        document.body.classList.remove('cc-modal-open');
    }

    function defaultTermLabel(period, year) {
        return `Período ${period}, ${year}`;
    }

    function syncTermLabelPlaceholder() {
        const period = elements.termPeriod.value || '3';
        const year = elements.termYear.value || String(new Date().getFullYear());
        elements.termLabel.placeholder = defaultTermLabel(period, year);
    }

    function createTermFromForm(event) {
        event.preventDefault();
        const period = Number(elements.termPeriod.value);
        const year = Number(elements.termYear.value);
        if (![1, 2, 3, 4].includes(period) || !Number.isInteger(year) || year < 2000 || year > 2100) {
            elements.termFormError.textContent = 'Choose Período 1–4 and a valid year.';
            elements.termFormError.hidden = false;
            return;
        }
        const key = `P${period}-${year}`;
        if (data.terms[key]) {
            elements.termFormError.textContent = `${defaultTermLabel(period, year)} already exists.`;
            elements.termFormError.hidden = false;
            return;
        }
        const label = elements.termLabel.value.trim() || defaultTermLabel(period, year);
        data.terms[key] = { label, grades: {} };
        manageTermKey = key;
        parentTermKey = parentTermKey || key;
        persist(`Created ${label}.`);
        closeTermModal();
        populateTermSelects();
        renderGrid();
    }

    function deleteCurrentTerm() {
        const term = currentTerm();
        if (!term) {
            showStatus('There is no term to delete.', 'error');
            return;
        }
        if (!window.confirm(`Delete ${term.label}? All grades in this term will be removed.`)) return;
        delete data.terms[manageTermKey];
        manageTermKey = latestTermKey();
        if (parentTermKey && !data.terms[parentTermKey]) parentTermKey = latestTermKey();
        persist(`Deleted ${term.label}.`);
        populateTermSelects();
        renderGrid();
    }

    function exportGrades() {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = formatDateKey(new Date());
        link.href = url;
        link.download = `grade-viewer-backup-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showStatus('Grades exported.', 'success');
        gridDirty = false;
    }

    async function importGrades() {
        const [file] = elements.importInput.files;
        elements.importInput.value = '';
        if (!file) return;
        let parsed;
        try {
            parsed = JSON.parse(await file.text());
        } catch (error) {
            showStatus('Import failed: the selected file is not valid JSON.', 'error', false);
            return;
        }
        applyImportedData(parsed, 'Grades imported successfully.');
    }

    /**
     * Validate a backup (from a file or Google Drive), ask before replacing,
     * then load it. Returns true when the data was applied.
     */
    function applyImportedData(parsed, successMessage) {
        const validation = validateData(parsed);
        if (!validation.valid) {
            showStatus(`Import failed: ${validation.message}`, 'error', false);
            return false;
        }
        if (!window.confirm('Loading this file will replace all current grade viewer data on this device. Continue?')) {
            return false;
        }
        data = normalizeData(parsed);
        selectedStudentId = null;
        selectedStudentName = '';
        selectedStudentGroup = '';
        elements.studentSearch.value = '';
        hideSuggestions(elements.studentSuggestions, elements.studentSearch);
        parentTermKey = latestTermKey();
        manageTermKey = latestTermKey();
        persist(successMessage);
        populateTermSelects();
        if (currentView === 'manage') renderGrid();
        else renderParent();
        return true;
    }

    /* ---------- Google Drive (shared GoogleDriveService) ---------- */

    let driveService = null;

    function getDriveService() {
        if (driveService || !window.GoogleDriveService) return driveService;
        driveService = new window.GoogleDriveService({
            folderName: 'ESL Platform Grade Viewer',
            fileExtension: '.json',
            onSave: () => {
                // Keep any cell still being typed in before uploading
                const active = document.activeElement;
                if (active?.classList?.contains('gv-cell')) commitGridCell(active);
                return data;
            },
            onLoad: (loaded) => {
                applyImportedData(loaded, 'Grades loaded from Google Drive.');
            },
            onNotify: (message, type) => showStatus(message, type === 'error' ? 'error' : 'success')
        });
        return driveService;
    }

    async function openDrive() {
        const service = getDriveService();
        if (!service) {
            showStatus('Google Drive could not be loaded. Check your connection and reload the page.', 'error', false);
            return;
        }
        await service.openModal();
        const nameInput = document.getElementById('gds-filename');
        if (nameInput && !nameInput.value) nameInput.value = `grade-viewer-${formatDateKey(new Date())}`;
    }

    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function showStatus(message, type = 'info', autoHide = true) {
        window.clearTimeout(statusTimer);
        elements.status.textContent = message;
        elements.status.className = `cc-status cc-status-${type}`;
        elements.status.hidden = false;
        if (autoHide) {
            statusTimer = window.setTimeout(() => {
                elements.status.hidden = true;
            }, 4500);
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
})();
