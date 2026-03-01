// Weekly Lesson Planner - Data Management and Interactions
(function () {
    'use strict';

    // State
    let plannerData = {
        weekStart: '',
        weekEnd: '',
        disabledDays: [], // ['monday', 'tuesday', etc.]
        classes: {}
    };

    // DOM Elements
    const weekStartInput = document.getElementById('week-start');
    const weekEndInput = document.getElementById('week-end');
    const dayToggles = document.querySelectorAll('.day-toggle-header'); // Updated selector
    const weekdayTable = document.getElementById('weekday-table');
    const fridayTable = document.getElementById('friday-table');

    const clearTableBtn = document.getElementById('clear-table-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const importJsonInput = document.getElementById('import-json-input');

    // Modal elements
    const activityModal = document.getElementById('activity-modal');
    const modalClassName = document.getElementById('modal-class-name');
    const modalClassTime = document.getElementById('modal-class-time');
    const activitiesList = document.getElementById('activities-list');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const activityCancel = document.getElementById('activity-cancel');
    const activitySave = document.getElementById('activity-save');

    // Import controls
    const importClassBtn = document.getElementById('import-class-btn');
    const importOptionsContainer = document.getElementById('import-options-container');
    const importClassSelect = document.getElementById('import-class-select');
    const confirmImportBtn = document.getElementById('confirm-import-btn');

    let currentEditingClassId = null;

    // Find all class-cell IDs on the same day with the same lesson label
    function findLinkedClassIds(classId) {
        const dayName = classId.split('-')[0]; // e.g. "tuesday"
        const cell = document.querySelector(`[data-class-id="${classId}"]`);
        if (!cell) return [classId];
        const classBox = cell.querySelector('.class-box');
        if (!classBox) return [classId];

        // Normalize label: strip HTML, collapse whitespace
        const normalize = (el) => el.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
        const label = normalize(classBox);

        // Find all cells on the same day
        const allDayCells = document.querySelectorAll(`[data-class-id^="${dayName}-"]`);
        const linked = [];
        allDayCells.forEach(c => {
            if (c.classList.contains('ap-cell')) return;
            const box = c.querySelector('.class-box');
            if (!box) return;
            if (normalize(box) === label) {
                linked.push(c.dataset.classId);
            }
        });
        return linked.length > 0 ? linked : [classId];
    }

    // Initialize
    function init() {
        setDefaultWeek();
        loadFromLocalStorage();
        attachEventListeners();
        updateDayVisibility();
        updateVisualFeedback();
    }

    // Set default week to current Monday - Friday
    function setDefaultWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);

        // Calculate days to subtract to get to Monday (0 = Sunday, 1 = Monday, etc.)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        monday.setDate(today.getDate() - daysToMonday);

        // Calculate Friday
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const mondayStr = monday.toISOString().split('T')[0];
        const fridayStr = friday.toISOString().split('T')[0];

        weekStartInput.value = mondayStr;
        weekEndInput.value = fridayStr;

        if (!plannerData.weekStart) {
            plannerData.weekStart = mondayStr;
            plannerData.weekEnd = fridayStr;
        }
    }

    // Attach event listeners
    function attachEventListeners() {
        // Date Inputs
        weekStartInput.addEventListener('change', (e) => {
            plannerData.weekStart = e.target.value;
            // Optional: Auto-update end date logic if needed
            saveToLocalStorage();
        });

        weekEndInput.addEventListener('change', (e) => {
            plannerData.weekEnd = e.target.value;
            saveToLocalStorage();
        });

        // Day Toggles
        dayToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const day = toggle.dataset.day;

                if (plannerData.disabledDays.includes(day)) {
                    // Enable day
                    plannerData.disabledDays = plannerData.disabledDays.filter(d => d !== day);
                    toggle.classList.remove('inactive');
                    toggle.classList.add('active');
                } else {
                    // Disable day
                    plannerData.disabledDays.push(day);
                    toggle.classList.remove('active');
                    toggle.classList.add('inactive');
                }

                updateDayVisibility();
                saveToLocalStorage();
            });
        });

        // Clear table
        clearTableBtn.addEventListener('click', clearTable);

        // Export JSON
        exportJsonBtn.addEventListener('click', exportToJSON);

        // Import JSON
        importJsonInput.addEventListener('change', importFromJSON);

        // Class cells
        const classCells = document.querySelectorAll('.class-cell');
        classCells.forEach(cell => {
            cell.addEventListener('click', () => {
                const classId = cell.dataset.classId;
                const classBox = cell.querySelector('.class-box');
                const className = classBox.textContent.trim();
                const timeCell = cell.parentElement.querySelector('td:nth-child(2)');
                const time = timeCell ? timeCell.textContent.trim() : '';

                openActivityModal(classId, className, time);
            });
        });

        // Modal controls
        addActivityBtn.addEventListener('click', () => addActivityInput());
        activityCancel.addEventListener('click', closeActivityModal);
        activitySave.addEventListener('click', saveActivities);

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activityModal.style.display === 'flex') {
                closeActivityModal();
            }
        });

        // Import inside modal
        if (importClassBtn) importClassBtn.addEventListener('click', toggleImportOptions);
        if (confirmImportBtn) confirmImportBtn.addEventListener('click', importActivitiesFromClass);
    }

    // Open activity modal
    function openActivityModal(classId, className, time) {
        currentEditingClassId = classId;
        modalClassName.textContent = className;
        modalClassTime.textContent = time;

        // Load existing activities — check all linked siblings
        activitiesList.innerHTML = '';
        const linkedIds = findLinkedClassIds(classId);
        let existingActivities = [];
        for (const id of linkedIds) {
            const acts = plannerData.classes[id]?.activities || [];
            if (acts.length > 0) {
                existingActivities = acts;
                break;
            }
        }

        if (existingActivities.length === 0) {
            addActivityInput();
        } else {
            existingActivities.forEach(activity => {
                addActivityInput(activity);
            });
        }

        activityModal.style.display = 'flex';
    }

    // Close activity modal
    function closeActivityModal() {
        activityModal.style.display = 'none';
        currentEditingClassId = null;
        // Reset import UI
        importOptionsContainer.style.display = 'none';
        importClassSelect.innerHTML = '<option value="">Select a class...</option>';
    }

    // Toggle Import Options
    function toggleImportOptions() {
        if (importOptionsContainer.style.display === 'none') {
            populateImportSelect();
            importOptionsContainer.style.display = 'block';
        } else {
            importOptionsContainer.style.display = 'none';
        }
    }

    // Populate Import Select — excludes linked siblings of the current class
    function populateImportSelect() {
        importClassSelect.innerHTML = '<option value="">Select a class...</option>';

        const linkedIds = findLinkedClassIds(currentEditingClassId);
        const seen = new Set();

        Object.entries(plannerData.classes).forEach(([classId, data]) => {
            // Exclude current class, its linked siblings, and ensure it has activities
            if (!linkedIds.includes(classId) && data.activities && data.activities.length > 0) {
                const label = data.className;
                if (seen.has(label)) return;
                seen.add(label);

                const option = document.createElement('option');
                option.value = classId;
                option.textContent = `${data.className} (${data.time}) - ${data.activities.length} activities`;
                importClassSelect.appendChild(option);
            }
        });

        if (importClassSelect.options.length <= 1) {
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'No other classes with activities found';
            importClassSelect.appendChild(option);
        }
    }

    // Import Activities
    function importActivitiesFromClass() {
        const sourceClassId = importClassSelect.value;
        if (!sourceClassId) {
            showToast('Please select a class to import from', 'warning');
            return;
        }

        const sourceActivities = plannerData.classes[sourceClassId]?.activities || [];

        sourceActivities.forEach(activity => {
            addActivityInput(activity);
        });

        showToast(`Imported ${sourceActivities.length} activities`, 'success');
        importOptionsContainer.style.display = 'none';
    }

    // Add activity input field
    function addActivityInput(value = '') {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter activity description...';
        input.value = value;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        removeBtn.addEventListener('click', () => {
            activityItem.remove();
        });

        activityItem.appendChild(input);
        activityItem.appendChild(removeBtn);
        activitiesList.appendChild(activityItem);

        // Focus on new input
        if (!value) {
            input.focus();
        }
    }

    // Save activities
    function saveActivities() {
        const inputs = activitiesList.querySelectorAll('input');
        const activities = Array.from(inputs)
            .map(input => input.value.trim())
            .filter(activity => activity.length > 0);

        // Save (or clear) for ALL linked siblings
        const linkedIds = findLinkedClassIds(currentEditingClassId);

        if (activities.length > 0) {
            linkedIds.forEach(id => {
                const cell = document.querySelector(`[data-class-id="${id}"]`);
                const classBox = cell.querySelector('.class-box');
                const className = classBox.textContent.trim();
                const timeCell = cell.parentElement.querySelector('td:nth-child(2)');
                const time = timeCell ? timeCell.textContent.trim() : '';

                plannerData.classes[id] = {
                    className: className,
                    time: time,
                    activities: activities
                };
            });
        } else {
            // Remove all linked siblings if no activities
            linkedIds.forEach(id => {
                delete plannerData.classes[id];
            });
        }

        saveToLocalStorage();
        updateVisualFeedback();
        closeActivityModal();
    }

    // Update visual feedback for cells with activities
    function updateVisualFeedback() {
        const classCells = document.querySelectorAll('.class-cell');

        classCells.forEach(cell => {
            const classId = cell.dataset.classId;
            if (plannerData.classes[classId]?.activities?.length > 0) {
                cell.classList.add('has-activities');
            } else {
                cell.classList.remove('has-activities');
            }
        });
    }

    // Update visibility of disabled days
    function updateDayVisibility() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const disabledDays = plannerData.disabledDays || [];

        // Update Toggles UI
        days.forEach(day => {
            const toggle = document.querySelector(`.day-toggle[data-day="${day}"]`);
            if (toggle) {
                if (disabledDays.includes(day)) {
                    toggle.classList.remove('active');
                    toggle.classList.add('inactive');
                } else {
                    toggle.classList.add('active');
                    toggle.classList.remove('inactive');
                }
            }
        });

        // Update Table Columns
        const setColumnDisabled = (table, colIndex, disable) => {
            if (!table) return;
            // Header
            const th = table.querySelector(`thead th:nth-child(${colIndex})`);
            if (th) th.classList.toggle('day-disabled', disable);

            // Rows
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cell = row.querySelector(`td:nth-child(${colIndex})`);
                // Check if cell exists and is NOT a colspan break cell
                if (cell && !cell.hasAttribute('colspan')) {
                    cell.classList.toggle('day-disabled', disable);
                }
            });
        };

        // Mon-Thu
        setColumnDisabled(weekdayTable, 3, disabledDays.includes('monday'));
        setColumnDisabled(weekdayTable, 4, disabledDays.includes('tuesday'));
        setColumnDisabled(weekdayTable, 5, disabledDays.includes('wednesday'));
        setColumnDisabled(weekdayTable, 6, disabledDays.includes('thursday'));

        // Fri
        setColumnDisabled(fridayTable, 3, disabledDays.includes('friday'));
    }

    // Clear table
    function clearTable() {
        const confirmed = confirm('Are you sure you want to clear all planning data? This action cannot be undone.');

        if (confirmed) {
            plannerData.classes = {};
            saveToLocalStorage();
            updateVisualFeedback();

            // Show success message
            showToast('Table cleared successfully', 'success');
        }
    }

    // Export to JSON
    function exportToJSON() {
        if (Object.keys(plannerData.classes).length === 0 && !plannerData.weekStart) {
            showToast('No planning data to export', 'warning');
            return;
        }

        const dataStr = JSON.stringify(plannerData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `lesson-plan-${plannerData.weekStart || 'backup'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Planning data exported successfully', 'success');
    }

    // Import from JSON
    function importFromJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);

                // Validate data structure
                if (!importedData.classes || typeof importedData.classes !== 'object') {
                    throw new Error('Invalid data format');
                }

                // Confirm import
                const confirmed = confirm('This will replace all current planning data. Continue?');
                if (!confirmed) return;

                plannerData = importedData;

                // Handle legacy data (weekOf -> weekStart)
                if (importedData.weekOf && !importedData.weekStart) {
                    plannerData.weekStart = importedData.weekOf;
                    // Calculate default end date
                    const start = new Date(importedData.weekOf);
                    start.setDate(start.getDate() + 4);
                    plannerData.weekEnd = start.toISOString().split('T')[0];
                }

                // Update date inputs
                if (plannerData.weekStart) weekStartInput.value = plannerData.weekStart;
                if (plannerData.weekEnd) weekEndInput.value = plannerData.weekEnd;

                saveToLocalStorage();
                updateVisualFeedback();
                updateDayVisibility();
                showToast('Planning data imported successfully', 'success');
            } catch (error) {
                showToast('Error importing file: Invalid format', 'error');
                console.error('Import error:', error);
            }
        };

        reader.readAsText(file);

        // Reset input
        e.target.value = '';
    }

    // Save to localStorage
    function saveToLocalStorage() {
        try {
            localStorage.setItem('weeklyPlannerData', JSON.stringify(plannerData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            showToast('Error saving data', 'error');
        }
    }

    // Load from localStorage
    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('weeklyPlannerData');
            if (saved) {
                const parsed = JSON.parse(saved);
                plannerData = parsed;

                // Migration: weekOf -> weekStart
                if (plannerData.weekOf && !plannerData.weekStart) {
                    plannerData.weekStart = plannerData.weekOf;
                    const start = new Date(plannerData.weekOf);
                    start.setDate(start.getDate() + 4);
                    plannerData.weekEnd = start.toISOString().split('T')[0];
                }

                // Update inputs
                if (plannerData.weekStart) weekStartInput.value = plannerData.weekStart;
                if (plannerData.weekEnd) weekEndInput.value = plannerData.weekEnd;

                // Initialize disabled days if missing
                if (!plannerData.disabledDays) plannerData.disabledDays = [];
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    // Show toast notification
    function showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;

        // Add to body
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===== DAY VIEWER =====
    const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    let currentViewDay = 0; // index into DAY_NAMES

    function getTodayIndex() {
        const jsDay = new Date().getDay(); // 0=Sun,1=Mon,...,6=Sat
        if (jsDay >= 1 && jsDay <= 5) return jsDay - 1; // Mon=0 … Fri=4
        return 0; // default to Monday on weekends
    }

    function openDayViewer() {
        currentViewDay = getTodayIndex();
        renderDayView();
        document.getElementById('day-viewer-modal').style.display = 'flex';
    }

    function closeDayViewer() {
        document.getElementById('day-viewer-modal').style.display = 'none';
    }

    function navigateDay(delta) {
        currentViewDay = Math.max(0, Math.min(DAY_NAMES.length - 1, currentViewDay + delta));
        renderDayView();
    }

    function renderDayView() {
        const dayName = DAY_NAMES[currentViewDay];
        const dayLabel = DAY_LABELS[currentViewDay];

        // Update header
        document.getElementById('day-viewer-title').textContent = dayLabel;

        // Update arrows
        document.getElementById('day-prev-btn').disabled = currentViewDay === 0;
        document.getElementById('day-next-btn').disabled = currentViewDay === DAY_NAMES.length - 1;

        // Gather all class cells for this day, in period order
        const cells = Array.from(document.querySelectorAll(`[data-class-id^="${dayName}-"]`));

        // Sort by period number
        cells.sort((a, b) => {
            const pA = parseInt(a.dataset.classId.split('-')[1]);
            const pB = parseInt(b.dataset.classId.split('-')[1]);
            return pA - pB;
        });

        // Build grouped entries: merge consecutive cells with the same class label
        const groups = [];
        cells.forEach(cell => {
            const classId = cell.dataset.classId;
            const classBox = cell.querySelector('.class-box');
            if (!classBox) return;
            // Skip AP cells
            if (cell.classList.contains('ap-cell')) return;

            const label = classBox.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
            const timeCell = cell.parentElement.querySelector('td:nth-child(2)');
            const time = timeCell ? timeCell.textContent.trim() : '';
            const activities = plannerData.classes[classId]?.activities || [];

            const last = groups[groups.length - 1];
            if (last && last.label === label) {
                // Merge: extend time range and combine activities
                last.timeTo = time.split('-')[1] || time;
                last.activities = last.activities.concat(activities);
                last.classIds.push(classId);
            } else {
                const parts = time.split('-');
                groups.push({
                    label,
                    timeFrom: parts[0] || '',
                    timeTo: parts[1] || '',
                    activities: [...activities],
                    classIds: [classId]
                });
            }
        });

        // Split into morning (periods 1-5, before lunch) and afternoon (periods 6+)
        const morningGroups = [];
        const afternoonGroups = [];
        groups.forEach(group => {
            // Check period numbers — periods 1-5 are morning, 6+ are afternoon
            const firstPeriod = parseInt(group.classIds[0].split('-')[1]);
            if (firstPeriod <= 5) {
                morningGroups.push(group);
            } else {
                afternoonGroups.push(group);
            }
        });

        // Render
        const container = document.getElementById('day-viewer-classes');
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="day-viewer-empty">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <p>No classes scheduled for ${dayLabel}</p>
                </div>`;
            return;
        }

        // Get current time in minutes for comparison
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const isToday = currentViewDay === getTodayIndex() && now.getDay() >= 1 && now.getDay() <= 5;

        const parseTime = (t) => {
            // Parse "9:10" or "14:00" into minutes since midnight
            const parts = t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
        };

        const renderColumn = (title, icon, columnGroups) => {
            const cardsHtml = columnGroups.length > 0
                ? columnGroups.map(group => {
                    const timeRange = group.timeFrom + '-' + group.timeTo;

                    // Determine time status: past, current, or upcoming
                    let timeStatus = '';
                    if (isToday) {
                        const startMin = parseTime(group.timeFrom);
                        const endMin = parseTime(group.timeTo);
                        if (currentMinutes >= startMin && currentMinutes < endMin) {
                            timeStatus = 'dv-current';
                        } else if (currentMinutes >= endMin) {
                            timeStatus = 'dv-past';
                        } else {
                            timeStatus = 'dv-upcoming';
                        }
                    }

                    const activitiesHtml = group.activities.length > 0
                        ? group.activities.map((a, i) => `<div class="dv-activity-card"><span class="dv-activity-num">${i + 1}</span> ${escapeHtml(a)}</div>`).join('')
                        : '<div class="dv-no-activities"><i class="fa-solid fa-circle-minus"></i> No activities planned</div>';

                    return `
                        <div class="dv-class-card ${timeStatus}">
                            <div class="dv-class-header">
                                <span class="dv-class-label">${escapeHtml(group.label)}</span>
                                <span class="dv-class-time"><i class="fa-regular fa-clock"></i> ${escapeHtml(timeRange)}</span>
                            </div>
                            <div class="dv-activities-list">
                                ${activitiesHtml}
                            </div>
                        </div>`;
                }).join('')
                : '<div class="dv-no-activities" style="padding:20px;text-align:center;"><i class="fa-solid fa-circle-minus"></i> No classes</div>';

            return `
                <div class="dv-column">
                    <div class="dv-column-title"><i class="fa-solid ${icon}"></i> ${title}</div>
                    ${cardsHtml}
                </div>`;
        };

        container.innerHTML = `
            <div class="dv-columns-wrapper">
                ${renderColumn('Morning', 'fa-sun', morningGroups)}
                ${renderColumn('Afternoon', 'fa-cloud-sun', afternoonGroups)}
            </div>`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Attach day viewer listeners after DOM is ready
    function attachDayViewerListeners() {
        const openBtn = document.getElementById('open-day-viewer-btn');
        if (openBtn) openBtn.addEventListener('click', openDayViewer);

        const closeBtn = document.getElementById('day-viewer-close');
        if (closeBtn) closeBtn.addEventListener('click', closeDayViewer);

        const prevBtn = document.getElementById('day-prev-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => navigateDay(-1));

        const nextBtn = document.getElementById('day-next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => navigateDay(1));

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('day-viewer-modal');
            if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
                closeDayViewer();
            }
        });
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { init(); attachDayViewerListeners(); });
    } else {
        init();
        attachDayViewerListeners();
    }

})();
