/**
 * Grading Scale Generator
 * Implements a piecewise linear grading scale similar to escaladenotas.cl
 * with CSV upload/export for student grade calculation.
 */
(function () {
    'use strict';

    // ===== STATE =====
    let scaleData = [];
    let students = [];
    let scaleGenerated = false;

    // ===== DOM REFS =====
    const $ = id => document.getElementById(id);

    // ===== GOOGLE DRIVE =====
    const driveService = new window.GoogleDriveService({
        folderName: 'ESL Platform Custom Scales',
        fileExtension: '.json',
        onSave: () => {
            return {
                pmax: parseFloat($('gs-pmax').value) || 100,
                exig: parseFloat($('gs-exig').value) || 60,
                nmin: parseFloat($('gs-nmin').value) || 1.0,
                nmax: parseFloat($('gs-nmax').value) || 7.0,
                napr: parseFloat($('gs-napr').value) || 4.0,
                increment: parseFloat($('gs-increment').value) || 1.0
            };
        },
        onLoad: (data) => {
            if (data.pmax !== undefined) $('gs-pmax').value = data.pmax;
            if (data.exig !== undefined) $('gs-exig').value = data.exig;
            if (data.nmin !== undefined) $('gs-nmin').value = data.nmin;
            if (data.nmax !== undefined) $('gs-nmax').value = data.nmax;
            if (data.napr !== undefined) $('gs-napr').value = data.napr;
            if (data.increment !== undefined) $('gs-increment').value = data.increment;

            // Auto-generate the scale from the loaded config
            generateScale();
        },
        onNotify: (msg, type) => showToast(msg, type)
    });

    // ===== GRADING FORMULA =====
    /**
     * Calculates a grade using a piecewise linear scale.
     * Below the passing threshold: linear from nmin to napr
     * Above the passing threshold: linear from napr to nmax
     *
     * @param {number} score     Student's score
     * @param {number} pmax     Maximum possible score
     * @param {number} exig     Exigency percentage (0-100)
     * @param {number} nmin     Minimum grade
     * @param {number} nmax     Maximum grade
     * @param {number} napr     Passing grade
     * @returns {number}        Calculated grade (rounded to 1 decimal)
     */
    function calculateGrade(score, pmax, exig, nmin, nmax, napr) {
        if (score <= 0) return nmin;
        if (score >= pmax) return nmax;

        const passingScore = (exig / 100) * pmax;

        let grade;
        if (score < passingScore) {
            // Linear interpolation from nmin to napr
            grade = nmin + ((napr - nmin) * score) / passingScore;
        } else {
            // Linear interpolation from napr to nmax
            grade = napr + ((nmax - napr) * (score - passingScore)) / (pmax - passingScore);
        }

        // Round: truncate to 2 decimals, then round up if centésima >= 5
        const truncated = Math.floor(grade * 100) / 100;
        const centesima = Math.round((truncated * 100) % 10);
        if (centesima >= 5) {
            return Math.ceil(truncated * 10) / 10;
        }
        return Math.floor(truncated * 10) / 10;
    }

    // ===== GENERATE SCALE =====
    function generateScale() {
        const pmax = parseFloat($('gs-pmax').value);
        const exig = parseFloat($('gs-exig').value);
        const nmin = parseFloat($('gs-nmin').value);
        const nmax = parseFloat($('gs-nmax').value);
        const napr = parseFloat($('gs-napr').value);
        const increment = parseFloat($('gs-increment').value);

        // Validate
        if (isNaN(pmax) || pmax <= 0) return showToast('Max score must be greater than 0', 'error');
        if (isNaN(exig) || exig < 1 || exig > 100) return showToast('Exigency must be between 1 and 100', 'error');
        if (isNaN(nmin) || isNaN(nmax) || nmin >= nmax) return showToast('Min grade must be less than max grade', 'error');
        if (isNaN(napr) || napr <= nmin || napr >= nmax) return showToast('Passing grade must be between min and max grade', 'error');

        scaleData = [];
        for (let s = 0; s <= pmax; s = +(s + increment).toFixed(2)) {
            const grade = calculateGrade(s, pmax, exig, nmin, nmax, napr);
            scaleData.push({ score: s, grade });
        }
        // Ensure the max score row is included
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
                    <span class="gs-empty-hint">Configure settings above and click Generate</span>
                </div>`;
            return;
        }

        let html = `
        <div class="gs-scale-wrapper">
            <table class="gs-scale-table">
                <thead>
                    <tr>
                        <th>Score</th>
                        <th>Grade</th>
                    </tr>
                </thead>
                <tbody>`;

        scaleData.forEach(row => {
            const isPassing = row.grade >= napr;
            const rowClass = isPassing ? 'gs-passing-row' : 'gs-failing-row';
            const badgeClass = isPassing ? 'gs-grade-pass' : 'gs-grade-fail';
            html += `
                <tr class="${rowClass}">
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
        if (lines.length === 0) return [];

        // Detect separator
        const firstLine = lines[0];
        const sep = firstLine.includes(';') ? ';' : ',';

        const result = [];
        // Check if first line is a header
        const firstCells = firstLine.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
        const looksLikeHeader = firstCells.some(c =>
            /^(name|nombre|student|alumno|estudiante|#|n°|nro)/i.test(c));
        const startIndex = looksLikeHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const cells = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cells.length > 0 && cells[0]) {
                result.push({ name: cells[0], score: '', grade: null });
            }
        }
        return result;
    }

    // ===== CSV UPLOAD =====
    function handleCSVUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            const text = evt.target.result;
            students = parseCSV(text);
            if (students.length === 0) {
                showToast('No student names found in the file', 'error');
                return;
            }
            $('gs-file-info').textContent = `${file.name} — ${students.length} student(s) loaded`;
            renderStudentsTable();
            showToast(`${students.length} students loaded from CSV`, 'success');
        };
        reader.readAsText(file);
    }

    // ===== RENDER STUDENTS TABLE =====
    function renderStudentsTable() {
        const container = $('gs-students-body');
        if (!students.length) {
            container.innerHTML = `
                <div class="gs-empty-state">
                    <i class="fa-solid fa-users"></i>
                    <p>No students loaded</p>
                    <span class="gs-empty-hint">Upload a CSV file with student names to get started</span>
                </div>`;
            $('gs-summary-bar').style.display = 'none';
            return;
        }

        let html = `
        <div class="gs-students-wrapper">
            <table class="gs-students-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Student Name</th>
                        <th>Score</th>
                        <th>Grade</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>`;

        const napr = parseFloat($('gs-napr').value) || 4.0;

        students.forEach((s, i) => {
            const gradeDisplay = s.grade !== null ? s.grade.toFixed(1) : '—';
            const gradeClass = s.grade !== null ? (s.grade >= napr ? 'gs-grade-pass' : 'gs-grade-fail') : '';
            const statusHtml = s.grade !== null
                ? (s.grade >= napr
                    ? '<span class="gs-status-badge gs-status-pass">PASS</span>'
                    : '<span class="gs-status-badge gs-status-fail">FAIL</span>')
                : '';

            html += `
                <tr>
                    <td style="text-align:center;color:#999;font-weight:600;">${i + 1}</td>
                    <td class="gs-student-name">${escapeHtml(s.name)}</td>
                    <td>
                        <input type="number" class="gs-score-input" data-index="${i}" 
                               value="${s.score}" min="0" step="0.1" placeholder="—" />
                    </td>
                    <td class="gs-grade-cell">
                        <span class="gs-grade-badge ${gradeClass}">${gradeDisplay}</span>
                    </td>
                    <td class="gs-status-cell">${statusHtml}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

        // Bind score inputs
        container.querySelectorAll('.gs-score-input').forEach(input => {
            input.addEventListener('change', onScoreChange);
            input.addEventListener('input', onScoreChange);
        });

        updateSummary();
    }

    function onScoreChange(e) {
        const idx = parseInt(e.target.dataset.index);
        students[idx].score = e.target.value;
        // Auto-calculate if scale is generated
        if (scaleGenerated && e.target.value !== '') {
            const pmax = parseFloat($('gs-pmax').value);
            const exig = parseFloat($('gs-exig').value);
            const nmin = parseFloat($('gs-nmin').value);
            const nmax = parseFloat($('gs-nmax').value);
            const napr = parseFloat($('gs-napr').value);
            const score = parseFloat(e.target.value);
            if (!isNaN(score)) {
                students[idx].grade = calculateGrade(score, pmax, exig, nmin, nmax, napr);
                renderStudentsTable();
            }
        }
    }

    // ===== CALCULATE ALL GRADES =====
    function calculateAllGrades() {
        if (!scaleGenerated) {
            showToast('Please generate a grading scale first', 'error');
            return;
        }
        if (!students.length) {
            showToast('No students loaded. Upload a CSV file first.', 'error');
            return;
        }

        const pmax = parseFloat($('gs-pmax').value);
        const exig = parseFloat($('gs-exig').value);
        const nmin = parseFloat($('gs-nmin').value);
        const nmax = parseFloat($('gs-nmax').value);
        const napr = parseFloat($('gs-napr').value);

        let calculatedCount = 0;
        students.forEach(s => {
            if (s.score !== '' && !isNaN(parseFloat(s.score))) {
                s.grade = calculateGrade(parseFloat(s.score), pmax, exig, nmin, nmax, napr);
                calculatedCount++;
            }
        });

        renderStudentsTable();
        showToast(`Grades calculated for ${calculatedCount} student(s)`, 'success');
    }

    // ===== UPDATE STUDENT GRADES (auto) =====
    function updateStudentGrades() {
        if (!scaleGenerated || !students.length) return;

        const pmax = parseFloat($('gs-pmax').value);
        const exig = parseFloat($('gs-exig').value);
        const nmin = parseFloat($('gs-nmin').value);
        const nmax = parseFloat($('gs-nmax').value);
        const napr = parseFloat($('gs-napr').value);

        students.forEach(s => {
            if (s.score !== '' && !isNaN(parseFloat(s.score))) {
                s.grade = calculateGrade(parseFloat(s.score), pmax, exig, nmin, nmax, napr);
            }
        });

        renderStudentsTable();
    }

    // ===== SUMMARY =====
    function updateSummary() {
        const bar = $('gs-summary-bar');
        const gradedStudents = students.filter(s => s.grade !== null);
        if (!gradedStudents.length) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'flex';
        const napr = parseFloat($('gs-napr').value) || 4.0;
        const passing = gradedStudents.filter(s => s.grade >= napr).length;
        const failing = gradedStudents.length - passing;
        const avg = gradedStudents.reduce((sum, s) => sum + s.grade, 0) / gradedStudents.length;

        bar.innerHTML = `
            <div class="gs-stat-card gs-stat-total">
                <i class="fa-solid fa-users"></i>
                <div>
                    <div class="gs-stat-value">${gradedStudents.length}</div>
                    <div class="gs-stat-label">Graded</div>
                </div>
            </div>
            <div class="gs-stat-card gs-stat-pass">
                <i class="fa-solid fa-circle-check"></i>
                <div>
                    <div class="gs-stat-value">${passing}</div>
                    <div class="gs-stat-label">Passing</div>
                </div>
            </div>
            <div class="gs-stat-card gs-stat-fail">
                <i class="fa-solid fa-circle-xmark"></i>
                <div>
                    <div class="gs-stat-value">${failing}</div>
                    <div class="gs-stat-label">Failing</div>
                </div>
            </div>
            <div class="gs-stat-card gs-stat-avg">
                <i class="fa-solid fa-chart-simple"></i>
                <div>
                    <div class="gs-stat-value">${avg.toFixed(1)}</div>
                    <div class="gs-stat-label">Average</div>
                </div>
            </div>`;
    }

    // ===== CSV EXPORT =====
    function exportCSV() {
        if (!students.length) {
            showToast('No students to export', 'error');
            return;
        }

        const napr = parseFloat($('gs-napr').value) || 4.0;
        let csv = 'Name,Score,Grade,Status\n';
        students.forEach(s => {
            const grade = s.grade !== null ? s.grade.toFixed(1) : '';
            const status = s.grade !== null ? (s.grade >= napr ? 'PASS' : 'FAIL') : '';
            csv += `"${s.name}",${s.score},${grade},${status}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}"></i> ${msg}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ===== HELPERS =====
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== INIT =====
    function init() {
        // Generate button
        $('gs-generate-btn').addEventListener('click', generateScale);

        // Google Drive integration
        $('gs-drive-btn').addEventListener('click', () => driveService.openModal());

        // CSV Upload
        $('gs-csv-input').addEventListener('change', handleCSVUpload);
        $('gs-upload-btn').addEventListener('click', () => $('gs-csv-input').click());

        // Calculate grades
        $('gs-calc-btn').addEventListener('click', calculateAllGrades);

        // Export CSV
        $('gs-export-btn').addEventListener('click', exportCSV);

        // Initial empty states
        renderScaleTable(4.0);
        renderStudentsTable();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
