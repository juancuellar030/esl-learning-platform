/**
 * Grading Scale Generator — Multi-Column Edition
 * Supports multiple CSV score columns, each with its own named scale.
 */
(function () {
    'use strict';

    // ===== STATE =====
    let scaleData = [];          // Preview scale table data
    let students = [];           // [{ name, rawScores:{label:val}, grades:{label:val} }]
    let savedScales = [];        // [{ id, name, pmax, exig, nmin, nmax, napr, increment }]
    let columnConfigs = [];      // [{ label, colIndex, scaleId }]
    let scaleGenerated = false;
    let currentSort = { column: null, direction: 'asc' };

    // ===== DOM REFS =====
    const $ = id => document.getElementById(id);

    // ===== HELPERS =====
    function uid() { return 'scale_' + Math.random().toString(36).substr(2, 9); }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== GOOGLE DRIVE =====
    const driveService = new window.GoogleDriveService({
        folderName: 'ESL Platform Custom Scales',
        fileExtension: '.json',
        onSave: () => ({
            pmax: parseFloat($('gs-pmax').value) || 100,
            exig: parseFloat($('gs-exig').value) || 60,
            nmin: parseFloat($('gs-nmin').value) || 1.0,
            nmax: parseFloat($('gs-nmax').value) || 7.0,
            napr: parseFloat($('gs-napr').value) || 4.0,
            increment: parseFloat($('gs-increment').value) || 1.0,
            savedScales
        }),
        onLoad: (data) => {
            if (data.pmax !== undefined) $('gs-pmax').value = data.pmax;
            if (data.exig !== undefined) $('gs-exig').value = data.exig;
            if (data.nmin !== undefined) $('gs-nmin').value = data.nmin;
            if (data.nmax !== undefined) $('gs-nmax').value = data.nmax;
            if (data.napr !== undefined) $('gs-napr').value = data.napr;
            if (data.increment !== undefined) $('gs-increment').value = data.increment;
            if (Array.isArray(data.savedScales)) savedScales = data.savedScales;
            generateScale();
            renderSavedScales();
            renderColumnAssignment();
        },
        onNotify: (msg, type) => showToast(msg, type)
    });

    // ===== GRADING FORMULA =====
    /**
     * Calculates a grade using piecewise linear interpolation.
     * Below passing threshold: linear from nmin to napr
     * Above passing threshold: linear from napr to nmax
     */
    function calculateGrade(score, pmax, exig, nmin, nmax, napr) {
        if (score <= 0) return nmin;
        if (score >= pmax) return nmax;
        const passingScore = (exig / 100) * pmax;
        let grade;
        if (score < passingScore) {
            grade = nmin + ((napr - nmin) * score) / passingScore;
        } else {
            grade = napr + ((nmax - napr) * (score - passingScore)) / (pmax - passingScore);
        }
        const truncated = Math.floor(grade * 100) / 100;
        const centesima = Math.round((truncated * 100) % 10);
        if (centesima >= 5) return Math.ceil(truncated * 10) / 10;
        return Math.floor(truncated * 10) / 10;
    }

    // ===== SCALE PARAMS HELPERS =====
    function getGlobalScaleParams() {
        return {
            pmax: parseFloat($('gs-pmax').value) || 100,
            exig: parseFloat($('gs-exig').value) || 60,
            nmin: parseFloat($('gs-nmin').value) || 1.0,
            nmax: parseFloat($('gs-nmax').value) || 7.0,
            napr: parseFloat($('gs-napr').value) || 4.0,
        };
    }

    function getScaleParams(scaleId) {
        if (!scaleId || scaleId === 'global') return getGlobalScaleParams();
        return savedScales.find(s => s.id === scaleId) || getGlobalScaleParams();
    }

    // ===== SAVED SCALES =====
    function saveNamedScale() {
        const pmax = parseFloat($('gs-pmax').value);
        const exig = parseFloat($('gs-exig').value);
        const nmin = parseFloat($('gs-nmin').value);
        const nmax = parseFloat($('gs-nmax').value);
        const napr = parseFloat($('gs-napr').value);
        const increment = parseFloat($('gs-increment').value);

        if (isNaN(pmax) || pmax <= 0) return showToast('Max score must be > 0', 'error');
        if (isNaN(exig) || exig < 1 || exig > 100) return showToast('Exigency must be 1–100', 'error');
        if (isNaN(nmin) || isNaN(nmax) || nmin >= nmax) return showToast('Min grade must be < max grade', 'error');
        if (isNaN(napr) || napr <= nmin || napr >= nmax) return showToast('Passing grade must be between min and max', 'error');

        const name = prompt('Name this scale (e.g. "Reading 20pts", "Listening 30pts"):');
        if (!name || !name.trim()) return;

        savedScales.push({ id: uid(), name: name.trim(), pmax, exig, nmin, nmax, napr, increment });
        renderSavedScales();
        renderColumnAssignment();
        showToast(`Scale "${name.trim()}" saved!`, 'success');
    }

    function deleteScale(id) {
        savedScales = savedScales.filter(s => s.id !== id);
        // Reset any column using this scale back to global
        columnConfigs.forEach(c => { if (c.scaleId === id) c.scaleId = 'global'; });
        renderSavedScales();
        renderColumnAssignment();
        updateStudentGrades();
        showToast('Scale deleted', 'info');
    }

    function renderSavedScales() {
        const container = $('gs-saved-scales-list');
        if (!container) return;
        if (!savedScales.length) {
            container.innerHTML = `<div class="gs-saved-scales-empty">No named scales yet. Configure above and click <strong>Save as Named Scale</strong> to create one.</div>`;
            return;
        }
        container.innerHTML = savedScales.map(sc => `
            <div class="gs-scale-card">
                <div class="gs-scale-card-info">
                    <div class="gs-scale-card-name">${escapeHtml(sc.name)}</div>
                    <div class="gs-scale-card-params">
                        <span>Max: <strong>${sc.pmax}</strong></span>
                        <span>Exig: <strong>${sc.exig}%</strong></span>
                        <span>Pass ≥ <strong>${sc.napr}</strong></span>
                        <span>Range: <strong>${sc.nmin}–${sc.nmax}</strong></span>
                    </div>
                </div>
                <button class="gs-scale-card-delete" data-id="${sc.id}" title="Delete scale">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `).join('');
        container.querySelectorAll('.gs-scale-card-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteScale(btn.dataset.id));
        });
    }

    // ===== GENERATE SCALE (global preview) =====
    function generateScale() {
        const pmax = parseFloat($('gs-pmax').value);
        const exig = parseFloat($('gs-exig').value);
        const nmin = parseFloat($('gs-nmin').value);
        const nmax = parseFloat($('gs-nmax').value);
        const napr = parseFloat($('gs-napr').value);
        const increment = parseFloat($('gs-increment').value);

        if (isNaN(pmax) || pmax <= 0) return showToast('Max score must be greater than 0', 'error');
        if (isNaN(exig) || exig < 1 || exig > 100) return showToast('Exigency must be between 1 and 100', 'error');
        if (isNaN(nmin) || isNaN(nmax) || nmin >= nmax) return showToast('Min grade must be less than max grade', 'error');
        if (isNaN(napr) || napr <= nmin || napr >= nmax) return showToast('Passing grade must be between min and max grade', 'error');

        scaleData = [];
        for (let s = 0; s <= pmax; s = +(s + increment).toFixed(2)) {
            scaleData.push({ score: s, grade: calculateGrade(s, pmax, exig, nmin, nmax, napr) });
        }
        const lastScore = scaleData.length > 0 ? scaleData[scaleData.length - 1].score : -1;
        if (Math.abs(lastScore - pmax) > 0.001) {
            scaleData.push({ score: pmax, grade: calculateGrade(pmax, pmax, exig, nmin, nmax, napr) });
        }

        renderScaleTable(napr);
        scaleGenerated = true;
        updateStudentGrades();
        showToast('Scale generated successfully!', 'success');
    }

    // ===== RENDER SCALE TABLE =====
    function renderScaleTable(napr) {
        const container = $('gs-scale-body');
        if (!scaleData.length) {
            container.innerHTML = `
                <div class="gs-empty-state">
                    <i class="fa-solid fa-chart-line"></i>
                    <p>No scale generated yet</p>
                    <span class="gs-empty-hint">Configure settings above and click Generate Scale</span>
                </div>`;
            return;
        }
        let html = `<div class="gs-scale-wrapper"><table class="gs-scale-table">
            <thead><tr><th>Score</th><th>Grade</th></tr></thead><tbody>`;
        scaleData.forEach(row => {
            const isPassing = row.grade >= napr;
            const isWarning = isPassing && row.grade <= napr + 0.2;
            const rowClass = isWarning ? 'gs-warning-row' : (isPassing ? 'gs-passing-row' : 'gs-failing-row');
            const badgeClass = isWarning ? 'gs-grade-warn' : (isPassing ? 'gs-grade-pass' : 'gs-grade-fail');
            html += `<tr class="${rowClass}">
                <td>${row.score.toFixed(1)}</td>
                <td><span class="gs-grade-badge ${badgeClass}">${row.grade.toFixed(1)}</span></td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    // ===== CSV PARSING =====
    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return null;

        const firstLine = lines[0];
        const sep = firstLine.includes(';') ? ';' : ',';
        const splitLine = line => line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));

        const firstCells = splitLine(firstLine);

        // Detect header: any cell matches common header keywords
        const looksLikeHeader = firstCells.some(c =>
            /^(name|nombre|student|alumno|estudiante|#|n°|nro|score|puntaje|puntos|nota|reading|listening|writing|speaking|grammar|vocab|vocabulary|total|test|quiz|exam|column|col)/i.test(c)
        );

        let headerRow = null;
        let nameIndex = 0;
        if (looksLikeHeader) {
            headerRow = firstCells;
            nameIndex = firstCells.findIndex(c => /^(name|nombre|student|alumno|estudiante)/i.test(c));
            if (nameIndex === -1) nameIndex = 0;
        }

        const startIndex = looksLikeHeader ? 1 : 0;
        const dataRows = lines.slice(startIndex)
            .map(splitLine)
            .filter(cells => cells.length > 0 && cells[nameIndex] && cells[nameIndex].trim());

        if (!dataRows.length) return null;

        // Detect numeric score columns
        const numCols = Math.max(...dataRows.map(r => r.length));
        const scoreColumns = [];
        for (let i = 0; i < numCols; i++) {
            if (i === nameIndex) continue;
            const vals = dataRows.map(r => (r[i] || '').trim().replace(',', '.')).filter(v => v !== '');
            if (!vals.length) continue;
            const numericCount = vals.filter(v => !isNaN(parseFloat(v))).length;
            if (numericCount / vals.length >= 0.5) {
                const label = headerRow ? (headerRow[i] || `Column ${i + 1}`) : `Column ${i + 1}`;
                scoreColumns.push({ index: i, label });
            }
        }

        if (!scoreColumns.length) return null;

        const rows = dataRows.map(cells => {
            const rawScores = {};
            scoreColumns.forEach(col => {
                const raw = (cells[col.index] || '').trim().replace(',', '.');
                const parsed = parseFloat(raw);
                rawScores[col.label] = isNaN(parsed) ? null : parsed;
            });
            return { name: cells[nameIndex], rawScores, grades: {} };
        });

        return { scoreColumns, rows };
    }

    // ===== CSV UPLOAD =====
    function handleCSVUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = ''; // reset so re-upload of same file works

        const reader = new FileReader();
        reader.onload = function (evt) {
            const result = parseCSV(evt.target.result);
            if (!result || !result.rows.length) {
                showToast('No valid student data found in the file', 'error');
                return;
            }

            students = result.rows;
            columnConfigs = result.scoreColumns.map(col => ({
                label: col.label,
                colIndex: col.index,
                scaleId: 'global'
            }));

            const colCount = result.scoreColumns.length;
            $('gs-file-info').textContent =
                `${file.name} — ${students.length} student(s), ${colCount} score column(s)`;

            renderColumnAssignment();
            renderStudentsTable();
            showToast(
                `${students.length} students loaded (${colCount} score column${colCount > 1 ? 's' : ''})`,
                'success'
            );
        };
        reader.readAsText(file);
    }

    // ===== COLUMN ASSIGNMENT PANEL =====
    function renderColumnAssignment() {
        const section = $('gs-col-assignment-section');
        const container = $('gs-col-assignment-body');
        if (!section || !container) return;

        // Only show panel when there are 2+ score columns
        if (columnConfigs.length < 2) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const globalOption = `<option value="global">— Global Scale —</option>`;
        const savedOptions = savedScales.map(sc =>
            `<option value="${sc.id}">${escapeHtml(sc.name)} (max ${sc.pmax}, pass ${sc.napr})</option>`
        ).join('');

        let html = `<div class="gs-col-assignment-grid">
            <div class="gs-col-assignment-header">
                <span><i class="fa-solid fa-table-columns"></i> Score Column</span>
                <span><i class="fa-solid fa-sliders"></i> Scale to Apply</span>
            </div>`;

        columnConfigs.forEach((cfg, i) => {
            const opts = `${globalOption}${savedOptions}`;
            html += `
            <div class="gs-col-assignment-row">
                <span class="gs-col-name-badge">
                    <i class="fa-solid fa-hashtag"></i> ${escapeHtml(cfg.label)}
                </span>
                <select class="gs-col-scale-select" data-index="${i}">
                    ${opts}
                </select>
            </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;

        // Set current selections + bind change events
        container.querySelectorAll('.gs-col-scale-select').forEach(sel => {
            const idx = parseInt(sel.dataset.index);
            sel.value = columnConfigs[idx].scaleId || 'global';
            sel.addEventListener('change', () => {
                columnConfigs[idx].scaleId = sel.value;
                updateStudentGrades();
            });
        });
    }

    // ===== RENDER STUDENTS TABLE =====
    function renderStudentsTable() {
        const container = $('gs-students-body');
        if (!students.length) {
            container.innerHTML = `
                <div class="gs-empty-state">
                    <i class="fa-solid fa-users"></i>
                    <p>No students loaded</p>
                    <span class="gs-empty-hint">Upload a CSV file with student names and scores to get started</span>
                </div>`;
            $('gs-summary-bar').style.display = 'none';
            return;
        }

        const isMulti = columnConfigs.length > 1;

        const getSortIcon = col => {
            if (currentSort.column !== col) return '<i class="fa-solid fa-sort"></i>';
            return currentSort.direction === 'asc'
                ? '<i class="fa-solid fa-sort-up"></i>'
                : '<i class="fa-solid fa-sort-down"></i>';
        };

        // ---- Build table header ----
        let thead = `<th>#</th>
            <th class="gs-sortable ${currentSort.column === 'name' ? 'active' : ''}" data-sort="name">
                Student Name ${getSortIcon('name')}
            </th>`;

        if (isMulti) {
            columnConfigs.forEach(cfg => {
                const sp = getScaleParams(cfg.scaleId);
                thead += `
                    <th class="gs-col-score-header">${escapeHtml(cfg.label)}<br><small>Score /${sp.pmax}</small></th>
                    <th class="gs-col-grade-header">${escapeHtml(cfg.label)}<br><small>Grade</small></th>`;
            });
        } else if (columnConfigs.length === 1) {
            thead += `
                <th class="gs-sortable ${currentSort.column === 'score' ? 'active' : ''}" data-sort="score">
                    Score ${getSortIcon('score')}
                </th>
                <th class="gs-sortable ${currentSort.column === 'grade' ? 'active' : ''}" data-sort="grade">
                    Grade ${getSortIcon('grade')}
                </th>
                <th>Status</th>`;
        } else {
            thead += `<th>Score</th><th>Grade</th><th>Status</th>`;
        }

        // ---- Build table rows ----
        let tbody = '';
        students.forEach((s, i) => {
            let cells = `
                <td style="text-align:center;color:#999;font-weight:600;">${i + 1}</td>
                <td class="gs-student-name">${escapeHtml(s.name)}</td>`;

            if (isMulti) {
                columnConfigs.forEach(cfg => {
                    const rawScore = s.rawScores[cfg.label];
                    const grade = s.grades[cfg.label];
                    const sp = getScaleParams(cfg.scaleId);
                    const napr = sp.napr;

                    let badgeClass = '';
                    if (grade !== undefined && grade !== null) {
                        if (grade >= napr) {
                            badgeClass = grade <= napr + 0.2 ? 'gs-grade-warn' : 'gs-grade-pass';
                        } else {
                            badgeClass = 'gs-grade-fail';
                        }
                    }
                    const scoreVal = (rawScore !== null && rawScore !== undefined) ? rawScore : '';
                    const gradeDisplay = (grade !== undefined && grade !== null) ? grade.toFixed(1) : '—';

                    cells += `
                        <td>
                            <input type="number" class="gs-score-input"
                                data-index="${i}" data-col="${escapeHtml(cfg.label)}"
                                value="${scoreVal}" min="0" step="0.1" placeholder="—" />
                        </td>
                        <td class="gs-grade-cell">
                            <span class="gs-grade-badge ${badgeClass}">${gradeDisplay}</span>
                        </td>`;
                });
            } else if (columnConfigs.length === 1) {
                const cfg = columnConfigs[0];
                const rawScore = s.rawScores[cfg.label];
                const grade = s.grades[cfg.label];
                const sp = getScaleParams(cfg.scaleId);
                const napr = sp.napr;

                let gradeClass = '', statusHtml = '';
                if (grade !== undefined && grade !== null) {
                    if (grade >= napr) {
                        if (grade <= napr + 0.2) {
                            gradeClass = 'gs-grade-warn';
                            statusHtml = '<span class="gs-status-badge gs-status-warn">WARN</span>';
                        } else {
                            gradeClass = 'gs-grade-pass';
                            statusHtml = '<span class="gs-status-badge gs-status-pass">PASS</span>';
                        }
                    } else {
                        gradeClass = 'gs-grade-fail';
                        statusHtml = '<span class="gs-status-badge gs-status-fail">FAIL</span>';
                    }
                }
                const scoreVal = (rawScore !== null && rawScore !== undefined) ? rawScore : '';
                const gradeDisplay = (grade !== undefined && grade !== null) ? grade.toFixed(1) : '—';

                cells += `
                    <td>
                        <input type="number" class="gs-score-input"
                            data-index="${i}" data-col="${escapeHtml(cfg.label)}"
                            value="${scoreVal}" min="0" step="0.1" placeholder="—" />
                    </td>
                    <td class="gs-grade-cell">
                        <span class="gs-grade-badge ${gradeClass}">${gradeDisplay}</span>
                    </td>
                    <td class="gs-status-cell">${statusHtml}</td>`;
            }

            tbody += `<tr>${cells}</tr>`;
        });

        const html = `
        <div class="gs-students-wrapper">
            <table class="gs-students-table">
                <thead><tr>${thead}</tr></thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>`;
        container.innerHTML = html;

        // Bind score inputs
        container.querySelectorAll('.gs-score-input').forEach(input => {
            input.addEventListener('change', onScoreChange);
            input.addEventListener('input', onScoreChange);
        });

        // Bind sort headers
        container.querySelectorAll('.gs-sortable').forEach(th => {
            th.addEventListener('click', () => sortStudents(th.dataset.sort));
        });

        updateSummary();
    }

    function onScoreChange(e) {
        const idx = parseInt(e.target.dataset.index);
        const colLabel = e.target.dataset.col;
        const val = e.target.value;
        const numVal = parseFloat(val);

        students[idx].rawScores[colLabel] = val === '' ? null : (isNaN(numVal) ? null : numVal);

        if (val !== '' && !isNaN(numVal)) {
            const cfg = columnConfigs.find(c => c.label === colLabel);
            if (cfg) {
                const sp = getScaleParams(cfg.scaleId);
                students[idx].grades[colLabel] = calculateGrade(numVal, sp.pmax, sp.exig, sp.nmin, sp.nmax, sp.napr);
                renderStudentsTable();
            }
        }
    }

    function sortStudents(column) {
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        students.sort((a, b) => {
            let valA, valB;
            if (column === 'name') {
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
            } else if (column === 'score' && columnConfigs.length === 1) {
                const lbl = columnConfigs[0].label;
                valA = a.rawScores[lbl] !== null && a.rawScores[lbl] !== undefined ? parseFloat(a.rawScores[lbl]) : -1;
                valB = b.rawScores[lbl] !== null && b.rawScores[lbl] !== undefined ? parseFloat(b.rawScores[lbl]) : -1;
            } else if (column === 'grade' && columnConfigs.length === 1) {
                const lbl = columnConfigs[0].label;
                valA = (a.grades[lbl] !== undefined && a.grades[lbl] !== null) ? a.grades[lbl] : -1;
                valB = (b.grades[lbl] !== undefined && b.grades[lbl] !== null) ? b.grades[lbl] : -1;
            } else {
                return 0;
            }
            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        renderStudentsTable();
    }

    // ===== CALCULATE ALL GRADES =====
    function calculateAllGrades() {
        if (!students.length) {
            showToast('No students loaded. Upload a CSV file first.', 'error');
            return;
        }
        if (!columnConfigs.length) {
            showToast('No score columns detected. Check your CSV format.', 'error');
            return;
        }

        let calculatedCount = 0;
        students.forEach(s => {
            columnConfigs.forEach(cfg => {
                const score = s.rawScores[cfg.label];
                if (score !== null && score !== undefined && !isNaN(score)) {
                    const sp = getScaleParams(cfg.scaleId);
                    s.grades[cfg.label] = calculateGrade(score, sp.pmax, sp.exig, sp.nmin, sp.nmax, sp.napr);
                    calculatedCount++;
                }
            });
        });

        renderStudentsTable();
        const msg = columnConfigs.length > 1
            ? `Grades calculated for ${students.length} students across ${columnConfigs.length} columns`
            : `Grades calculated for ${calculatedCount} student(s)`;
        showToast(msg, 'success');
    }

    // ===== AUTO-UPDATE GRADES (after scale change) =====
    function updateStudentGrades() {
        if (!students.length || !columnConfigs.length) return;
        students.forEach(s => {
            columnConfigs.forEach(cfg => {
                const score = s.rawScores[cfg.label];
                if (score !== null && score !== undefined && !isNaN(score)) {
                    const sp = getScaleParams(cfg.scaleId);
                    s.grades[cfg.label] = calculateGrade(score, sp.pmax, sp.exig, sp.nmin, sp.nmax, sp.napr);
                }
            });
        });
        renderStudentsTable();
    }

    // ===== SUMMARY BAR =====
    function updateSummary() {
        const bar = $('gs-summary-bar');
        if (!students.length || !columnConfigs.length) {
            bar.style.display = 'none';
            return;
        }

        const hasGrades = students.some(s =>
            columnConfigs.some(cfg => s.grades[cfg.label] !== undefined && s.grades[cfg.label] !== null)
        );
        if (!hasGrades) { bar.style.display = 'none'; return; }

        const isMulti = columnConfigs.length > 1;
        bar.style.display = 'flex';
        bar.style.flexWrap = 'wrap';

        if (isMulti) {
            // Per-column groups
            let html = '';
            columnConfigs.forEach(cfg => {
                const sp = getScaleParams(cfg.scaleId);
                const napr = sp.napr;
                const graded = students.filter(s =>
                    s.grades[cfg.label] !== undefined && s.grades[cfg.label] !== null
                );
                if (!graded.length) return;
                const passing = graded.filter(s => s.grades[cfg.label] >= napr).length;
                const failing = graded.length - passing;
                const avg = graded.reduce((sum, s) => sum + s.grades[cfg.label], 0) / graded.length;

                html += `
                <div class="gs-col-stat-group">
                    <div class="gs-col-stat-label">
                        <i class="fa-solid fa-table-columns"></i> ${escapeHtml(cfg.label)}
                    </div>
                    <div class="gs-col-stat-cards">
                        <div class="gs-stat-card gs-stat-pass">
                            <i class="fa-solid fa-circle-check"></i>
                            <div>
                                <div class="gs-stat-value">${passing}</div>
                                <div class="gs-stat-label">Pass</div>
                            </div>
                        </div>
                        <div class="gs-stat-card gs-stat-fail">
                            <i class="fa-solid fa-circle-xmark"></i>
                            <div>
                                <div class="gs-stat-value">${failing}</div>
                                <div class="gs-stat-label">Fail</div>
                            </div>
                        </div>
                        <div class="gs-stat-card gs-stat-avg">
                            <i class="fa-solid fa-chart-simple"></i>
                            <div>
                                <div class="gs-stat-value">${avg.toFixed(1)}</div>
                                <div class="gs-stat-label">Avg</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
            bar.innerHTML = html;
        } else {
            // Single-column: original summary layout
            const cfg = columnConfigs[0];
            const sp = getScaleParams(cfg.scaleId);
            const napr = sp.napr;
            const graded = students.filter(s =>
                s.grades[cfg.label] !== undefined && s.grades[cfg.label] !== null
            );
            if (!graded.length) { bar.style.display = 'none'; return; }
            const passing = graded.filter(s => s.grades[cfg.label] >= napr).length;
            const failing = graded.length - passing;
            const avg = graded.reduce((sum, s) => sum + s.grades[cfg.label], 0) / graded.length;

            bar.innerHTML = `
                <div class="gs-stat-card gs-stat-total">
                    <i class="fa-solid fa-users"></i>
                    <div><div class="gs-stat-value">${graded.length}</div><div class="gs-stat-label">Graded</div></div>
                </div>
                <div class="gs-stat-card gs-stat-pass">
                    <i class="fa-solid fa-circle-check"></i>
                    <div><div class="gs-stat-value">${passing}</div><div class="gs-stat-label">Passing</div></div>
                </div>
                <div class="gs-stat-card gs-stat-fail">
                    <i class="fa-solid fa-circle-xmark"></i>
                    <div><div class="gs-stat-value">${failing}</div><div class="gs-stat-label">Failing</div></div>
                </div>
                <div class="gs-stat-card gs-stat-avg">
                    <i class="fa-solid fa-chart-simple"></i>
                    <div><div class="gs-stat-value">${avg.toFixed(1)}</div><div class="gs-stat-label">Average</div></div>
                </div>`;
        }
    }

    // ===== CSV EXPORT =====
    function exportCSV() {
        if (!students.length) {
            showToast('No students to export', 'error');
            return;
        }

        const colHeaders = columnConfigs.flatMap(cfg => [`"${cfg.label} Score"`, `"${cfg.label} Grade"`]);
        let csv = `Name,${colHeaders.join(',')},Status\n`;

        students.forEach(s => {
            const cols = columnConfigs.flatMap(cfg => {
                const score = s.rawScores[cfg.label];
                const grade = s.grades[cfg.label];
                return [
                    (score !== null && score !== undefined) ? score : '',
                    (grade !== undefined && grade !== null) ? grade.toFixed(1) : ''
                ];
            });

            // Overall status: any FAIL → FAIL, any WARN (no FAIL) → WARN, all PASS → PASS
            const statuses = columnConfigs.map(cfg => {
                const g = s.grades[cfg.label];
                const napr = getScaleParams(cfg.scaleId).napr;
                if (g === undefined || g === null) return 'UNKNOWN';
                if (g >= napr) return g <= napr + 0.2 ? 'WARN' : 'PASS';
                return 'FAIL';
            }).filter(st => st !== 'UNKNOWN');

            let status = '';
            if (statuses.length) {
                if (statuses.includes('FAIL')) status = 'FAIL';
                else if (statuses.includes('WARN')) status = 'WARN';
                else status = 'PASS';
            }

            csv += `"${s.name.replace(/"/g, '""')}",${cols.join(',')},${status}\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'student_grades.csv';
        link.click();
        URL.revokeObjectURL(url);
        showToast('CSV exported successfully!', 'success');
    }

    // ===== TOAST =====
    function showToast(msg, type = 'info') {
        const existing = document.querySelector('.gs-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `gs-toast ${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
    }

    // ===== INIT =====
    function init() {
        $('gs-generate-btn').addEventListener('click', generateScale);
        $('gs-save-scale-btn').addEventListener('click', saveNamedScale);
        $('gs-drive-btn').addEventListener('click', () => driveService.openModal());
        $('gs-csv-input').addEventListener('change', handleCSVUpload);
        $('gs-upload-btn').addEventListener('click', () => $('gs-csv-input').click());
        $('gs-calc-btn').addEventListener('click', calculateAllGrades);
        $('gs-export-btn').addEventListener('click', exportCSV);

        renderScaleTable(4.0);
        renderStudentsTable();
        renderSavedScales();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
