/**
 * Grade Sheets Tool – Phase 1 + 2 + 3
 * Phase 1: Dashboard, LocalStorage CRUD, New Sheet modal, Delete confirm
 * Phase 2: Grid Editor, Add/Remove activities, Inline grade input, Color-coded cells,
 *          Row highlight, Drag-to-reorder, Hide/Show columns, Descriptions panel
 * Phase 3: Weighted averages, Fail-risk badges, Scale config, Missing grades report, Completion badge
 */
(function () {
  "use strict";

  const STORAGE_KEY = "gradeSheets";
  const FILTER_STORAGE_KEY = "gradeSheetsDashboardFilters";
  const CATEGORIES = ["cognitiva", "laboral", "ciudadana"];
  const CAT_LABELS = {
    cognitiva: "Cognitiva",
    laboral: "Laboral",
    ciudadana: "Ciudadana",
  };
  const CAT_WEIGHTS = { cognitiva: 0.35, laboral: 0.35, ciudadana: 0.3 };

  let sheets = [];
  let selectedIds = new Set();
  let pendingDeleteId = null;
  let currentSheetId = null;
  let highlightedRow = null;
  let dragSrcColId = null;

  // ── DOM refs – Dashboard ─────────────────────────────
  const $ = (id) => document.getElementById(id);
  const $dashboardView = $("gs-dashboard-view");
  const $editorView = $("gs-editor-view");
  const $dashboardGrid = $("gs-dashboard-grid");
  const $dashboardFilters = $("gs-dashboard-filters");
  const $filterSearch = $("gs-filter-search");
  const $filterSubject = $("gs-filter-subject");
  const $filterCourse = $("gs-filter-course");
  const $filterTerm = $("gs-filter-term");
  const $filterSort = $("gs-filter-sort");
  const $filterClearBtn = $("gs-filter-clear-btn");
  const $filterSummary = $("gs-filter-summary");
  const $emptyState = $("gs-empty-state");
  const $filterEmptyState = $("gs-filter-empty-state");
  const $filterEmptyClear = $("gs-filter-empty-clear");
  const $newSheetBtn = $("gs-new-sheet-btn");
  const $exportSelectedBtn = $("gs-export-selected-btn");
  const $driveBtn = $("gs-btn-drive");
  const $backToDashboard = $("gs-back-to-dashboard");
  const $editorTitle = $("gs-editor-title");
  const $modalOverlay = $("gs-modal-overlay");
  const $modalClose = $("gs-modal-close");
  const $modalCancel = $("gs-modal-cancel");
  const $modalCreate = $("gs-modal-create");
  const $fieldTeacher = $("gs-field-teacher");
  const $fieldSubject = $("gs-field-subject");
  const $fieldIcon = $("gs-field-icon");
  const $fieldHeaderColor = $("gs-field-header-color");
  const $fieldGroup = $("gs-field-group");
  const $fieldTerm = $("gs-field-term");
  const $deleteOverlay = $("gs-delete-overlay");
  const $deleteName = $("gs-delete-name");
  const $deleteConfirm = $("gs-delete-confirm");

  // ── DOM refs – Editor ─────────────────────────────────
  const $infoTeacher = $("gs-info-teacher");
  const $infoSubject = $("gs-info-subject");
  const $infoGroup = $("gs-info-group");
  const $infoTerm = $("gs-info-term");
  const $thead = $("gs-grade-thead");
  const $tbody = $("gs-grade-tbody");
  const $gridEmpty = $("gs-grid-empty");
  const $descriptionsPanel = $("gs-descriptions-panel");
  const $descriptionsList = $("gs-descriptions-list");
  const $toggleDescriptions = $("gs-toggle-descriptions");

  // ── DOM refs – Phase 3 ─────────────────────────────────
  const $exportCsvBtn = $("gs-export-csv-btn");
  const $missingBtn = $("gs-missing-report-btn");
  const $missingOverlay = $("gs-missing-overlay");
  const $missingContent = $("gs-missing-content");
  const $scaleConfigBtn = $("gs-scale-config-btn");
  const $scaleOverlay = $("gs-scale-overlay");
  const $editPmax = $("gs-edit-pmax");
  const $editExig = $("gs-edit-exig");
  const $editNmin = $("gs-edit-nmin");
  const $editNmax = $("gs-edit-nmax");
  const $editNapr = $("gs-edit-napr");
  const $editImportScale = $("gs-edit-import-scale");
  const $scaleSave = $("gs-scale-save");

  // ── DOM refs – Phase 6 ─────────────────────────────────
  const $toggleViewBtn = $("gs-toggle-view");
  const $actSettingsOverlay = $("gs-activity-settings-overlay");
  const $actSettingsClose = document.querySelectorAll(".gs-act-settings-close");
  const $actSettingsSave = $("gs-act-settings-save");
  const $actScaleSelect = $("gs-act-scale-select");
  const $actScalePreview = $("gs-act-scale-preview");
  const $actSettingsLabel = $("gs-act-settings-label");

  // ── DOM refs – Phase 7 ─────────────────────────────────
  const $removeDecimalToggle = $("gs-remove-decimal-toggle");
  const $clearGradesBtn = $("gs-clear-grades-btn");
  const $editSheetInfoBtn = $("gs-edit-sheet-info-btn");

  // ── DOM refs – Phase 7 (Edit Sheet Info) ───────────────
  const $editInfoOverlay = $("gs-edit-info-overlay");
  const $editInfoClose = document.querySelectorAll(".gs-edit-info-close");
  const $editInfoSave = $("gs-edit-info-save");
  const $editInfoTeacher = $("gs-edit-info-teacher");
  const $editInfoSubject = $("gs-edit-info-subject");
  const $editInfoIcon = $("gs-edit-info-icon");
  const $editInfoHeaderColor = $("gs-edit-info-header-color");
  const $editInfoGroup = $("gs-edit-info-group");
  const $editInfoTerm = $("gs-edit-info-term");

  // ── DOM refs – Edit Description ───────────────────────
  const $editDescOverlay = $("gs-edit-desc-overlay");
  const $editDescClose = document.querySelectorAll(".gs-edit-desc-close");
  const $editDescSave = $("gs-edit-desc-save");
  const $editDescLabel = $("gs-edit-desc-label");
  const $editDescCategory = $("gs-edit-desc-category");

  // ── DOM refs – Phase 8 (Import Sheet Data) ────────────
  const $importSheetDataBtn = $("gs-import-sheet-data-btn");
  const $importOverlay = $("gs-import-overlay");
  const $importCloseBtn = $("gs-import-close-btn");
  const $importCancelBtn = $("gs-import-cancel-btn");
  const $importExecuteBtn = $("gs-import-execute-btn");
  const $importSourceSelect = $("gs-import-source-select");
  const $importActivityContainer = $("gs-import-activity-container");
  const $importActivitySelect = $("gs-import-activity-select");
  const $importModeRadios = document.getElementsByName("gs-import-mode");

  // ── DOM refs – Upload CSV Grades ──────────────────────
  const $uploadGradesBtn = $("gs-upload-grades-btn");
  const $uploadOverlay = $("gs-upload-overlay");
  const $uploadClose = document.querySelectorAll(".gs-upload-close");
  const $uploadFileInput = $("gs-upload-file-input");
  const $uploadFileName = $("gs-upload-file-name");
  const $uploadPreview = $("gs-upload-preview");
  const $uploadImportBtn = $("gs-upload-import-btn");
  const $uploadValueTypeRadios = document.getElementsByName(
    "gs-upload-value-type",
  );

  // Export Modal DOM refs
  const $exportOverlay = $("gs-export-overlay");
  const $exportClose = $("gs-export-close");
  const $exportCancel = $("gs-export-cancel");
  const $exportExecuteBtn = $("gs-export-execute-btn");
  const $exportIncHeaders = $("gs-export-inc-headers");
  const $exportIncScores = $("gs-export-inc-scores");
  const $exportIncGrades = $("gs-export-inc-grades");
  const $exportDecimals = $("gs-export-decimals");

  let editingActId = null;
  let editingActCat = null;
  let isGradesView = false;
  let removeDecimal = false;
  let pendingCsvImport = null;
  let pendingExportType = null; // 'current' or 'selected'
  let dashboardFilters = {
    search: "",
    subject: "",
    course: "",
    term: "",
    sort: "recent",
  };

  // ══════════════════════════════════════════════════════
  //                    STORAGE
  // ══════════════════════════════════════════════════════
  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
  }
  function loadFromStorage() {
    try {
      sheets = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      sheets = [];
    }
  }
  function generateId() {
    return (
      "gs_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }
  function getSheet() {
    return sheets.find((s) => s.id === currentSheetId) || null;
  }

  // ══════════════════════════════════════════════════════
  //                    HELPERS
  // ══════════════════════════════════════════════════════
  function getStudentCount(g) {
    return typeof STUDENT_GROUPS !== "undefined" && STUDENT_GROUPS[g]
      ? STUDENT_GROUPS[g].length
      : 0;
  }
  function getStudentNames(g) {
    return typeof STUDENT_GROUPS !== "undefined" && STUDENT_GROUPS[g]
      ? STUDENT_GROUPS[g]
      : [];
  }

  function getAllActivities(sheet) {
    const c = sheet.categories || {};
    const all = [];
    CATEGORIES.forEach((cat) =>
      (c[cat] || []).forEach((a) => all.push({ ...a, category: cat })),
    );
    return all;
  }
  function getAllActivityIds(sheet) {
    return getAllActivities(sheet).map((a) => a.id);
  }

  function getCompletionPercent(sheet) {
    const students = getStudentNames(sheet.group);
    const aids = getAllActivityIds(sheet);
    if (!students.length || !aids.length) return 0;
    const total = students.length * aids.length;
    let filled = 0;
    const grades = sheet.grades || {};
    students.forEach((name) => {
      const row = grades[name] || {};
      aids.forEach((aid) => {
        if (row[aid] != null && row[aid] !== "") filled++;
      });
    });
    return Math.round((filled / total) * 100);
  }

  // ══════════════════════════════════════════════════════
  //              GOOGLE DRIVE INTEGRATION
  // ══════════════════════════════════════════════════════
  const driveService = window.GoogleDriveService
    ? new window.GoogleDriveService({
        folderName: "ESL Platform Grade Sheets",
        fileExtension: ".json",
        onSave: () => sheets,
        onLoad: (data) => {
          if (Array.isArray(data)) {
            sheets = data;
            saveToStorage();
            renderDashboard();
            if (currentSheetId) renderGrid();
          } else {
            showToast("Invalid data format received from Drive.", "error");
          }
        },
        onNotify: (msg, type) => showToast(msg, type),
      })
    : null;

  function escHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function showToast(msg, type = "info") {
    const existing = document.querySelector(".gs-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = `gs-toast ${type}`;
    const icon =
      type === "success"
        ? "fa-circle-check"
        : type === "error"
          ? "fa-circle-xmark"
          : "fa-circle-info";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${escHtml(msg)}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => toast.classList.add("show")),
    );
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  function normalizeHeaderColor(color) {
    return /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#2c1f56";
  }

  function normalizeIcon(icon) {
    const allowed = [
      "fa-microchip",
      "fa-flask",
      "fa-book-open",
      "fa-language",
      "fa-pen-nib",
      "fa-table-columns",
    ];
    return allowed.includes(icon) ? icon : "fa-table-columns";
  }

  function setIconPickerValue(hiddenInput, icon) {
    if (!hiddenInput) return;
    hiddenInput.value = normalizeIcon(icon);
    const picker = document.querySelector(
      `.gs-icon-picker[data-target="${hiddenInput.id}"]`,
    );
    if (!picker) return;
    picker.querySelectorAll(".gs-icon-option").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.icon === hiddenInput.value);
    });
  }

  function setColorPickerValue(input, color) {
    if (!input) return;
    input.value = normalizeHeaderColor(color);
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

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

  function inverseCalculateGrade(grade, pmax, exig, nmin, nmax, napr) {
    if (grade <= nmin) return 0;
    if (grade >= nmax) return pmax;
    const eScore = pmax * (exig / 100);

    let score = 0;
    if (grade < napr) {
      score = ((grade - nmin) * eScore) / (napr - nmin);
    } else {
      score = ((grade - napr) * (pmax - eScore)) / (nmax - napr) + eScore;
    }
    return score;
  }

  function gradeColorFromGrade(grade, sheet) {
    if (grade == null || grade === "") return "";
    const g = parseFloat(grade);
    if (isNaN(g)) return "";
    const pass = sheet.napr;
    const margin = (sheet.nmax - sheet.nmin) * 0.05;
    if (g < pass) return "gs-fail";
    if (g < pass + margin) return "gs-border";
    return "gs-pass";
  }

  function getSavedScales() {
    try {
      const data = JSON.parse(localStorage.getItem("esl_grading_scale_data"));
      if (data && Array.isArray(data.savedScales)) return data.savedScales;
    } catch (e) {}
    return [];
  }

  function getScaleForActivity(act, sheet) {
    if (act && act.scaleId && act.scaleId !== "global") {
      const scales = getSavedScales();
      const saved = scales.find((s) => s.id === act.scaleId);
      if (saved) return saved;
    }
    return {
      name: "Default Sheet Scale",
      pmax: act && act.maxScore ? act.maxScore : sheet.pmax || 50,
      exig: sheet.exig,
      nmin: sheet.nmin,
      nmax: sheet.nmax,
      napr: sheet.napr,
    };
  }

  function gradeColor(value, sheet, act) {
    if (value == null || value === "") return "";
    const v = parseFloat(value);
    if (isNaN(v)) return "";

    const sc = getScaleForActivity(act, sheet);
    const grade = calculateGrade(
      v,
      sc.pmax,
      sc.exig,
      sc.nmin,
      sc.nmax,
      sc.napr,
    );
    // Margin based on activity's scale
    const margin = (sc.nmax - sc.nmin) * 0.05;
    if (grade < sc.napr) return "gs-fail";
    if (grade < sc.napr + margin) return "gs-border";
    return "gs-pass";
  }

  // ── Phase 6: Weighted Average Calculation (From Grades) ────────────
  function calcWeightedAvg(studentName, sheet) {
    const grades = sheet.grades[studentName] || {};
    const cats = sheet.categories || {};
    let weightedSum = 0;
    let totalWeight = 0;
    let filledCats = 0;

    CATEGORIES.forEach((cat) => {
      const acts = cats[cat] || [];
      if (acts.length === 0) return;
      let sumGrades = 0,
        count = 0;
      acts.forEach((a) => {
        const v = parseFloat(grades[a.id]);
        if (!isNaN(v)) {
          const sc = getScaleForActivity(a, sheet);
          const grade = calculateGrade(
            v,
            sc.pmax,
            sc.exig,
            sc.nmin,
            sc.nmax,
            sc.napr,
          );
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
    if (!students.length || !allActs.length)
      return {
        missing: [],
        studentsWithGrades: 0,
        totalCells: 0,
        filledCells: 0,
      };

    const grades = sheet.grades || {};
    let studentsWithGrades = 0;
    const missing = [];
    let filledCells = 0;

    students.forEach((name) => {
      const row = grades[name] || {};
      const filled = allActs.filter(
        (a) => row[a.id] != null && row[a.id] !== "",
      );
      filledCells += filled.length;
      if (filled.length > 0) studentsWithGrades++;

      const missingActs = allActs.filter(
        (a) => row[a.id] == null || row[a.id] === "",
      );
      if (missingActs.length > 0 && filled.length > 0) {
        // Only report missing for students who have at least 1 grade
        missing.push({ name, acts: missingActs });
      }
    });

    return {
      missing,
      studentsWithGrades,
      totalCells: students.length * allActs.length,
      filledCells,
    };
  }

  // ══════════════════════════════════════════════════════
  //              POPULATE GROUP DROPDOWN
  // ══════════════════════════════════════════════════════
  function populateGroupDropdown() {
    $fieldGroup.innerHTML = "";
    if (typeof STUDENT_GROUPS === "undefined") return;
    Object.keys(STUDENT_GROUPS)
      .sort()
      .forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g + " (" + STUDENT_GROUPS[g].length + " students)";
        $fieldGroup.appendChild(opt);
      });
  }

  // ══════════════════════════════════════════════════════
  //                DASHBOARD RENDERING
  // ══════════════════════════════════════════════════════
  function loadDashboardFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY));
      if (saved && typeof saved === "object") {
        dashboardFilters = {
          search: saved.search || "",
          subject: saved.subject || "",
          course: saved.course || "",
          term: saved.term || "",
          sort: saved.sort || "recent",
        };
      }
    } catch (e) {}
  }

  function saveDashboardFilters() {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(dashboardFilters));
  }

  function syncDashboardFilterControls() {
    if ($filterSearch) $filterSearch.value = dashboardFilters.search;
    if ($filterSubject) $filterSubject.value = dashboardFilters.subject;
    if ($filterCourse) $filterCourse.value = dashboardFilters.course;
    if ($filterTerm) $filterTerm.value = dashboardFilters.term;
    if ($filterSort) $filterSort.value = dashboardFilters.sort;
    if ($filterClearBtn)
      $filterClearBtn.disabled = !hasActiveDashboardFilters();
  }

  function hasActiveDashboardFilters() {
    return !!(
      dashboardFilters.search.trim() ||
      dashboardFilters.subject ||
      dashboardFilters.course ||
      dashboardFilters.term ||
      dashboardFilters.sort !== "recent"
    );
  }

  function populateDashboardFilterOptions() {
    const subjects = [
      ...new Set(sheets.map((s) => s.subject).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    const courses = [
      ...new Set(sheets.map((s) => s.group).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    const terms = [...new Set(sheets.map((s) => s.term).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );

    const fillSelect = ($el, values, allLabel) => {
      if (!$el) return;
      const current = $el.value;
      $el.innerHTML = `<option value="">${allLabel}</option>`;
      values.forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        $el.appendChild(opt);
      });
      if (values.includes(current)) $el.value = current;
      else $el.value = "";
    };

    fillSelect($filterSubject, subjects, "All subjects");
    fillSelect($filterCourse, courses, "All courses");
    fillSelect($filterTerm, terms, "All terms");

    if (
      dashboardFilters.subject &&
      !subjects.includes(dashboardFilters.subject)
    )
      dashboardFilters.subject = "";
    if (dashboardFilters.course && !courses.includes(dashboardFilters.course))
      dashboardFilters.course = "";
    if (dashboardFilters.term && !terms.includes(dashboardFilters.term))
      dashboardFilters.term = "";
  }

  function getFilteredSortedSheets() {
    const query = normalizeText(dashboardFilters.search);
    let list = sheets.filter((sheet) => {
      if (
        dashboardFilters.subject &&
        sheet.subject !== dashboardFilters.subject
      )
        return false;
      if (dashboardFilters.course && sheet.group !== dashboardFilters.course)
        return false;
      if (dashboardFilters.term && sheet.term !== dashboardFilters.term)
        return false;
      if (!query) return true;
      const haystack = normalizeText(
        [
          sheet.subject,
          sheet.group,
          sheet.term,
          sheet.teacherName,
          sheet.subject + " " + sheet.group,
        ].join(" "),
      );
      return haystack.includes(query);
    });

    list = list.map((sheet) => ({ sheet, pct: getCompletionPercent(sheet) }));

    if (dashboardFilters.sort === "completion-desc") {
      list.sort(
        (a, b) =>
          b.pct - a.pct || (b.sheet.updatedAt || 0) - (a.sheet.updatedAt || 0),
      );
    } else if (dashboardFilters.sort === "completion-asc") {
      list.sort(
        (a, b) =>
          a.pct - b.pct || (b.sheet.updatedAt || 0) - (a.sheet.updatedAt || 0),
      );
    } else {
      list.sort(
        (a, b) =>
          (b.sheet.updatedAt || b.sheet.createdAt || 0) -
          (a.sheet.updatedAt || a.sheet.createdAt || 0),
      );
    }

    return list;
  }

  function updateDashboardFilterSummary(visibleCount, totalCount) {
    if (!$filterSummary) return;
    if (totalCount === 0) {
      $filterSummary.textContent = "";
      return;
    }
    if (hasActiveDashboardFilters()) {
      $filterSummary.textContent = `Showing ${visibleCount} of ${totalCount} sheet${totalCount === 1 ? "" : "s"}`;
    } else {
      $filterSummary.textContent = `${totalCount} sheet${totalCount === 1 ? "" : "s"}`;
    }
  }

  function clearDashboardFilters() {
    dashboardFilters = {
      search: "",
      subject: "",
      course: "",
      term: "",
      sort: "recent",
    };
    saveDashboardFilters();
    syncDashboardFilterControls();
    renderDashboard();
  }

  function onDashboardFilterChange() {
    dashboardFilters.search = $filterSearch ? $filterSearch.value : "";
    dashboardFilters.subject = $filterSubject ? $filterSubject.value : "";
    dashboardFilters.course = $filterCourse ? $filterCourse.value : "";
    dashboardFilters.term = $filterTerm ? $filterTerm.value : "";
    dashboardFilters.sort = $filterSort ? $filterSort.value : "recent";
    saveDashboardFilters();
    syncDashboardFilterControls();
    renderDashboard();
  }

  function renderDashboard() {
    $dashboardGrid.innerHTML = "";

    if (!sheets.length) {
      if ($dashboardFilters) $dashboardFilters.style.display = "none";
      $emptyState.style.display = "";
      if ($filterEmptyState) $filterEmptyState.style.display = "none";
      $dashboardGrid.style.display = "none";
      $exportSelectedBtn.disabled = true;
      return;
    }

    populateDashboardFilterOptions();
    syncDashboardFilterControls();
    if ($dashboardFilters) $dashboardFilters.style.display = "";

    const filtered = getFilteredSortedSheets();
    updateDashboardFilterSummary(filtered.length, sheets.length);

    if (!filtered.length) {
      $emptyState.style.display = "none";
      if ($filterEmptyState) $filterEmptyState.style.display = "";
      $dashboardGrid.style.display = "none";
      updateExportBtn();
      return;
    }

    $emptyState.style.display = "none";
    if ($filterEmptyState) $filterEmptyState.style.display = "none";
    $dashboardGrid.style.display = "";

    filtered.forEach(({ sheet, pct }, idx) => {
      const sc = getStudentCount(sheet.group);
      const ac = getAllActivityIds(sheet).length;
      const sel = selectedIds.has(sheet.id);
      const headerColor = normalizeHeaderColor(sheet.headerColor);
      const icon = normalizeIcon(sheet.icon);

      const card = document.createElement("div");
      card.className = "gs-card" + (sel ? " selected" : "");
      card.style.animationDelay = idx * 0.06 + "s";

      // Completion badge
      const badgeHtml =
        pct === 100 && ac > 0
          ? '<span class="gs-card-badge complete"><i class="fa-solid fa-check"></i> Complete</span>'
          : "";

      card.innerHTML = `
                <input type="checkbox" class="gs-card-checkbox" data-id="${sheet.id}" ${sel ? "checked" : ""} title="Select for export">
                ${badgeHtml}
                <div class="gs-card-actions">
                    <button class="gs-card-action-btn delete" data-id="${sheet.id}" title="Delete sheet"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="gs-card-top" style="background:${headerColor};">
                    <h3><i class="fa-solid ${icon}"></i> ${escHtml(sheet.subject)} — ${escHtml(sheet.group)}</h3>
                    <div class="gs-card-meta">
                        <span><i class="fa-solid fa-calendar-alt"></i> ${escHtml(sheet.term)} Term</span>
                        <span><i class="fa-solid fa-users"></i> ${sc} students</span>
                    </div>
                </div>
                <div class="gs-card-body">
                    <div class="gs-card-detail"><i class="fa-solid fa-chalkboard-user"></i> ${escHtml(sheet.teacherName)}</div>
                    <div class="gs-card-detail"><i class="fa-solid fa-list-check"></i> ${ac} ${ac === 1 ? "activity" : "activities"}</div>
                    <div class="gs-completion-label">${pct}% complete</div>
                    <div class="gs-completion-bar-wrap"><div class="gs-completion-bar" style="width:${pct}%"></div></div>
                </div>`;
      card.addEventListener("click", (e) => {
        if (
          e.target.closest(".gs-card-checkbox") ||
          e.target.closest(".gs-card-action-btn")
        )
          return;
        openEditor(sheet.id);
      });
      $dashboardGrid.appendChild(card);
    });

    $dashboardGrid.querySelectorAll(".gs-card-checkbox").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        e.stopPropagation();
        cb.checked
          ? selectedIds.add(cb.dataset.id)
          : selectedIds.delete(cb.dataset.id);
        cb.closest(".gs-card").classList.toggle("selected", cb.checked);
        updateExportBtn();
      });
    });
    $dashboardGrid
      .querySelectorAll(".gs-card-action-btn.delete")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          showDeleteConfirm(btn.dataset.id);
        });
      });
    updateExportBtn();
  }

  function updateExportBtn() {
    $exportSelectedBtn.disabled = selectedIds.size === 0;
  }

  // ══════════════════════════════════════════════════════
  //                NEW SHEET MODAL
  // ══════════════════════════════════════════════════════
  function openNewSheetModal() {
    $fieldTeacher.value = sheets.length
      ? sheets[sheets.length - 1].teacherName || ""
      : "";
    $fieldSubject.value = "";
    setIconPickerValue($fieldIcon, "fa-microchip");
    setColorPickerValue($fieldHeaderColor, "#2c1f56");
    $modalOverlay.style.display = "";
    setTimeout(() => $fieldSubject.focus(), 200);
  }
  function closeNewSheetModal() {
    $modalOverlay.style.display = "none";
  }

  function createSheet() {
    const subject = $fieldSubject.value.trim();
    if (!subject) {
      $fieldSubject.focus();
      $fieldSubject.style.borderColor = "#ff7675";
      setTimeout(() => ($fieldSubject.style.borderColor = ""), 1500);
      return;
    }
    sheets.push({
      id: generateId(),
      teacherName: $fieldTeacher.value.trim() || "Teacher",
      subject,
      group: $fieldGroup.value,
      term: $fieldTerm.value,
      icon: normalizeIcon($fieldIcon ? $fieldIcon.value : ""),
      headerColor: normalizeHeaderColor(
        $fieldHeaderColor ? $fieldHeaderColor.value : "",
      ),
      pmax: 50,
      exig: 60,
      nmin: 1.0,
      nmax: 5.0,
      napr: 3.0,
      categories: { cognitiva: [], laboral: [], ciudadana: [] },
      grades: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    saveToStorage();
    closeNewSheetModal();
    renderDashboard();
  }

  // ══════════════════════════════════════════════════════
  //                DELETE CONFIRM
  // ══════════════════════════════════════════════════════
  function showDeleteConfirm(id) {
    const s = sheets.find((x) => x.id === id);
    if (!s) return;
    pendingDeleteId = id;
    $deleteName.textContent = s.subject + " — " + s.group + " (" + s.term + ")";
    $deleteOverlay.style.display = "";
  }
  function closeDeleteConfirm() {
    $deleteOverlay.style.display = "none";
    pendingDeleteId = null;
  }
  function confirmDelete() {
    if (!pendingDeleteId) return;
    sheets = sheets.filter((s) => s.id !== pendingDeleteId);
    selectedIds.delete(pendingDeleteId);
    saveToStorage();
    closeDeleteConfirm();
    renderDashboard();
  }

  // ══════════════════════════════════════════════════════
  //              EDITOR – OPEN / CLOSE
  // ══════════════════════════════════════════════════════
  function openEditor(id) {
    const sheet = sheets.find((s) => s.id === id);
    if (!sheet) return;
    currentSheetId = id;
    highlightedRow = null;
    $dashboardView.style.display = "none";
    $editorView.style.display = "";
    $editorTitle.textContent =
      sheet.subject + " — " + sheet.group + " (" + sheet.term + " Term)";
    $infoTeacher.textContent = sheet.teacherName;
    $infoSubject.textContent = sheet.subject;
    $infoGroup.textContent = "Course " + sheet.group;
    $infoTerm.textContent = sheet.term + " Term";
    renderGrid();
    renderDescriptions();
  }

  function backToDashboard() {
    currentSheetId = null;
    $editorView.style.display = "none";
    $dashboardView.style.display = "";
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
    const visibleActs = allActs.filter((a) => !a.hidden);
    const hasActivities = allActs.length > 0;

    if (!hasActivities) {
      $gridEmpty.style.display = "";
      $("gs-grade-table").style.display = "none";
      renderHiddenColsBar([]);
      return;
    }
    $gridEmpty.style.display = "none";
    $("gs-grade-table").style.display = "";
    renderHiddenColsBar(allActs.filter((a) => a.hidden));

    // ── THEAD ──
    $thead.innerHTML = "";
    const catRow = document.createElement("tr");

    // Sticky # + Name (rowSpan 2)
    const th1 = document.createElement("th");
    th1.className = "gs-col-num-header";
    th1.rowSpan = 2;
    th1.textContent = "#";
    catRow.appendChild(th1);
    const th2 = document.createElement("th");
    th2.className = "gs-col-name-header";
    th2.rowSpan = 2;
    th2.textContent = "STUDENT";
    catRow.appendChild(th2);

    // Category group headers
    CATEGORIES.forEach((cat) => {
      const acts = visibleActs.filter((a) => a.category === cat);
      if (!acts.length) return;
      const th = document.createElement("th");
      th.className = "gs-cat-group-th " + cat;
      th.colSpan = acts.length;
      th.textContent = CAT_LABELS[cat];
      catRow.appendChild(th);
    });

    // Weighted Average header (rowSpan 2)
    const avgTh = document.createElement("th");
    avgTh.className = "gs-avg-header";
    avgTh.rowSpan = 2;
    avgTh.innerHTML = "WEIGHTED<br>AVG";
    catRow.appendChild(avgTh);

    $thead.appendChild(catRow);

    // Activity column headers row
    const actRow = document.createElement("tr");
    let colNum = 1;
    CATEGORIES.forEach((cat) => {
      visibleActs
        .filter((a) => a.category === cat)
        .forEach((act) => {
          const th = document.createElement("th");
          th.className = "gs-act-th";
          th.dataset.id = act.id;
          th.dataset.cat = cat;
          th.draggable = true;
          const sc = getScaleForActivity(act, sheet);
          const scaleLabel =
            act.scaleId && act.scaleId !== "global"
              ? escHtml(sc.name)
              : `/${sc.pmax}`;
          th.innerHTML = `
                    <i class="fa-solid fa-grip-vertical gs-drag-handle"></i>
                    <span class="gs-col-num">${colNum}</span>
                    <div class="gs-col-max gs-act-settings-trigger" data-id="${act.id}" title="Activity Settings">${scaleLabel}</div>
                    <button class="gs-col-delete" data-id="${act.id}" title="Remove column"><i class="fa-solid fa-xmark"></i></button>
                    <button class="gs-col-hide" data-id="${act.id}" title="Hide column"><i class="fa-solid fa-eye-slash"></i></button>`;
          th.querySelector(".gs-act-settings-trigger").addEventListener(
            "click",
            (e) => openActivitySettings(e, act.id),
          );
          th.addEventListener("dragstart", onDragStart);
          th.addEventListener("dragover", onDragOver);
          th.addEventListener("dragleave", onDragLeave);
          th.addEventListener("drop", onDrop);
          th.addEventListener("dragend", onDragEnd);
          actRow.appendChild(th);
          colNum++;
        });
    });
    $thead.appendChild(actRow);

    // ── TBODY ──
    $tbody.innerHTML = "";
    students.forEach((name, idx) => {
      const tr = document.createElement("tr");
      if (highlightedRow === name) tr.classList.add("gs-row-highlight");

      const numTd = document.createElement("td");
      numTd.className = "gs-col-num-cell";
      numTd.textContent = idx + 1;
      tr.appendChild(numTd);

      const nameTd = document.createElement("td");
      nameTd.className = "gs-col-name-cell";
      nameTd.textContent = name;
      nameTd.addEventListener("click", () => {
        highlightedRow = highlightedRow === name ? null : name;
        renderGrid();
      });
      tr.appendChild(nameTd);

      // Grade cells
      visibleActs.forEach((act) => {
        const td = document.createElement("td");
        td.className = "gs-grade-cell";
        const val = (sheet.grades[name] || {})[act.id];
        const cc = gradeColor(val, sheet, act);
        if (cc) td.classList.add(cc);
        const sc = getScaleForActivity(act, sheet);

        let displayVal = "";
        if (val != null && val !== "") {
          if (isGradesView) {
            const grade = calculateGrade(
              parseFloat(val),
              sc.pmax,
              sc.exig,
              sc.nmin,
              sc.nmax,
              sc.napr,
            );
            const rounded = (Math.round(grade * 10) / 10).toFixed(1);
            displayVal = removeDecimal ? rounded.replace(".", "") : rounded;
          } else {
            displayVal = val;
          }
        }

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.className = "gs-grade-input";
        input.value = displayVal;
        input.dataset.student = name;
        input.dataset.actId = act.id;

        input.addEventListener("change", onGradeChange);
        input.addEventListener("keydown", onGradeKeydown);

        td.appendChild(input);
        tr.appendChild(td);
      });

      // ── Phase 3: Weighted Average cell ──
      const avgTd = document.createElement("td");
      avgTd.className = "gs-avg-cell";
      const { avg, filledCats } = calcWeightedAvg(name, sheet);

      if (avg !== null) {
        const rounded = Math.round(avg * 10) / 10;
        const cc = gradeColorFromGrade(rounded, sheet);
        if (cc) avgTd.classList.add(cc);
        avgTd.innerHTML = `<strong>${rounded}</strong>`;

        // Fail-risk badge
        if (isFailRisk(name, sheet)) {
          avgTd.innerHTML +=
            ' <span class="gs-fail-risk"><i class="fa-solid fa-triangle-exclamation"></i></span>';
        }
      } else {
        avgTd.innerHTML = '<span style="color:#ccc;">—</span>';
      }
      tr.appendChild(avgTd);

      $tbody.appendChild(tr);
    });

    // Bind delete/hide
    $thead.querySelectorAll(".gs-col-delete").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeActivity(btn.dataset.id);
      }),
    );
    $thead.querySelectorAll(".gs-col-hide").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleHideActivity(btn.dataset.id, true);
      }),
    );
  }

  function renderHiddenColsBar(hiddenActs) {
    const existing = document.querySelector(".gs-hidden-cols-bar");
    if (existing) existing.remove();
    if (!hiddenActs.length) return;
    const bar = document.createElement("div");
    bar.className = "gs-hidden-cols-bar";
    bar.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hidden columns: ';
    hiddenActs.forEach((act) => {
      const btn = document.createElement("button");
      btn.className = "gs-show-col-btn";
      btn.textContent = act.label || act.id;
      btn.title = "Show column";
      btn.addEventListener("click", () => toggleHideActivity(act.id, false));
      bar.appendChild(btn);
    });
    document
      .querySelector(".gs-table-wrap")
      .insertBefore(bar, document.querySelector(".gs-table-wrap").firstChild);
  }

  // ══════════════════════════════════════════════════════
  //           GRADE INPUT HANDLERS
  // ══════════════════════════════════════════════════════
  function onGradeChange(e) {
    const input = e.target;
    const sheet = getSheet();
    if (!sheet) return;
    const name = input.dataset.student,
      actId = input.dataset.actId;

    let actObj = null;
    CATEGORIES.forEach((cat) => {
      const f = (sheet.categories[cat] || []).find((a) => a.id === actId);
      if (f) actObj = f;
    });

    let valStr = input.value.trim().replace(",", ".");
    if (valStr === "") {
      if (!sheet.grades[name]) sheet.grades[name] = {};
      delete sheet.grades[name][actId];
    } else {
      let num = parseFloat(valStr);
      if (!isNaN(num)) {
        const sc = getScaleForActivity(actObj, sheet);

        if (isGradesView) {
          if (removeDecimal && !valStr.includes(".")) num = num / 10;
          num = inverseCalculateGrade(
            num,
            sc.pmax,
            sc.exig,
            sc.nmin,
            sc.nmax,
            sc.napr,
          );
          num = Math.round(num * 100) / 100;
        }

        if (num < 0) num = 0;
        if (num > sc.pmax) num = sc.pmax;

        if (!sheet.grades[name]) sheet.grades[name] = {};
        sheet.grades[name][actId] = num;
      }
    }
    sheet.updatedAt = Date.now();
    saveToStorage();
    renderGrid();
  }

  function onGradeKeydown(e) {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const allInputs = Array.from($tbody.querySelectorAll(".gs-grade-input"));
      const idx = allInputs.indexOf(e.target);
      if (e.shiftKey) {
        if (idx > 0) allInputs[idx - 1].focus();
      } else {
        if (idx < allInputs.length - 1) allInputs[idx + 1].focus();
      }
    }
  }

  // ══════════════════════════════════════════════════════
  //         ADD / REMOVE / HIDE ACTIVITIES
  // ══════════════════════════════════════════════════════
  function addActivity(cat) {
    const sheet = getSheet();
    if (!sheet) return;
    const inp = $("gs-add-" + cat + "-input");
    const label =
      inp.value.trim() ||
      CAT_LABELS[cat] +
        " Activity " +
        ((sheet.categories[cat] || []).length + 1);
    if (!sheet.categories[cat]) sheet.categories[cat] = [];
    sheet.categories[cat].push({
      id: generateId(),
      label,
      hidden: false,
      maxScore: sheet.pmax || 50,
    });
    sheet.updatedAt = Date.now();
    saveToStorage();
    inp.value = "";
    renderGrid();
    renderDescriptions();
  }

  function removeActivity(actId) {
    const sheet = getSheet();
    if (!sheet) return;
    CATEGORIES.forEach((cat) => {
      sheet.categories[cat] = (sheet.categories[cat] || []).filter(
        (a) => a.id !== actId,
      );
    });
    Object.keys(sheet.grades).forEach(
      (name) => delete sheet.grades[name][actId],
    );
    sheet.updatedAt = Date.now();
    saveToStorage();
    renderGrid();
    renderDescriptions();
  }

  function toggleHideActivity(actId, hide) {
    const sheet = getSheet();
    if (!sheet) return;
    CATEGORIES.forEach((cat) =>
      (sheet.categories[cat] || []).forEach((a) => {
        if (a.id === actId) a.hidden = hide;
      }),
    );
    sheet.updatedAt = Date.now();
    saveToStorage();
    renderGrid();
  }

  function toggleRemoveDecimal() {
    if (!currentSheetId) return;
    removeDecimal = $removeDecimalToggle.checked;
    renderGrid();
  }

  function toggleViewMode() {
    if (!currentSheetId) return;
    isGradesView = !isGradesView;
    if (isGradesView) {
      if ($toggleViewBtn) {
        $toggleViewBtn.innerHTML =
          '<i class="fa-solid fa-exchange-alt"></i> Show Scores';
        $toggleViewBtn.classList.remove("gs-btn-secondary");
        $toggleViewBtn.classList.add("gs-btn-primary");
      }
    } else {
      if ($toggleViewBtn) {
        $toggleViewBtn.innerHTML =
          '<i class="fa-solid fa-exchange-alt"></i> Show Grades';
        $toggleViewBtn.classList.remove("gs-btn-primary");
        $toggleViewBtn.classList.add("gs-btn-secondary");
      }
    }
    renderGrid();
  }

  function clearAllGrades() {
    const sheet = getSheet();
    if (!sheet) return;
    if (
      confirm(
        "Are you sure you want to clear ALL grades in this sheet? This action cannot be undone.",
      )
    ) {
      sheet.grades = {};
      sheet.updatedAt = Date.now();
      saveToStorage();
      renderGrid();
    }
  }

  function openActivitySettings(e, actId) {
    e.stopPropagation();
    editingActId = actId;
    const sheet = getSheet();
    if (!sheet) return;
    let act = null;
    CATEGORIES.forEach((cat) => {
      const found = (sheet.categories[cat] || []).find((a) => a.id === actId);
      if (found) act = found;
    });
    if (!act) return;

    if ($actSettingsLabel) $actSettingsLabel.textContent = act.label;
    if ($actScaleSelect) {
      $actScaleSelect.innerHTML =
        '<option value="global">Default Sheet Scale</option>';
      const scales = getSavedScales();
      scales.forEach((sc) => {
        const opt = document.createElement("option");
        opt.value = sc.id;
        opt.textContent = sc.name || "Unnamed Scale";
        $actScaleSelect.appendChild(opt);
      });
      $actScaleSelect.value = act.scaleId || "global";
    }
    updateActScalePreview();
    if ($actSettingsOverlay) $actSettingsOverlay.style.display = "";
  }

  function closeActivitySettings() {
    if ($actSettingsOverlay) $actSettingsOverlay.style.display = "none";
    editingActId = null;
  }

  function updateActScalePreview() {
    if (!$actScaleSelect || !$actScalePreview) return;
    const sheet = getSheet();
    const val = $actScaleSelect.value;
    let sc;
    if (val === "global" && sheet) {
      sc = {
        pmax: sheet.pmax,
        exig: sheet.exig,
        nmin: sheet.nmin,
        nmax: sheet.nmax,
        napr: sheet.napr,
      };
    } else {
      const scales = getSavedScales();
      sc = scales.find((s) => s.id === val);
    }
    if (!sc) {
      $actScalePreview.style.display = "none";
      return;
    }
    $actScalePreview.style.display = "";
    $actScalePreview.innerHTML = `
            <strong>Max:</strong> ${sc.pmax} &nbsp;|&nbsp; <strong>Exigency:</strong> ${sc.exig}%<br>
            <strong>Grades:</strong> ${Number(sc.nmin).toFixed(1)} to ${Number(sc.nmax).toFixed(1)} &nbsp;|&nbsp; <strong>Pass:</strong> ${Number(sc.napr).toFixed(1)}
        `;
  }

  function saveActivitySettings() {
    const sheet = getSheet();
    if (!sheet || !editingActId || !$actScaleSelect) return;
    CATEGORIES.forEach((cat) => {
      const found = (sheet.categories[cat] || []).find(
        (a) => a.id === editingActId,
      );
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
  //     Phase 7: EDIT SHEET INFO MODAL
  // ══════════════════════════════════════════════════════
  function openEditSheetInfo() {
    const sheet = getSheet();
    if (!sheet) return;

    if (
      $editInfoGroup &&
      $editInfoGroup.children.length === 0 &&
      typeof STUDENT_GROUPS !== "undefined"
    ) {
      Object.keys(STUDENT_GROUPS).forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        $editInfoGroup.appendChild(opt);
      });
    }

    if ($editInfoTeacher) $editInfoTeacher.value = sheet.teacherName || "";
    if ($editInfoSubject) $editInfoSubject.value = sheet.subject || "";
    setIconPickerValue($editInfoIcon, sheet.icon || "fa-table-columns");
    setColorPickerValue($editInfoHeaderColor, sheet.headerColor || "#2c1f56");
    if ($editInfoGroup) $editInfoGroup.value = sheet.group || "";
    if ($editInfoTerm) $editInfoTerm.value = sheet.term || "First";

    if ($editInfoOverlay) $editInfoOverlay.style.display = "";
  }

  function closeEditSheetInfo() {
    if ($editInfoOverlay) $editInfoOverlay.style.display = "none";
  }

  function saveEditSheetInfo() {
    const sheet = getSheet();
    if (!sheet) return;

    const newTeacher = $editInfoTeacher.value.trim();
    const newSubject = $editInfoSubject.value.trim();
    const newGroup = $editInfoGroup.value;
    const newTerm = $editInfoTerm.value;

    if (!newTeacher || !newSubject || !newGroup) {
      showToast("Please fill in all sheet details.", "error");
      return;
    }

    sheet.teacherName = newTeacher;
    sheet.subject = newSubject;
    sheet.group = newGroup;
    sheet.term = newTerm;
    sheet.icon = normalizeIcon($editInfoIcon ? $editInfoIcon.value : "");
    sheet.headerColor = normalizeHeaderColor(
      $editInfoHeaderColor ? $editInfoHeaderColor.value : "",
    );

    sheet.updatedAt = Date.now();
    saveToStorage();
    closeEditSheetInfo();

    openEditor(currentSheetId);
  }

  // ══════════════════════════════════════════════════════
  //              DRAG-TO-REORDER COLUMNS
  // ══════════════════════════════════════════════════════
  function onDragStart(e) {
    dragSrcColId = e.currentTarget.dataset.id;
    e.currentTarget.style.opacity = "0.5";
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (e.currentTarget.dataset.id !== dragSrcColId)
      e.currentTarget.classList.add("drag-over");
  }
  function onDragLeave(e) {
    e.currentTarget.classList.remove("drag-over");
  }
  function onDrop(e) {
    e.preventDefault();
    const targetId = e.currentTarget.dataset.id,
      targetCat = e.currentTarget.dataset.cat;
    e.currentTarget.classList.remove("drag-over");
    if (!dragSrcColId || dragSrcColId === targetId) return;
    const sheet = getSheet();
    if (!sheet) return;
    let srcCat = null;
    CATEGORIES.forEach((cat) => {
      if ((sheet.categories[cat] || []).find((a) => a.id === dragSrcColId))
        srcCat = cat;
    });
    if (!srcCat || srcCat !== targetCat) return;
    const acts = sheet.categories[srcCat];
    const si = acts.findIndex((a) => a.id === dragSrcColId),
      ti = acts.findIndex((a) => a.id === targetId);
    if (si === -1 || ti === -1) return;
    const [moved] = acts.splice(si, 1);
    acts.splice(ti, 0, moved);
    sheet.updatedAt = Date.now();
    saveToStorage();
    renderGrid();
    renderDescriptions();
  }
  function onDragEnd(e) {
    e.currentTarget.style.opacity = "";
    dragSrcColId = null;
    $thead
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
  }

  // ══════════════════════════════════════════════════════
  //           DESCRIPTIONS PANEL
  // ══════════════════════════════════════════════════════
  function renderDescriptions() {
    const sheet = getSheet();
    if (!sheet) return;
    $descriptionsList.innerHTML = "";
    let num = 1;
    CATEGORIES.forEach((cat) => {
      (sheet.categories[cat] || []).forEach((act) => {
        const div = document.createElement("div");
        div.className = "gs-desc-item " + cat;
        div.innerHTML = `<span class="gs-desc-num">${num}.</span> <span class="gs-act-label-text">${escHtml(act.label)}</span><i class="fa-solid fa-pen gs-edit-act-btn" data-id="${act.id}" data-cat="${cat}" title="Edit description"></i>`;
        $descriptionsList.appendChild(div);
        num++;
      });
    });
    if (num === 1)
      $descriptionsList.innerHTML =
        '<p style="color:#b2bec3;font-size:0.85rem;font-weight:600;">No activities added yet.</p>';

    $descriptionsList.querySelectorAll(".gs-edit-act-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const actId = e.target.dataset.id;
        const cat = e.target.dataset.cat;
        openEditDescription(actId, cat);
      });
    });
  }

  function openEditDescription(actId, cat) {
    const sheet = getSheet();
    if (!sheet || !$editDescOverlay) return;
    const act = (sheet.categories[cat] || []).find((a) => a.id === actId);
    if (!act) return;
    editingActId = actId;
    editingActCat = cat;
    if ($editDescLabel) $editDescLabel.value = act.label || "";
    if ($editDescCategory) $editDescCategory.value = cat;
    $editDescOverlay.style.display = "";
    setTimeout(() => $editDescLabel && $editDescLabel.focus(), 100);
  }

  function closeEditDescription() {
    if ($editDescOverlay) $editDescOverlay.style.display = "none";
    editingActId = null;
    editingActCat = null;
  }

  function saveEditDescription() {
    const sheet = getSheet();
    if (!sheet || !editingActId || !editingActCat) return;
    const newLabel = ($editDescLabel.value || "").trim();
    const newCat = $editDescCategory.value;
    if (!newLabel) {
      showToast("Activity description cannot be empty.", "error");
      return;
    }
    if (!CATEGORIES.includes(newCat)) {
      showToast("Choose a valid category.", "error");
      return;
    }

    const oldList = sheet.categories[editingActCat] || [];
    const idx = oldList.findIndex((a) => a.id === editingActId);
    if (idx === -1) return;
    const act = oldList[idx];
    act.label = newLabel;
    if (newCat !== editingActCat) {
      oldList.splice(idx, 1);
      if (!sheet.categories[newCat]) sheet.categories[newCat] = [];
      sheet.categories[newCat].push(act);
    }
    sheet.updatedAt = Date.now();
    saveToStorage();
    closeEditDescription();
    renderGrid();
    renderDescriptions();
  }

  // ══════════════════════════════════════════════════════
  //    Phase 3: SCALE CONFIG MODAL
  // ══════════════════════════════════════════════════════
  function openScaleConfig() {
    const sheet = getSheet();
    if (!sheet) return;
    $editPmax.value = sheet.pmax || 50;
    $editExig.value = sheet.exig || 60;
    $editNmin.value = sheet.nmin || 1.0;
    $editNmax.value = sheet.nmax || 5.0;
    $editNapr.value = sheet.napr || 3.0;
    loadSavedScales($editImportScale);
    $scaleOverlay.style.display = "";
  }

  function closeScaleConfig() {
    $scaleOverlay.style.display = "none";
  }

  function saveScaleConfig() {
    const sheet = getSheet();
    if (!sheet) return;
    sheet.pmax = parseFloat($editPmax.value) || 50;
    sheet.exig = parseFloat($editExig.value) || 60;
    sheet.nmin = parseFloat($editNmin.value) || 1.0;
    sheet.nmax = parseFloat($editNmax.value) || 5.0;
    sheet.napr = parseFloat($editNapr.value) || 3.0;
    sheet.updatedAt = Date.now();
    saveToStorage();
    closeScaleConfig();
    renderGrid();
  }

  function loadSavedScales(selectEl) {
    let scales = [];
    try {
      const data = JSON.parse(localStorage.getItem("esl_grading_scale_data"));
      if (data && Array.isArray(data.savedScales)) scales = data.savedScales;
    } catch (e) {}

    selectEl.innerHTML = '<option value="">-- Custom --</option>';
    scales.forEach((sc) => {
      const opt = document.createElement("option");
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
      $(prefix + "-pmax").value = sc.pmax;
      $(prefix + "-exig").value = sc.exig;
      $(prefix + "-nmin").value = sc.nmin;
      $(prefix + "-nmax").value = sc.nmax;
      $(prefix + "-napr").value = sc.napr;
    } catch (e) {}
  }

  $editImportScale.addEventListener("change", () =>
    applySavedScale($editImportScale, "gs-edit"),
  );

  // ══════════════════════════════════════════════════════
  //    Phase 3: MISSING GRADES REPORT
  // ══════════════════════════════════════════════════════
  function openMissingReport() {
    const sheet = getSheet();
    if (!sheet) return;
    const { missing, studentsWithGrades, totalCells, filledCells } =
      getMissingGrades(sheet);
    const allActs = getAllActivities(sheet);
    const students = getStudentNames(sheet.group);

    $missingContent.innerHTML = "";

    // Summary stats
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "gs-missing-summary";
    summaryDiv.innerHTML = `
            <div class="gs-missing-stat"><i class="fa-solid fa-users"></i> <strong>${students.length}</strong> students</div>
            <div class="gs-missing-stat"><i class="fa-solid fa-list-check"></i> <strong>${allActs.length}</strong> activities</div>
            <div class="gs-missing-stat"><i class="fa-solid fa-chart-pie"></i> <strong>${filledCells}/${totalCells}</strong> grades entered</div>
            <div class="gs-missing-stat"><i class="fa-solid fa-user-check"></i> <strong>${studentsWithGrades}</strong> with grades</div>`;
    $missingContent.appendChild(summaryDiv);

    // Activation threshold: show report when >= 50% of students have at least 1 grade
    const threshold = Math.ceil(students.length * 0.5);
    if (studentsWithGrades < threshold) {
      const notice = document.createElement("div");
      notice.className = "gs-missing-none";
      notice.innerHTML = `<i class="fa-solid fa-info-circle"></i> Enter grades for at least ${threshold} students to activate the missing grades report.`;
      $missingContent.appendChild(notice);
    } else if (missing.length === 0) {
      const notice = document.createElement("div");
      notice.className = "gs-missing-none";
      notice.innerHTML =
        '<i class="fa-solid fa-circle-check"></i> All graded students have complete data!';
      $missingContent.appendChild(notice);
    } else {
      missing.forEach(({ name, acts }) => {
        const div = document.createElement("div");
        div.className = "gs-missing-item";
        const actLabels = acts.map((a) => a.label || "Untitled").join(", ");
        div.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i>
                    <span class="gs-missing-name">${escHtml(name)}</span>
                    <span class="gs-missing-acts">Missing: ${escHtml(actLabels)}</span>`;
        $missingContent.appendChild(div);
      });
    }

    $missingOverlay.style.display = "";
  }

  function closeMissingReport() {
    $missingOverlay.style.display = "none";
  }

  // ══════════════════════════════════════════════════════
  //              PHASE 8: IMPORT DATA
  // ══════════════════════════════════════════════════════
  function openImportModal() {
    if (!currentSheetId) return;
    $importSourceSelect.innerHTML =
      '<option value="">-- Choose a sheet --</option>';
    sheets.forEach((s) => {
      if (s.id !== currentSheetId) {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent =
          s.subject + " - " + s.group + " (" + s.term + " Term)";
        $importSourceSelect.appendChild(opt);
      }
    });

    $importSourceSelect.value = "";
    $importActivityContainer.style.display = "none";
    $importActivitySelect.innerHTML = "";
    $importExecuteBtn.disabled = true;

    // Reset radios to description only
    $importModeRadios.forEach((r) => {
      if (r.value === "desc_only") r.checked = true;
    });

    $importOverlay.style.display = "flex";
  }

  function closeImportModal() {
    $importOverlay.style.display = "none";
  }

  function onImportSourceChange() {
    const sourceId = $importSourceSelect.value;
    if (!sourceId) {
      $importActivityContainer.style.display = "none";
      $importExecuteBtn.disabled = true;
      return;
    }

    const srcSheet = sheets.find((s) => s.id === sourceId);
    if (!srcSheet) return;

    const activities = getAllActivities(srcSheet);
    if (activities.length === 0) {
      $importActivitySelect.innerHTML =
        '<option value="">(No activities in this sheet)</option>';
      $importActivityContainer.style.display = "block";
      $importExecuteBtn.disabled = true;
      return;
    }

    $importActivitySelect.innerHTML =
      '<option value="">-- Choose activity --</option>';
    activities.forEach((act) => {
      const opt = document.createElement("option");
      opt.value = act.id;
      opt.dataset.cat = act.category;
      opt.textContent = CAT_LABELS[act.category] + ": " + act.label;
      $importActivitySelect.appendChild(opt);
    });

    $importActivityContainer.style.display = "block";
    $importExecuteBtn.disabled = true;
  }

  function onImportActivityChange() {
    $importExecuteBtn.disabled = !$importActivitySelect.value;
  }

  function executeImport() {
    const srcSheetId = $importSourceSelect.value;
    const srcActId = $importActivitySelect.value;
    if (!srcSheetId || !srcActId) return;

    const srcSheet = sheets.find((s) => s.id === srcSheetId);
    const currSheet = getSheet();
    if (!srcSheet || !currSheet) return;

    const opt =
      $importActivitySelect.options[$importActivitySelect.selectedIndex];
    const category = opt.dataset.cat;

    // Find activity object in source
    let srcAct = null;
    if (srcSheet.categories && srcSheet.categories[category]) {
      srcAct = srcSheet.categories[category].find((a) => a.id === srcActId);
    }
    if (!srcAct) return;

    let importMode = "desc_only";
    $importModeRadios.forEach((r) => {
      if (r.checked) importMode = r.value;
    });

    // Import description & settings
    const newActId =
      "act_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 6);
    const newAct = {
      id: newActId,
      label: srcAct.label,
      scaleId: srcAct.scaleId || null,
      maxScore: srcAct.maxScore || null,
      hidden: false,
    };

    if (!currSheet.categories) currSheet.categories = {};
    if (!currSheet.categories[category]) currSheet.categories[category] = [];
    currSheet.categories[category].push(newAct);

    // Import grades if requested
    let importedCount = 0;
    if (importMode === "full_column") {
      const srcGrades = srcSheet.grades || {};
      if (!currSheet.grades) currSheet.grades = {};

      const currStudents = getStudentNames(currSheet.group);
      currStudents.forEach((student) => {
        if (
          srcGrades[student] &&
          srcGrades[student][srcActId] !== undefined &&
          srcGrades[student][srcActId] !== null &&
          srcGrades[student][srcActId] !== ""
        ) {
          if (!currSheet.grades[student]) currSheet.grades[student] = {};
          currSheet.grades[student][newActId] = srcGrades[student][srcActId];
          importedCount++;
        }
      });
    }

    currSheet.updatedAt = Date.now();
    saveToStorage();
    closeImportModal();
    renderGrid();
    renderDescriptions();

    if (importMode === "full_column") {
      showToast(
        `Activity imported! Copied grades for ${importedCount} identical students.`,
        "success",
      );
    } else {
      showToast(
        "Activity description & scale settings imported correctly.",
        "success",
      );
    }
  }

  // ══════════════════════════════════════════════════════
  //              UPLOAD CSV GRADES
  // ══════════════════════════════════════════════════════
  function openUploadModal() {
    pendingCsvImport = null;
    if ($uploadFileInput) $uploadFileInput.value = "";
    if ($uploadFileName) $uploadFileName.textContent = "No file chosen";
    if ($uploadPreview)
      $uploadPreview.textContent =
        "Choose a CSV file to preview matching students and activities.";
    if ($uploadImportBtn) $uploadImportBtn.disabled = true;
    if ($uploadOverlay) $uploadOverlay.style.display = "flex";
  }

  function closeUploadModal() {
    if ($uploadOverlay) $uploadOverlay.style.display = "none";
    pendingCsvImport = null;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cell);
        if (row.some((v) => String(v).trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
    row.push(cell);
    if (row.some((v) => String(v).trim() !== "")) rows.push(row);
    return rows;
  }

  function getActivityById(sheet, actId) {
    let match = null;
    CATEGORIES.forEach((cat) => {
      const found = (sheet.categories[cat] || []).find((a) => a.id === actId);
      if (found) match = found;
    });
    return match;
  }

  function getUploadValueType() {
    let type = "scores";
    $uploadValueTypeRadios.forEach((r) => {
      if (r.checked) type = r.value;
    });
    return type;
  }

  function getParsedUploadRows() {
    return pendingCsvImport ? pendingCsvImport.rows : null;
  }

  function previewUploadRows(rows) {
    const sheet = getSheet();
    if (!sheet) return null;
    const students = getStudentNames(sheet.group);
    const studentLookup = new Map(
      students.map((name) => [normalizeText(name), name]),
    );
    const allActs = getAllActivities(sheet);
    const activityLookup = new Map(
      allActs.map((act) => [normalizeText(act.label), act]),
    );

    const result = {
      rows,
      format: "simple",
      mappings: [],
      matchedStudents: new Set(),
      skippedStudents: new Set(),
      matchedActivities: new Set(),
      skippedActivities: [],
      cells: 0,
    };

    const firstCell = normalizeText((rows[0] || [])[0]);
    const activityHeaderRowIndex = rows.findIndex((row) =>
      row.some((cell) => / score$/i.test(String(cell || "").trim())),
    );
    if (firstCell === "grade sheet report" || activityHeaderRowIndex !== -1) {
      result.format = "roundtrip";
      const labelRowIndex =
        activityHeaderRowIndex !== -1
          ? activityHeaderRowIndex
          : rows.findIndex((row) =>
              row.some((cell) => / score$/i.test(String(cell || "").trim())),
            );
      const labelRow = rows[labelRowIndex] || [];
      const dataRows = rows.slice(labelRowIndex + 1);
      const valueSuffix =
        getUploadValueType() === "grades" ? " grade" : " score";
      const valueSuffixRegex = new RegExp(`${valueSuffix}$`, "i");
      let actIdx = 0;
      labelRow.forEach((cell, colIndex) => {
        if (!valueSuffixRegex.test(String(cell || "").trim())) return;
        const act = allActs[actIdx];
        if (act) {
          result.mappings.push({ colIndex, act });
          result.matchedActivities.add(act.id);
        } else {
          result.skippedActivities.push(
            String(cell || "")
              .replace(valueSuffixRegex, "")
              .trim() || `Column ${colIndex + 1}`,
          );
        }
        actIdx++;
      });
      dataRows.forEach((row) =>
        collectUploadRowStats(row, 1, studentLookup, result),
      );
    } else {
      const header = rows[0] || [];
      const dataRows = rows.slice(1);
      header.forEach((cell, colIndex) => {
        if (colIndex === 0) return;
        const label = String(cell || "").trim();
        if (!label) return;
        const act = activityLookup.get(normalizeText(label));
        if (act) {
          result.mappings.push({ colIndex, act });
          result.matchedActivities.add(act.id);
        } else {
          result.skippedActivities.push(label);
        }
      });
      dataRows.forEach((row) =>
        collectUploadRowStats(row, 0, studentLookup, result),
      );
    }

    return result;
  }

  function collectUploadRowStats(row, studentColIndex, studentLookup, result) {
    const student = studentLookup.get(normalizeText(row[studentColIndex]));
    if (!student) {
      const rawName = String(row[studentColIndex] || "").trim();
      if (rawName) result.skippedStudents.add(rawName);
      return;
    }
    result.matchedStudents.add(student);
    result.mappings.forEach(({ colIndex }) => {
      const raw = String(row[colIndex] || "").trim();
      if (raw !== "" && !isNaN(parseFloat(raw.replace(",", "."))))
        result.cells++;
    });
  }

  function renderUploadPreview() {
    if (!$uploadPreview || !$uploadImportBtn) return;
    const rows = getParsedUploadRows();
    if (!rows || rows.length < 2) {
      $uploadPreview.textContent =
        "Choose a CSV file to preview matching students and activities.";
      $uploadImportBtn.disabled = true;
      return;
    }

    const preview = previewUploadRows(rows);
    if (!preview || !preview.mappings.length || preview.cells === 0) {
      $uploadPreview.innerHTML =
        "<strong>No importable data found.</strong><br>Check that student names and activity columns match this sheet.";
      $uploadImportBtn.disabled = true;
      pendingCsvImport.preview = preview;
      return;
    }

    pendingCsvImport.preview = preview;
    const skippedActivities = preview.skippedActivities.length
      ? `<br><span>Skipped activity columns: ${escHtml(preview.skippedActivities.slice(0, 5).join(", "))}${preview.skippedActivities.length > 5 ? "..." : ""}</span>`
      : "";
    const skippedStudents = preview.skippedStudents.size
      ? `<br><span>Skipped students: ${escHtml(Array.from(preview.skippedStudents).slice(0, 5).join(", "))}${preview.skippedStudents.size > 5 ? "..." : ""}</span>`
      : "";
    $uploadPreview.innerHTML = `
            <strong>${preview.format === "roundtrip" ? "Exported Grade Sheet CSV" : "Simple Student/Activity CSV"} detected.</strong><br>
            <span>${preview.matchedStudents.size} student(s) matched.</span><br>
            <span>${preview.matchedActivities.size} activity column(s) matched.</span><br>
            <span>${preview.cells} grade cell(s) ready to import as ${getUploadValueType() === "grades" ? "final grades" : "raw scores"}.</span>
            ${skippedActivities}${skippedStudents}
        `;
    $uploadImportBtn.disabled = false;
  }

  function handleUploadFileChange() {
    const file =
      $uploadFileInput && $uploadFileInput.files
        ? $uploadFileInput.files[0]
        : null;
    pendingCsvImport = null;
    if ($uploadImportBtn) $uploadImportBtn.disabled = true;
    if (!file) {
      if ($uploadFileName) $uploadFileName.textContent = "No file chosen";
      renderUploadPreview();
      return;
    }
    if ($uploadFileName) $uploadFileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ""));
      pendingCsvImport = { rows, preview: null };
      renderUploadPreview();
    };
    reader.onerror = () => showToast("Could not read the CSV file.", "error");
    reader.readAsText(file);
  }

  function executeCsvUpload() {
    const sheet = getSheet();
    if (!sheet || !pendingCsvImport) return;
    const preview =
      pendingCsvImport.preview || previewUploadRows(pendingCsvImport.rows);
    if (!preview || !preview.mappings.length) return;

    const valueType = getUploadValueType();
    const studentColIndex = preview.format === "roundtrip" ? 1 : 0;
    const labelRowIndex =
      preview.format === "roundtrip"
        ? pendingCsvImport.rows.findIndex((row) =>
            row.some((cell) => / score$/i.test(String(cell || "").trim())),
          )
        : 0;
    const dataRows = pendingCsvImport.rows.slice(labelRowIndex + 1);
    const studentLookup = new Map(
      getStudentNames(sheet.group).map((name) => [normalizeText(name), name]),
    );
    let imported = 0;

    dataRows.forEach((row) => {
      const student = studentLookup.get(normalizeText(row[studentColIndex]));
      if (!student) return;
      if (!sheet.grades[student]) sheet.grades[student] = {};
      preview.mappings.forEach(({ colIndex, act }) => {
        const raw = String(row[colIndex] || "")
          .trim()
          .replace(",", ".");
        if (raw === "") return;
        let num = parseFloat(raw);
        if (isNaN(num)) return;
        const sc = getScaleForActivity(
          getActivityById(sheet, act.id) || act,
          sheet,
        );
        if (valueType === "grades") {
          num = inverseCalculateGrade(
            num,
            sc.pmax,
            sc.exig,
            sc.nmin,
            sc.nmax,
            sc.napr,
          );
          num = Math.round(num * 100) / 100;
        }
        if (num < 0) num = 0;
        if (num > sc.pmax) num = sc.pmax;
        sheet.grades[student][act.id] = num;
        imported++;
      });
    });

    sheet.updatedAt = Date.now();
    saveToStorage();
    closeUploadModal();
    renderGrid();
    showToast(
      `Imported ${imported} grade cell${imported === 1 ? "" : "s"} from CSV.`,
      "success",
    );
  }

  // ══════════════════════════════════════════════════════
  //              CSV EXPORT (Phase 4)
  // ══════════════════════════════════════════════════════
  function csvEscape(val) {
    if (val == null) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildSheetCsv(sheet, options = {}) {
    const incHeaders = options.includeHeaders !== false;
    const incScores = options.includeScores !== false;
    const incGrades = options.includeGrades !== false;
    const decimals = options.decimals !== undefined ? options.decimals : 1;

    // If both are false, default to including scores so we export something
    const exportScores = incScores || (!incScores && !incGrades);
    const exportGrades = incGrades || (!incScores && !incGrades);

    const students = getStudentNames(sheet.group);
    const allActs = getAllActivities(sheet);
    const rows = [];

    // Header block
    if (incHeaders) {
      rows.push(["Grade Sheet Report"].map(csvEscape).join(","));
      rows.push(
        ["Teacher:", sheet.teacherName, "", "Subject:", sheet.subject]
          .map(csvEscape)
          .join(","),
      );
      rows.push(
        ["Group:", sheet.group, "", "Term:", sheet.term + " Term"]
          .map(csvEscape)
          .join(","),
      );
      rows.push(
        [
          "Scale:",
          "Max " + (sheet.pmax || 50),
          "Pass " + (sheet.napr || 3.0),
          "Min " + (sheet.nmin || 1.0),
          "Max " + (sheet.nmax || 5.0),
        ]
          .map(csvEscape)
          .join(","),
      );
      rows.push(""); // blank line
    }

    // Category headers row
    const catHeaderCells = ["#", "Student"];
    CATEGORIES.forEach((cat) => {
      const acts = allActs.filter((a) => a.category === cat);
      acts.forEach((_, i) => {
        catHeaderCells.push(
          i === 0 ? CAT_LABELS[cat] + " (" + CAT_WEIGHTS[cat] * 100 + "%)" : "",
        );
        if (exportScores && exportGrades) {
          catHeaderCells.push(""); // Need an extra column if both are exported
        }
      });
    });
    catHeaderCells.push("Weighted Avg");
    rows.push(catHeaderCells.map(csvEscape).join(","));

    // Activity labels row
    const actLabelCells = ["", ""];
    let colNum = 1;
    CATEGORIES.forEach((cat) => {
      allActs
        .filter((a) => a.category === cat)
        .forEach((act) => {
          if (exportScores) {
            actLabelCells.push(colNum + ". " + (act.label || "") + " Score");
          }
          if (exportGrades) {
            actLabelCells.push(colNum + ". " + (act.label || "") + " Grade");
          }
          colNum++;
        });
    });
    actLabelCells.push("");
    rows.push(actLabelCells.map(csvEscape).join(","));

    // Student rows
    students.forEach((name, idx) => {
      const row = [idx + 1, name];
      CATEGORIES.forEach((cat) => {
        allActs
          .filter((a) => a.category === cat)
          .forEach((act) => {
            const val = (sheet.grades[name] || {})[act.id];
            if (val != null && val !== "") {
              if (exportScores) {
                row.push(val);
              }
              if (exportGrades) {
                const sc = getScaleForActivity(act, sheet);
                const g = calculateGrade(
                  parseFloat(val),
                  sc.pmax,
                  sc.exig,
                  sc.nmin,
                  sc.nmax,
                  sc.napr,
                );

                let gradeStr = "";
                if (decimals === "0") {
                  gradeStr = Math.round(g).toString();
                } else if (decimals === "remove") {
                  gradeStr = (Math.round(g * 10) / 10)
                    .toFixed(1)
                    .replace(".", "");
                } else if (decimals === "2") {
                  gradeStr = (Math.round(g * 100) / 100).toFixed(2);
                } else {
                  gradeStr = (Math.round(g * 10) / 10).toFixed(1);
                }

                row.push(gradeStr);
              }
            } else {
              if (exportScores) row.push("");
              if (exportGrades) row.push("");
            }
          });
      });
      // Weighted avg
      const { avg } = calcWeightedAvg(name, sheet);
      if (avg !== null) {
        let avgStr = "";
        if (decimals === "0") {
          avgStr = Math.round(avg).toString();
        } else if (decimals === "remove") {
          avgStr = (Math.round(avg * 10) / 10).toFixed(1).replace(".", "");
        } else if (decimals === "2") {
          avgStr = (Math.round(avg * 100) / 100).toFixed(2);
        } else {
          avgStr = (Math.round(avg * 10) / 10).toFixed(1);
        }
        row.push(avgStr);
      } else {
        row.push("");
      }

      rows.push(row.map(csvEscape).join(","));
    });

    return rows.join("\r\n");
  }

  function downloadCsv(filename, csvContent) {
    // UTF-8 BOM for tilde support in Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function exportCurrentSheet() {
    openExportModal("current");
  }

  function exportSelected() {
    openExportModal("selected");
  }

  function openExportModal(type) {
    pendingExportType = type;
    $exportOverlay.style.display = "flex";
  }

  function closeExportModal() {
    $exportOverlay.style.display = "none";
    pendingExportType = null;
  }

  function executeExport() {
    const options = {
      includeHeaders: $exportIncHeaders.checked,
      includeScores: $exportIncScores.checked,
      includeGrades: $exportIncGrades.checked,
      decimals: $exportDecimals.value,
    };

    if (pendingExportType === "current") {
      const sheet = getSheet();
      if (!sheet) return;
      const csv = buildSheetCsv(sheet, options);
      const filename =
        (
          sheet.subject +
          "_" +
          sheet.group +
          "_" +
          sheet.term +
          "_Term"
        ).replace(/\s+/g, "_") + ".csv";
      downloadCsv(filename, csv);
    } else if (pendingExportType === "selected") {
      if (selectedIds.size === 0) return;
      const selected = sheets.filter((s) => selectedIds.has(s.id));
      if (selected.length === 1) {
        const s = selected[0];
        const csv = buildSheetCsv(s, options);
        downloadCsv(
          (s.subject + "_" + s.group + "_" + s.term).replace(/\s+/g, "_") +
            ".csv",
          csv,
        );
      } else {
        // Multi-sheet: combine with separators
        const parts = selected.map((s) => buildSheetCsv(s, options));
        const combined = parts.join("\r\n\r\n" + "═".repeat(60) + "\r\n\r\n");
        downloadCsv("Grade_Sheets_Export.csv", combined);
      }
    }

    closeExportModal();
  }

  // ══════════════════════════════════════════════════════
  //              EVENT BINDINGS
  // ══════════════════════════════════════════════════════
  function bindEvents() {
    // Dashboard
    $newSheetBtn.addEventListener("click", openNewSheetModal);
    if ($driveBtn && driveService) {
      $driveBtn.addEventListener("click", () => driveService.openModal());
    }
    $modalClose.addEventListener("click", closeNewSheetModal);
    $modalCancel.addEventListener("click", closeNewSheetModal);
    $modalCreate.addEventListener("click", createSheet);
    $modalOverlay.addEventListener("click", (e) => {
      if (e.target === $modalOverlay) closeNewSheetModal();
    });
    $deleteOverlay
      .querySelectorAll(".gs-delete-cancel-btn")
      .forEach((b) => b.addEventListener("click", closeDeleteConfirm));
    $deleteConfirm.addEventListener("click", confirmDelete);
    $deleteOverlay.addEventListener("click", (e) => {
      if (e.target === $deleteOverlay) closeDeleteConfirm();
    });
    $backToDashboard.addEventListener("click", backToDashboard);
    $exportSelectedBtn.addEventListener("click", exportSelected);

    if ($filterSearch)
      $filterSearch.addEventListener("input", onDashboardFilterChange);
    if ($filterSubject)
      $filterSubject.addEventListener("change", onDashboardFilterChange);
    if ($filterCourse)
      $filterCourse.addEventListener("change", onDashboardFilterChange);
    if ($filterTerm)
      $filterTerm.addEventListener("change", onDashboardFilterChange);
    if ($filterSort)
      $filterSort.addEventListener("change", onDashboardFilterChange);
    if ($filterClearBtn)
      $filterClearBtn.addEventListener("click", clearDashboardFilters);
    if ($filterEmptyClear)
      $filterEmptyClear.addEventListener("click", clearDashboardFilters);

    document.querySelectorAll(".gs-icon-picker").forEach((picker) => {
      const target = $(picker.dataset.target);
      picker.querySelectorAll(".gs-icon-option").forEach((btn) => {
        btn.addEventListener("click", () =>
          setIconPickerValue(target, btn.dataset.icon),
        );
      });
    });
    document.querySelectorAll(".gs-color-swatches").forEach((group) => {
      const target = $(group.dataset.target);
      group.querySelectorAll(".gs-color-swatch").forEach((btn) => {
        btn.addEventListener("click", () =>
          setColorPickerValue(target, btn.dataset.color),
        );
      });
    });

    // Editor – Add activity
    document
      .querySelectorAll(".gs-add-activity-bar .gs-btn-sm")
      .forEach((btn) =>
        btn.addEventListener("click", () => addActivity(btn.dataset.cat)),
      );

    // Phase 6 & 7 - Buttons
    if ($toggleViewBtn)
      $toggleViewBtn.addEventListener("click", toggleViewMode);
    if ($removeDecimalToggle)
      $removeDecimalToggle.addEventListener("change", toggleRemoveDecimal);
    if ($clearGradesBtn)
      $clearGradesBtn.addEventListener("click", clearAllGrades);
    if ($editSheetInfoBtn)
      $editSheetInfoBtn.addEventListener("click", openEditSheetInfo);

    if ($actSettingsClose)
      $actSettingsClose.forEach((b) =>
        b.addEventListener("click", closeActivitySettings),
      );
    if ($actSettingsSave)
      $actSettingsSave.addEventListener("click", saveActivitySettings);
    if ($actScaleSelect)
      $actScaleSelect.addEventListener("change", updateActScalePreview);
    if ($actSettingsOverlay)
      $actSettingsOverlay.addEventListener("click", (e) => {
        if (e.target === $actSettingsOverlay) closeActivitySettings();
      });

    if ($editInfoClose)
      $editInfoClose.forEach((b) =>
        b.addEventListener("click", closeEditSheetInfo),
      );
    if ($editInfoSave)
      $editInfoSave.addEventListener("click", saveEditSheetInfo);
    if ($editInfoOverlay)
      $editInfoOverlay.addEventListener("click", (e) => {
        if (e.target === $editInfoOverlay) closeEditSheetInfo();
      });

    if ($editDescClose)
      $editDescClose.forEach((b) =>
        b.addEventListener("click", closeEditDescription),
      );
    if ($editDescSave)
      $editDescSave.addEventListener("click", saveEditDescription);
    if ($editDescOverlay)
      $editDescOverlay.addEventListener("click", (e) => {
        if (e.target === $editDescOverlay) closeEditDescription();
      });

    // Phase 8 – Import Component
    if ($importSheetDataBtn)
      $importSheetDataBtn.addEventListener("click", openImportModal);
    if ($importCloseBtn)
      $importCloseBtn.addEventListener("click", closeImportModal);
    if ($importCancelBtn)
      $importCancelBtn.addEventListener("click", closeImportModal);
    if ($importSourceSelect)
      $importSourceSelect.addEventListener("change", onImportSourceChange);
    if ($importActivitySelect)
      $importActivitySelect.addEventListener("change", onImportActivityChange);
    if ($importExecuteBtn)
      $importExecuteBtn.addEventListener("click", executeImport);
    if ($importOverlay)
      $importOverlay.addEventListener("click", (e) => {
        if (e.target === $importOverlay) closeImportModal();
      });

    if ($uploadGradesBtn)
      $uploadGradesBtn.addEventListener("click", openUploadModal);
    if ($uploadClose)
      $uploadClose.forEach((b) =>
        b.addEventListener("click", closeUploadModal),
      );
    if ($uploadFileInput)
      $uploadFileInput.addEventListener("change", handleUploadFileChange);
    if ($uploadImportBtn)
      $uploadImportBtn.addEventListener("click", executeCsvUpload);
    if ($uploadOverlay)
      $uploadOverlay.addEventListener("click", (e) => {
        if (e.target === $uploadOverlay) closeUploadModal();
      });
    if ($uploadValueTypeRadios)
      $uploadValueTypeRadios.forEach((r) =>
        r.addEventListener("change", renderUploadPreview),
      );

    CATEGORIES.forEach((cat) => {
      const inp = $("gs-add-" + cat + "-input");
      if (inp)
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") addActivity(cat);
        });
    });
    $toggleDescriptions.addEventListener("click", () =>
      $descriptionsPanel.classList.toggle("hidden"),
    );

    // Phase 4 – Export CSV
    $exportCsvBtn.addEventListener("click", exportCurrentSheet);
    if ($exportClose) $exportClose.addEventListener("click", closeExportModal);
    if ($exportCancel)
      $exportCancel.addEventListener("click", closeExportModal);
    if ($exportExecuteBtn)
      $exportExecuteBtn.addEventListener("click", executeExport);
    if ($exportOverlay)
      $exportOverlay.addEventListener("click", (e) => {
        if (e.target === $exportOverlay) closeExportModal();
      });

    // Phase 3 – Scale config
    $scaleConfigBtn.addEventListener("click", openScaleConfig);
    document
      .querySelectorAll(".gs-scale-close")
      .forEach((b) => b.addEventListener("click", closeScaleConfig));
    $scaleSave.addEventListener("click", saveScaleConfig);
    $scaleOverlay.addEventListener("click", (e) => {
      if (e.target === $scaleOverlay) closeScaleConfig();
    });

    // Phase 3 – Missing grades report
    $missingBtn.addEventListener("click", openMissingReport);
    document
      .querySelectorAll(".gs-missing-close")
      .forEach((b) => b.addEventListener("click", closeMissingReport));
    $missingOverlay.addEventListener("click", (e) => {
      if (e.target === $missingOverlay) closeMissingReport();
    });

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ($modalOverlay.style.display !== "none") closeNewSheetModal();
        if ($deleteOverlay.style.display !== "none") closeDeleteConfirm();
        if ($scaleOverlay.style.display !== "none") closeScaleConfig();
        if ($missingOverlay.style.display !== "none") closeMissingReport();
        if ($importOverlay && $importOverlay.style.display !== "none")
          closeImportModal();
        if ($editDescOverlay && $editDescOverlay.style.display !== "none")
          closeEditDescription();
        if ($uploadOverlay && $uploadOverlay.style.display !== "none")
          closeUploadModal();
        if ($exportOverlay && $exportOverlay.style.display !== "none")
          closeExportModal();
      }
      if (e.key === "Enter" && $modalOverlay.style.display !== "none") {
        if (
          !document.activeElement ||
          !document.activeElement.classList.contains("gs-add-input")
        )
          createSheet();
      }
    });
  }

  // ══════════════════════════════════════════════════════
  //                      INIT
  // ══════════════════════════════════════════════════════
  function init() {
    populateGroupDropdown();
    loadDashboardFilters();
    loadFromStorage();
    renderDashboard();
    bindEvents();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
