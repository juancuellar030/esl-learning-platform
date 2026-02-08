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

    let currentEditingClassId = null;

    // Initialize
    function init() {
        setDefaultWeek();
        loadFromLocalStorage();
        attachEventListeners();
        updateDayVisibility();
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
        addActivityBtn.addEventListener('click', addActivityInput);
        activityCancel.addEventListener('click', closeActivityModal);
        activitySave.addEventListener('click', saveActivities);

        // Close modal on backdrop click
        activityModal.addEventListener('click', (e) => {
            if (e.target === activityModal) {
                closeActivityModal();
            }
        });

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activityModal.style.display === 'flex') {
                closeActivityModal();
            }
        });
    }

    // Open activity modal
    function openActivityModal(classId, className, time) {
        currentEditingClassId = classId;
        modalClassName.textContent = className;
        modalClassTime.textContent = time;

        // Load existing activities
        activitiesList.innerHTML = '';
        const existingActivities = plannerData.classes[classId]?.activities || [];

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

        if (activities.length > 0) {
            // Get class info
            const cell = document.querySelector(`[data-class-id="${currentEditingClassId}"]`);
            const classBox = cell.querySelector('.class-box');
            const className = classBox.textContent.trim();
            const timeCell = cell.parentElement.querySelector('td:nth-child(2)');
            const time = timeCell ? timeCell.textContent.trim() : '';

            plannerData.classes[currentEditingClassId] = {
                className: className,
                time: time,
                activities: activities
            };
        } else {
            // Remove if no activities
            delete plannerData.classes[currentEditingClassId];
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

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
