(() => {
    'use strict';

    const STORAGE_KEY = 'esl-class-events';
    const CATEGORY_ICONS = {
        'bring-item': 'fa-solid fa-backpack',
        'school-event': 'fa-solid fa-star',
        assignment: 'fa-solid fa-pencil',
        'field-trip': 'fa-solid fa-bus',
        celebration: 'fa-solid fa-cake-candles',
        other: 'fa-solid fa-calendar-day',
        holiday: 'fa-solid fa-umbrella-beach',
        exam: 'fa-solid fa-file-signature',
        sports: 'fa-solid fa-futbol',
        'parent-meeting': 'fa-solid fa-people-roof',
        'flag-ceremony': 'fa-solid fa-flag',
        'student-birthday': 'fa-solid fa-cake-candles',
        'teacher-birthday': 'fa-solid fa-gift'
    };
    const CATEGORY_LABELS = {
        'bring-item': 'Bring an Item',
        'school-event': 'School Event',
        assignment: 'Assignment',
        'field-trip': 'Field Trip',
        celebration: 'Celebration',
        other: 'Other',
        holiday: 'Holiday',
        exam: 'Exam',
        sports: 'Sports',
        'parent-meeting': 'Parent Meeting',
        'flag-ceremony': 'Flag Ceremony',
        'student-birthday': 'Student Birthday',
        'teacher-birthday': 'Teacher Birthday'
    };

    // Birthday categories are generated from the roster files, so they are never
    // selectable in the form nor accepted from a stored/imported events array.
    const BIRTHDAY_CATEGORIES = new Set(['student-birthday', 'teacher-birthday']);
    const VALID_CATEGORIES = new Set(
        Object.keys(CATEGORY_ICONS).filter((category) => !BIRTHDAY_CATEGORIES.has(category))
    );
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const BIRTHDATE_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

    let events = [];
    let birthdayEntries = [];
    let currentView = 'month';
    let selectedDate = startOfDay(new Date());
    let pendingImageDataUrl = '';
    let lastFocusedElement = null;
    let statusTimer = null;
    const editingCommentIds = new Set();

    const elements = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindEvents();
        loadEvents();
        birthdayEntries = buildBirthdayEntries();
        setupDriveSync();
        render();
        window.setInterval(updateCountdowns, 60000);
    }

    function cacheElements() {
        elements.addButton = document.getElementById('cc-add-event-btn');
        elements.exportButton = document.getElementById('cc-export-btn');
        elements.importButton = document.getElementById('cc-import-btn');
        elements.importInput = document.getElementById('cc-import-input');
        elements.driveButton = document.getElementById('cc-drive-btn');
        elements.status = document.getElementById('cc-status');
        elements.tabs = [...document.querySelectorAll('.cc-tab')];
        elements.panels = [...document.querySelectorAll('.cc-view-panel')];
        elements.previousPeriod = document.getElementById('cc-previous-period');
        elements.nextPeriod = document.getElementById('cc-next-period');
        elements.todayButton = document.getElementById('cc-today-btn');
        elements.periodTitle = document.getElementById('cc-period-title');
        elements.monthGrid = document.getElementById('cc-month-grid');
        elements.weekGrid = document.getElementById('cc-week-grid');
        elements.dayEvents = document.getElementById('cc-day-events');
        elements.calendarShell = document.querySelector('.cc-calendar-shell');
        elements.modal = document.getElementById('cc-event-modal');
        elements.modalTitle = document.getElementById('cc-modal-title');
        elements.closeModal = document.getElementById('cc-close-modal');
        elements.cancelEvent = document.getElementById('cc-cancel-event');
        elements.form = document.getElementById('cc-event-form');
        elements.formError = document.getElementById('cc-form-error');
        elements.eventId = document.getElementById('cc-event-id');
        elements.title = document.getElementById('cc-title');
        elements.category = document.getElementById('cc-category');
        elements.startDate = document.getElementById('cc-start-date');
        elements.startTime = document.getElementById('cc-start-time');
        elements.duration = document.getElementById('cc-duration');
        elements.description = document.getElementById('cc-description');
        elements.image = document.getElementById('cc-image');
        elements.imagePreview = document.getElementById('cc-image-preview');
        elements.imagePreviewImg = document.getElementById('cc-image-preview-img');
        elements.removeImage = document.getElementById('cc-remove-image');
        elements.showCountdown = document.getElementById('cc-show-countdown');
    }

    function bindEvents() {
        elements.addButton.addEventListener('click', () => openEventModal());
        elements.exportButton.addEventListener('click', exportEvents);
        elements.importButton.addEventListener('click', () => elements.importInput.click());
        elements.importInput.addEventListener('change', importEvents);
        elements.previousPeriod.addEventListener('click', () => movePeriod(-1));
        elements.nextPeriod.addEventListener('click', () => movePeriod(1));
        elements.todayButton.addEventListener('click', () => {
            selectedDate = startOfDay(new Date());
            render();
        });

        elements.tabs.forEach((tab) => {
            tab.addEventListener('click', () => setView(tab.dataset.view));
            tab.addEventListener('keydown', handleTabKeydown);
        });

        elements.monthGrid.addEventListener('click', handleCalendarClick);
        elements.weekGrid.addEventListener('click', handleCalendarClick);
        elements.dayEvents.addEventListener('click', handleCalendarClick);
        elements.calendarShell.addEventListener('submit', handleCommentSubmit);

        elements.closeModal.addEventListener('click', closeEventModal);
        elements.cancelEvent.addEventListener('click', closeEventModal);
        elements.modal.addEventListener('click', (event) => {
            if (event.target === elements.modal) closeEventModal();
        });
        elements.form.addEventListener('submit', saveEventFromForm);
        elements.image.addEventListener('change', handleImageSelection);
        elements.removeImage.addEventListener('click', removePendingImage);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !elements.modal.hidden) closeEventModal();
        });
    }

    function loadEvents() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw);
            const validation = validateEventsArray(parsed);
            if (!validation.valid) {
                showStatus(`Saved calendar data could not be loaded: ${validation.message}`, 'error', false);
                return;
            }
            events = parsed.map(normalizeEvent).sort(compareEvents);
        } catch (error) {
            showStatus('Saved calendar data is malformed and was not loaded.', 'error', false);
        }
    }

    /**
     * Birthday entries are derived from the roster files on every page load and
     * are never written to STORAGE_KEY, so students-data.js / teachers-data.js
     * stay the only source of truth.
     */
    function buildBirthdayEntries() {
        const rosters = [
            { people: typeof STUDENTS_DATA === 'undefined' ? [] : STUDENTS_DATA, category: 'student-birthday' },
            { people: typeof TEACHERS_DATA === 'undefined' ? [] : TEACHERS_DATA, category: 'teacher-birthday' }
        ];

        const entries = [];
        rosters.forEach(({ people, category }) => {
            if (!Array.isArray(people)) return;

            people.forEach((person) => {
                if (!person || typeof person.name !== 'string' || !BIRTHDATE_PATTERN.test(person.birthdate)) return;

                const dateKey = formatDateKey(getNextBirthday(person.birthdate));
                entries.push({
                    id: `birthday-${category}-${dateKey}-${person.name}`,
                    title: `${person.name} — Birthday`,
                    description: '',
                    category,
                    startDate: dateKey,
                    startTime: '',
                    durationMinutes: null,
                    imageDataUrl: '',
                    showCountdown: false,
                    comment: '',
                    createdAt: `${dateKey}T00:00:00.000Z`,
                    isReadOnly: true
                });
            });
        });

        return entries;
    }

    /** Next occurrence of an 'MM-DD' birthday, rolling into next year once it has passed. */
    function getNextBirthday(birthdateMMDD) {
        const [month, day] = birthdateMMDD.split('-').map(Number);
        const todayMidnight = startOfDay(new Date());
        let birthday = buildBirthdayDate(todayMidnight.getFullYear(), month, day);
        if (birthday < todayMidnight) {
            birthday = buildBirthdayDate(todayMidnight.getFullYear() + 1, month, day);
        }
        return birthday;
    }

    /** Keeps Feb 29 on the last day of February instead of overflowing into March. */
    function buildBirthdayDate(year, month, day) {
        const date = new Date(year, month - 1, day);
        if (date.getMonth() !== month - 1) return new Date(year, month, 0);
        return date;
    }

    function render() {
        updateTabs();
        updatePeriodTitle();

        if (currentView === 'month') renderMonthView();
        if (currentView === 'week') renderWeekView();
        if (currentView === 'day') renderDayView();

        updateCountdowns();
    }

    function updateTabs() {
        elements.tabs.forEach((tab) => {
            const isActive = tab.dataset.view === currentView;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });

        elements.panels.forEach((panel) => {
            panel.hidden = panel.id !== `cc-${currentView}-panel`;
        });
    }

    function setView(view, focusTab = false) {
        if (!['month', 'week', 'day'].includes(view)) return;
        currentView = view;
        render();
        if (focusTab) {
            document.querySelector(`.cc-tab[data-view="${view}"]`).focus();
        }
    }

    function handleTabKeydown(event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();

        const currentIndex = elements.tabs.indexOf(event.currentTarget);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + elements.tabs.length) % elements.tabs.length;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % elements.tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = elements.tabs.length - 1;
        setView(elements.tabs[nextIndex].dataset.view, true);
    }

    function movePeriod(direction) {
        const next = new Date(selectedDate);
        if (currentView === 'month') {
            next.setDate(1);
            next.setMonth(next.getMonth() + direction);
        } else if (currentView === 'week') {
            next.setDate(next.getDate() + (7 * direction));
        } else {
            next.setDate(next.getDate() + direction);
        }
        selectedDate = startOfDay(next);
        render();
    }

    function updatePeriodTitle() {
        if (currentView === 'month') {
            elements.periodTitle.textContent = new Intl.DateTimeFormat('en-US', {
                month: 'long',
                year: 'numeric'
            }).format(selectedDate);
            return;
        }

        if (currentView === 'week') {
            const start = startOfWeek(selectedDate);
            const end = addDays(start, 6);
            const sameMonth = start.getMonth() === end.getMonth();
            const startLabel = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric'
            }).format(start);
            const endLabel = new Intl.DateTimeFormat('en-US', {
                month: sameMonth ? undefined : 'short',
                day: 'numeric',
                year: 'numeric'
            }).format(end);
            elements.periodTitle.textContent = `${startLabel} – ${endLabel}`;
            return;
        }

        elements.periodTitle.textContent = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }).format(selectedDate);
    }

    function renderMonthView() {
        elements.monthGrid.replaceChildren();
        const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
        const todayKey = formatDateKey(new Date());

        for (let index = 0; index < 42; index += 1) {
            const date = addDays(gridStart, index);
            const dateKey = formatDateKey(date);
            const dayEvents = eventsForDate(dateKey);
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cc-month-day';
            cell.dataset.date = dateKey;
            cell.setAttribute('aria-label', buildDayAriaLabel(date, dayEvents.length));

            if (date.getMonth() !== selectedDate.getMonth()) cell.classList.add('cc-outside-month');
            if (dateKey === todayKey) cell.classList.add('cc-today');
            if (dateKey === formatDateKey(selectedDate)) cell.classList.add('cc-selected-day');
            if (dayEvents.length) cell.classList.add('cc-has-events');

            const number = document.createElement('span');
            number.className = 'cc-day-number';
            number.textContent = String(date.getDate());
            cell.appendChild(number);

            if (dayEvents.length) {
                const previews = document.createElement('span');
                previews.className = 'cc-month-previews';
                dayEvents.slice(0, 2).forEach((event) => {
                    const preview = document.createElement('span');
                    preview.className = `cc-month-preview cc-category-${event.category}`;
                    const icon = document.createElement('i');
                    icon.className = CATEGORY_ICONS[event.category];
                    icon.setAttribute('aria-hidden', 'true');
                    const title = document.createElement('span');
                    title.textContent = event.title;
                    preview.append(icon, title);
                    previews.appendChild(preview);
                });

                if (dayEvents.length > 2) {
                    const more = document.createElement('span');
                    more.className = 'cc-month-more';
                    more.textContent = `+${dayEvents.length - 2} more`;
                    previews.appendChild(more);
                }
                cell.appendChild(previews);
            }

            elements.monthGrid.appendChild(cell);
        }
    }

    function renderWeekView() {
        elements.weekGrid.replaceChildren();
        const weekStart = startOfWeek(selectedDate);
        const todayKey = formatDateKey(new Date());

        for (let index = 0; index < 7; index += 1) {
            const date = addDays(weekStart, index);
            const dateKey = formatDateKey(date);
            const dayEvents = eventsForDate(dateKey);
            const column = document.createElement('section');
            column.className = 'cc-week-day';
            if (dateKey === todayKey) column.classList.add('cc-today');

            const headingButton = document.createElement('button');
            headingButton.type = 'button';
            headingButton.className = 'cc-week-day-heading';
            headingButton.dataset.date = dateKey;
            headingButton.setAttribute('aria-label', `Open ${formatFullDate(date)} in day view`);

            const weekday = document.createElement('span');
            weekday.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
            const dayNumber = document.createElement('strong');
            dayNumber.textContent = String(date.getDate());
            headingButton.append(weekday, dayNumber);
            column.appendChild(headingButton);

            const list = document.createElement('div');
            list.className = 'cc-week-event-list';
            if (dayEvents.length) {
                dayEvents.forEach((event) => list.appendChild(createEventCard(event, true)));
            } else {
                list.appendChild(createEmptyState('No events'));
            }
            column.appendChild(list);
            elements.weekGrid.appendChild(column);
        }
    }

    function renderDayView() {
        elements.dayEvents.replaceChildren();
        const dayEvents = eventsForDate(formatDateKey(selectedDate));

        if (!dayEvents.length) {
            const empty = createEmptyState('No events scheduled for this day.');
            empty.classList.add('cc-day-empty');
            elements.dayEvents.appendChild(empty);
            return;
        }

        dayEvents.forEach((event) => elements.dayEvents.appendChild(createEventCard(event, false)));
    }

    function createEventCard(event, compact) {
        const card = document.createElement('article');
        card.className = `cc-event-card cc-category-${event.category}`;
        card.dataset.eventId = event.id;
        if (compact) card.classList.add('cc-event-card-compact');

        const isPast = eventHasPassed(event);
        if (isPast) card.classList.add('cc-past-event');

        const visual = document.createElement('div');
        visual.className = 'cc-event-visual';
        if (event.imageDataUrl) {
            const image = document.createElement('img');
            image.src = event.imageDataUrl;
            image.alt = '';
            visual.appendChild(image);
        } else {
            const icon = document.createElement('i');
            icon.className = CATEGORY_ICONS[event.category];
            icon.setAttribute('aria-hidden', 'true');
            visual.appendChild(icon);
        }

        const content = document.createElement('div');
        content.className = 'cc-event-content';

        const headingRow = document.createElement('div');
        headingRow.className = 'cc-event-heading-row';
        const heading = document.createElement('h4');
        heading.textContent = event.title;
        const category = document.createElement('span');
        category.className = 'cc-category-label';
        category.textContent = CATEGORY_LABELS[event.category];
        headingRow.append(heading, category);
        content.appendChild(headingRow);

        const meta = document.createElement('div');
        meta.className = 'cc-event-meta';
        meta.appendChild(createMetaItem('fa-regular fa-calendar', formatFullDate(parseDateKey(event.startDate))));
        meta.appendChild(createMetaItem(
            'fa-regular fa-clock',
            event.startTime ? formatTime(event.startTime) : 'All day'
        ));
        if (event.startTime && event.durationMinutes) {
            meta.appendChild(createMetaItem('fa-solid fa-hourglass-half', `${event.durationMinutes} min`));
        }
        content.appendChild(meta);

        if (event.description) {
            const description = document.createElement('p');
            description.className = 'cc-event-description';
            description.textContent = event.description;
            content.appendChild(description);
        }

        if (event.showCountdown && !isPast && getEventStart(event) > new Date()) {
            const countdown = document.createElement('p');
            countdown.className = 'cc-countdown';
            countdown.dataset.countdownId = event.id;
            countdown.appendChild(document.createElement('i')).className = 'fa-solid fa-hourglass-start';
            countdown.append(` ${formatCountdown(getEventStart(event) - new Date())}`);
            content.appendChild(countdown);
        }

        if (isPast && !event.isReadOnly) content.appendChild(createCommentArea(event));

        const actions = document.createElement('div');
        actions.className = 'cc-event-actions';

        if (event.isReadOnly) {
            card.classList.add('cc-readonly-event');
            const tag = document.createElement('span');
            tag.className = 'cc-readonly-tag';
            tag.title = 'Generated from the class roster files';
            const tagIcon = document.createElement('i');
            tagIcon.className = 'fa-solid fa-lock';
            tagIcon.setAttribute('aria-hidden', 'true');
            tag.append(tagIcon, document.createTextNode(' From roster'));
            actions.appendChild(tag);
        } else {
            actions.append(
                createActionButton('edit', 'fa-solid fa-pen', 'Edit', event.id),
                createActionButton('duplicate', 'fa-solid fa-copy', 'Duplicate', event.id),
                createActionButton('delete', 'fa-solid fa-trash-can', 'Delete', event.id)
            );
        }

        card.append(visual, content, actions);
        return card;
    }

    function createCommentArea(event) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cc-comment-area';

        if (event.comment && !editingCommentIds.has(event.id)) {
            const label = document.createElement('strong');
            label.textContent = 'Teacher note';
            const comment = document.createElement('p');
            comment.textContent = event.comment;
            const editButton = createActionButton('edit-comment', 'fa-solid fa-pen', 'Edit note', event.id);
            wrapper.append(label, comment, editButton);
            return wrapper;
        }

        const form = document.createElement('form');
        form.className = 'cc-comment-form';
        form.dataset.commentForm = event.id;
        const label = document.createElement('label');
        label.htmlFor = `cc-comment-${event.id}`;
        label.textContent = event.comment ? 'Edit teacher note' : 'Add a note';
        const textarea = document.createElement('textarea');
        textarea.id = `cc-comment-${event.id}`;
        textarea.rows = 2;
        textarea.maxLength = 1000;
        textarea.value = event.comment || '';
        textarea.placeholder = 'Add a reflection or reminder about this event…';
        const buttons = document.createElement('div');
        buttons.className = 'cc-comment-buttons';
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'btn-primary';
        save.textContent = 'Save note';
        buttons.appendChild(save);

        if (event.comment) {
            const cancel = createActionButton('cancel-comment', 'fa-solid fa-xmark', 'Cancel', event.id);
            buttons.appendChild(cancel);
        }

        form.append(label, textarea, buttons);
        wrapper.appendChild(form);
        return wrapper;
    }

    function createActionButton(action, iconClass, text, eventId) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `cc-card-action cc-${action}-action`;
        button.dataset.action = action;
        button.dataset.eventId = eventId;
        button.setAttribute('aria-label', `${text}: ${findEvent(eventId)?.title || 'event'}`);
        const icon = document.createElement('i');
        icon.className = iconClass;
        icon.setAttribute('aria-hidden', 'true');
        const textNode = document.createElement('span');
        textNode.textContent = text;
        button.append(icon, textNode);
        return button;
    }

    function createMetaItem(iconClass, text) {
        const item = document.createElement('span');
        const icon = document.createElement('i');
        icon.className = iconClass;
        icon.setAttribute('aria-hidden', 'true');
        item.append(icon, document.createTextNode(` ${text}`));
        return item;
    }

    function createEmptyState(message) {
        const empty = document.createElement('p');
        empty.className = 'cc-empty-state';
        empty.textContent = message;
        return empty;
    }

    function handleCalendarClick(event) {
        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            const eventId = actionButton.dataset.eventId;
            const action = actionButton.dataset.action;
            if (action === 'edit') openEventModal(eventId);
            if (action === 'duplicate') openEventModal(eventId, { duplicate: true });
            if (action === 'delete') deleteEvent(eventId);
            if (action === 'edit-comment') {
                editingCommentIds.add(eventId);
                render();
                focusComment(eventId);
            }
            if (action === 'cancel-comment') {
                editingCommentIds.delete(eventId);
                render();
            }
            return;
        }

        const dayTarget = event.target.closest('[data-date]');
        if (dayTarget) {
            selectedDate = parseDateKey(dayTarget.dataset.date);
            setView('day');
        }
    }

    function handleCommentSubmit(event) {
        const form = event.target.closest('[data-comment-form]');
        if (!form) return;
        event.preventDefault();
        const eventId = form.dataset.commentForm;
        const calendarEvent = events.find((item) => item.id === eventId);
        if (!calendarEvent) return;

        const textarea = form.querySelector('textarea');
        const candidate = events.map((item) => item.id === eventId
            ? { ...item, comment: textarea.value.trim() }
            : item);

        if (commitEvents(candidate, 'Note saved.')) {
            editingCommentIds.delete(eventId);
            render();
        }
    }

    function focusComment(eventId) {
        window.requestAnimationFrame(() => {
            document.querySelector(`[data-comment-form="${cssEscape(eventId)}"] textarea`)?.focus();
        });
    }

    function openEventModal(eventId = '', options = {}) {
        const duplicate = options.duplicate === true;
        const source = events.find((event) => event.id === eventId);
        elements.form.reset();
        elements.formError.hidden = true;
        elements.formError.textContent = '';
        pendingImageDataUrl = '';

        if (source) {
            // A duplicate keeps everything except the identity and the date, so the
            // teacher only has to choose when the copy happens.
            elements.modalTitle.textContent = duplicate ? 'Duplicate Event' : 'Edit Event';
            elements.eventId.value = duplicate ? '' : source.id;
            elements.title.value = source.title;
            elements.category.value = source.category;
            elements.startDate.value = duplicate ? formatDateKey(new Date()) : source.startDate;
            elements.startTime.value = source.startTime || '';
            elements.duration.value = source.durationMinutes || '';
            elements.description.value = source.description || '';
            elements.showCountdown.checked = source.showCountdown;
            pendingImageDataUrl = source.imageDataUrl || '';
        } else {
            elements.modalTitle.textContent = 'Add Event';
            elements.eventId.value = '';
            elements.startDate.value = formatDateKey(selectedDate);
        }

        updateImagePreview();
        lastFocusedElement = document.activeElement;
        elements.modal.hidden = false;
        document.body.classList.add('cc-modal-open');
        window.setTimeout(() => (duplicate ? elements.startDate : elements.title).focus(), 0);
    }

    function closeEventModal() {
        if (elements.modal.hidden) return;
        elements.modal.hidden = true;
        document.body.classList.remove('cc-modal-open');
        elements.image.value = '';
        lastFocusedElement?.focus();
    }

    function saveEventFromForm(event) {
        event.preventDefault();
        const title = elements.title.value.trim();
        const category = elements.category.value;
        const startDate = elements.startDate.value;

        if (!title || !VALID_CATEGORIES.has(category) || !isValidDateKey(startDate)) {
            elements.formError.textContent = 'Enter a title, choose a category, and select a valid date.';
            elements.formError.hidden = false;
            return;
        }

        const startTime = TIME_PATTERN.test(elements.startTime.value) ? elements.startTime.value : '';
        const parsedDuration = Number.parseInt(elements.duration.value, 10);
        const durationMinutes = startTime && Number.isInteger(parsedDuration) && parsedDuration > 0
            ? parsedDuration
            : null;
        const existing = events.find((item) => item.id === elements.eventId.value);
        const calendarEvent = {
            id: existing?.id || createId(),
            title,
            description: elements.description.value.trim(),
            category,
            startDate,
            startTime,
            durationMinutes,
            imageDataUrl: pendingImageDataUrl,
            showCountdown: elements.showCountdown.checked,
            comment: existing?.comment || '',
            createdAt: existing?.createdAt || new Date().toISOString()
        };

        const candidate = existing
            ? events.map((item) => item.id === existing.id ? calendarEvent : item)
            : [...events, calendarEvent];

        if (commitEvents(candidate, existing ? 'Event updated.' : 'Event added.')) {
            selectedDate = parseDateKey(startDate);
            closeEventModal();
            render();
        }
    }

    function deleteEvent(eventId) {
        const calendarEvent = events.find((item) => item.id === eventId);
        if (!calendarEvent) return;
        if (!window.confirm(`Delete "${calendarEvent.title}"? This cannot be undone.`)) return;

        const candidate = events.filter((item) => item.id !== eventId);
        if (commitEvents(candidate, 'Event deleted.')) {
            editingCommentIds.delete(eventId);
            render();
        }
    }

    function handleImageSelection() {
        const [file] = elements.image.files;
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            elements.formError.textContent = 'Choose a valid image file.';
            elements.formError.hidden = false;
            elements.image.value = '';
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            pendingImageDataUrl = typeof reader.result === 'string' ? reader.result : '';
            updateImagePreview();
            elements.formError.hidden = true;
        });
        reader.addEventListener('error', () => {
            elements.formError.textContent = 'The selected image could not be read.';
            elements.formError.hidden = false;
        });
        reader.readAsDataURL(file);
    }

    function removePendingImage() {
        pendingImageDataUrl = '';
        elements.image.value = '';
        updateImagePreview();
    }

    function updateImagePreview() {
        const hasImage = Boolean(pendingImageDataUrl);
        elements.imagePreview.hidden = !hasImage;
        elements.imagePreviewImg.src = hasImage ? pendingImageDataUrl : '';
    }

    function commitEvents(candidate, successMessage) {
        const sortedCandidate = candidate.map(normalizeEvent).sort(compareEvents);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedCandidate));
            events = sortedCandidate;
            if (successMessage) showStatus(successMessage, 'success');
            return true;
        } catch (error) {
            const quotaMessage = error?.name === 'QuotaExceededError'
                ? 'Browser storage is full. Remove or reduce event images, then try again.'
                : 'Events could not be saved in this browser.';
            showStatus(quotaMessage, 'error', false);
            if (!elements.modal.hidden) {
                elements.formError.textContent = quotaMessage;
                elements.formError.hidden = false;
            }
            return false;
        }
    }

    function exportEvents() {
        const json = JSON.stringify(events, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `class-events-backup-${formatDateKey(new Date())}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showStatus('Events exported.', 'success');
    }

    async function importEvents() {
        const [file] = elements.importInput.files;
        elements.importInput.value = '';
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            applyImportedEvents(parsed, {
                confirmMessage: 'Importing will replace all current events. Continue?',
                successMessage: 'Events imported successfully.',
                errorPrefix: 'Import failed'
            });
        } catch (error) {
            showStatus('Import failed: the selected file is not valid JSON.', 'error', false);
        }
    }

    function applyImportedEvents(parsed, options = {}) {
        const {
            confirmMessage = 'Loading will replace all current events. Continue?',
            successMessage = 'Events loaded successfully.',
            errorPrefix = 'Load failed',
            throwOnFailure = false
        } = options;

        const validation = validateEventsArray(parsed);
        if (!validation.valid) {
            const message = `${errorPrefix}: ${validation.message}`;
            if (!throwOnFailure) showStatus(message, 'error', false);
            if (throwOnFailure) throw new Error(validation.message);
            return false;
        }

        if (!window.confirm(confirmMessage)) {
            if (throwOnFailure) throw new Error('Load cancelled');
            return false;
        }

        if (!commitEvents(parsed, throwOnFailure ? '' : successMessage)) {
            if (throwOnFailure) throw new Error('Could not save loaded events locally.');
            return false;
        }

        editingCommentIds.clear();
        render();
        return true;
    }

    function setupDriveSync() {
        if (!elements.driveButton) return;

        if (typeof GoogleDriveService === 'undefined') {
            elements.driveButton.addEventListener('click', () => {
                showStatus('Google Drive is unavailable. Check your connection and reload the page.', 'error', false);
            });
            return;
        }

        const driveService = new GoogleDriveService({
            folderName: 'ESL - Class Calendar',
            fileExtension: '.json',
            onSave: () => events,
            onLoad: (data) => {
                applyImportedEvents(data, {
                    confirmMessage: 'Loading from Drive will replace all current events. Continue?',
                    successMessage: 'Events loaded from Google Drive.',
                    errorPrefix: 'Drive load failed',
                    throwOnFailure: true
                });
            },
            onNotify: (message, type) => {
                const statusType = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
                showStatus(message, statusType, type !== 'error');
            }
        });

        elements.driveButton.addEventListener('click', () => {
            driveService.openModal();
            window.setTimeout(() => {
                const filenameInput = document.getElementById('gds-filename');
                if (filenameInput && !filenameInput.value) {
                    filenameInput.value = `class-events-backup-${formatDateKey(new Date())}`;
                }
            }, 400);
        });
    }

    function validateEventsArray(value) {
        if (!Array.isArray(value)) {
            return { valid: false, message: 'the backup must contain an array of events.' };
        }

        const ids = new Set();
        for (let index = 0; index < value.length; index += 1) {
            const event = value[index];
            const label = `event ${index + 1}`;
            if (!event || typeof event !== 'object' || Array.isArray(event)) {
                return { valid: false, message: `${label} is not an object.` };
            }
            if (typeof event.id !== 'string' || !event.id.trim() || ids.has(event.id)) {
                return { valid: false, message: `${label} has a missing or duplicate ID.` };
            }
            ids.add(event.id);
            if (typeof event.title !== 'string' || !event.title.trim()) {
                return { valid: false, message: `${label} has no title.` };
            }
            if (!VALID_CATEGORIES.has(event.category)) {
                return { valid: false, message: `${label} has an unknown category.` };
            }
            if (!isValidDateKey(event.startDate)) {
                return { valid: false, message: `${label} has an invalid date.` };
            }
            if (event.startTime != null && event.startTime !== '' && !TIME_PATTERN.test(event.startTime)) {
                return { valid: false, message: `${label} has an invalid time.` };
            }
            if (event.durationMinutes != null &&
                (!Number.isInteger(event.durationMinutes) || event.durationMinutes <= 0)) {
                return { valid: false, message: `${label} has an invalid duration.` };
            }
            if (typeof event.showCountdown !== 'boolean') {
                return { valid: false, message: `${label} has an invalid countdown setting.` };
            }
            if (typeof event.createdAt !== 'string' || Number.isNaN(Date.parse(event.createdAt))) {
                return { valid: false, message: `${label} has an invalid creation timestamp.` };
            }
            for (const field of ['description', 'imageDataUrl', 'comment']) {
                if (event[field] != null && typeof event[field] !== 'string') {
                    return { valid: false, message: `${label} has an invalid ${field} value.` };
                }
            }
            if (event.imageDataUrl && !event.imageDataUrl.startsWith('data:image/')) {
                return { valid: false, message: `${label} contains an invalid image.` };
            }
        }

        return { valid: true, message: '' };
    }

    function normalizeEvent(event) {
        const hasTime = typeof event.startTime === 'string' && TIME_PATTERN.test(event.startTime);
        return {
            id: event.id,
            title: event.title.trim(),
            description: typeof event.description === 'string' ? event.description : '',
            category: event.category,
            startDate: event.startDate,
            startTime: hasTime ? event.startTime : '',
            durationMinutes: hasTime && Number.isInteger(event.durationMinutes) && event.durationMinutes > 0
                ? event.durationMinutes
                : null,
            imageDataUrl: typeof event.imageDataUrl === 'string' ? event.imageDataUrl : '',
            showCountdown: event.showCountdown === true,
            comment: typeof event.comment === 'string' ? event.comment : '',
            createdAt: event.createdAt
        };
    }

    function updateCountdowns() {
        const now = new Date();
        document.querySelectorAll('[data-countdown-id]').forEach((element) => {
            const event = findEvent(element.dataset.countdownId);
            if (!event || !event.showCountdown || eventHasPassed(event, now)) {
                render();
                return;
            }

            const difference = getEventStart(event) - now;
            if (difference <= 0) {
                element.remove();
                return;
            }

            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-hourglass-start';
            icon.setAttribute('aria-hidden', 'true');
            element.replaceChildren(icon, document.createTextNode(` ${formatCountdown(difference)}`));
        });
    }

    function formatCountdown(milliseconds) {
        const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
            return `in ${days} ${days === 1 ? 'day' : 'days'}, ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        }
        return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }

    function eventsForDate(dateKey) {
        return [...events, ...birthdayEntries]
            .filter((event) => event.startDate === dateKey)
            .sort(compareEvents);
    }

    function findEvent(eventId) {
        return events.find((item) => item.id === eventId)
            || birthdayEntries.find((item) => item.id === eventId);
    }

    function compareEvents(first, second) {
        const dateComparison = first.startDate.localeCompare(second.startDate);
        if (dateComparison !== 0) return dateComparison;
        if (!first.startTime && second.startTime) return -1;
        if (first.startTime && !second.startTime) return 1;
        const timeComparison = (first.startTime || '').localeCompare(second.startTime || '');
        if (timeComparison !== 0) return timeComparison;
        return first.createdAt.localeCompare(second.createdAt);
    }

    function getEventStart(event) {
        const date = parseDateKey(event.startDate);
        if (event.startTime && TIME_PATTERN.test(event.startTime)) {
            const [hours, minutes] = event.startTime.split(':').map(Number);
            date.setHours(hours, minutes, 0, 0);
        }
        return date;
    }

    function getEventEnd(event) {
        const start = getEventStart(event);
        if (!event.startTime) {
            start.setHours(23, 59, 59, 999);
            return start;
        }
        if (event.durationMinutes) {
            start.setMinutes(start.getMinutes() + event.durationMinutes);
        }
        return start;
    }

    function eventHasPassed(event, now = new Date()) {
        return getEventEnd(event) < now;
    }

    function parseDateKey(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function isValidDateKey(dateKey) {
        if (typeof dateKey !== 'string' || !DATE_PATTERN.test(dateKey)) return false;
        const date = parseDateKey(dateKey);
        return formatDateKey(date) === dateKey;
    }

    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatFullDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date);
    }

    function formatTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const date = new Date(2000, 0, 1, hours, minutes);
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    function buildDayAriaLabel(date, eventCount) {
        const countLabel = eventCount === 1 ? '1 event' : `${eventCount} events`;
        return `${formatFullDate(date)}, ${countLabel}. Open day view.`;
    }

    function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function startOfWeek(date) {
        const start = startOfDay(date);
        start.setDate(start.getDate() - start.getDay());
        return start;
    }

    function addDays(date, amount) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

    function cssEscape(value) {
        if (window.CSS?.escape) return window.CSS.escape(value);
        return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }
})();
