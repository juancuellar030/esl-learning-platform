/**
 * School Setup page — manages SchoolRoster (js/school-roster.js):
 * school years, groups, student lists (import / add / rename / move /
 * withdraw), subjects, Google Drive sync and backup files.
 */
(() => {
  "use strict";

  const R = window.SchoolRoster;
  const $ = (id) => document.getElementById(id);
  const LEGACY_SHEET_YEAR = "2026"; // grade sheets created before school years existed
  const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";

  let selectedGroup = null;
  let importState = null; // { scope: "group" | "multi", plan }

  // ── utils ────────────────────────────────────────────
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let toastTimer = null;
  function toast(msg, type) {
    const el = $("ss-toast");
    el.textContent = msg;
    el.dataset.type = type || "info";
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3200);
  }

  function attempt(fn) {
    try {
      return fn();
    } catch (e) {
      toast(e.message || String(e), "error");
      return undefined;
    }
  }

  function openOverlay(id) {
    $(id).hidden = false;
  }
  function closeOverlay(id) {
    $(id).hidden = true;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function viewYear() {
    return R.activeYear();
  }

  // Grade sheets store grades by student name: keep them when a name is fixed
  function migrateGradeSheetName(year, groupId, oldName, newName) {
    let sheets;
    try {
      sheets = JSON.parse(localStorage.getItem("gradeSheets")) || [];
    } catch (e) {
      return 0;
    }
    let changed = 0;
    sheets.forEach((s) => {
      const sheetYear = s.year || LEGACY_SHEET_YEAR;
      if (sheetYear !== year || s.group !== groupId || !s.grades) return;
      if (s.grades[oldName] && !s.grades[newName]) {
        s.grades[newName] = s.grades[oldName];
        delete s.grades[oldName];
        changed++;
      }
    });
    if (changed) localStorage.setItem("gradeSheets", JSON.stringify(sheets));
    return changed;
  }

  // ── rendering ────────────────────────────────────────
  function renderYears() {
    const years = R.years();
    const active = viewYear();
    $("ss-year-label").textContent = active;
    const items = years
      .slice()
      .reverse()
      .map((y) => {
        const yr = R.year(y);
        const students = yr.groups.reduce((n, g) => n + g.students.filter((s) => s.status !== "withdrawn").length, 0);
        const on = y === active;
        return `<button type="button" class="ss-year-option${on ? " is-current" : ""}" role="option" aria-selected="${on}" data-year="${esc(y)}">
            <span class="ss-year-option-text"><strong>${esc(y)}</strong><small>${yr.groups.length} groups · ${students} students</small></span>
            ${on ? '<i class="fa-solid fa-check"></i>' : ""}
          </button>`;
      })
      .join("");
    $("ss-year-menu").innerHTML =
      `<div class="ss-year-menu-title">School year</div>${items}` +
      `<button type="button" class="ss-year-option ss-year-new" data-new-year><i class="fa-solid fa-plus"></i> New school year…</button>`;
  }

  function setYearMenu(open) {
    $("ss-year-menu").hidden = !open;
    $("ss-year-btn").setAttribute("aria-expanded", String(open));
    if (open) {
      const current = $("ss-year-menu").querySelector(".is-current") || $("ss-year-menu").querySelector(".ss-year-option");
      if (current) current.focus();
    }
  }

  function renderGroups() {
    const groups = R.groups(viewYear());
    if (selectedGroup && !groups.some((g) => g.id === selectedGroup)) selectedGroup = null;
    if (!selectedGroup && groups.length) selectedGroup = groups[0].id;

    const total = groups.reduce((n, g) => n + g.students.filter((s) => s.status !== "withdrawn").length, 0);
    $("ss-groups-total").textContent = groups.length ? `${groups.length} groups · ${total} students` : "";

    const byLevel = new Map();
    groups.forEach((g) => {
      const key = g.level != null ? g.level : "other";
      if (!byLevel.has(key)) byLevel.set(key, []);
      byLevel.get(key).push(g);
    });

    $("ss-group-list").innerHTML = groups.length
      ? [...byLevel.entries()]
          .map(([level, list]) => {
            const title = level === "other" ? "OTHER" : `${R.levelName(level, viewYear())} · ${level}°`;
            const buttons = list
              .map((g) => {
                const active = g.students.filter((s) => s.status !== "withdrawn").length;
                return `<button class="ss-group-btn${g.id === selectedGroup ? " is-active" : ""}" data-group="${esc(g.id)}">
                    ${esc(g.id)} <small>${active}</small></button>`;
              })
              .join("");
            return `<div><p class="ss-level-title">${esc(title)}</p><div class="ss-level-groups">${buttons}</div></div>`;
          })
          .join("")
      : `<p class="ss-muted">No groups yet for ${esc(viewYear())}.</p>`;
  }

  function renderRoster() {
    const g = selectedGroup && R.group(selectedGroup, viewYear());
    $("ss-roster-empty").hidden = !!g;
    $("ss-roster").hidden = !g;
    if (!g) return;

    const showWithdrawn = $("ss-show-withdrawn").checked;
    const all = R.students(g.id, { year: viewYear(), includeWithdrawn: true });
    const active = all.filter((s) => s.status !== "withdrawn");
    const withdrawn = all.filter((s) => s.status === "withdrawn");
    const rows = showWithdrawn ? [...active, ...withdrawn] : active;

    $("ss-roster-title").textContent = `${g.id} · ${R.levelName(g.level, viewYear())}`;
    $("ss-roster-counts").textContent =
      `${active.length} active` + (withdrawn.length ? ` · ${withdrawn.length} withdrawn` : "");

    let n = 0;
    $("ss-roster-body").innerHTML = rows.length
      ? rows
          .map((st) => {
            const isOut = st.status === "withdrawn";
            const num = isOut ? "—" : ++n;
            const badge = isOut
              ? `<span class="ss-badge ss-badge-withdrawn"><i class="fa-solid fa-user-minus"></i> Withdrawn${st.withdrawnOn ? " " + esc(formatDate(st.withdrawnOn)) : ""}</span>${st.note ? `<span class="ss-badge-note">${esc(st.note)}</span>` : ""}`
              : `<span class="ss-badge ss-badge-active">Active</span>`;
            const toggle = isOut
              ? `<button class="ss-icon-btn" data-act="reactivate" data-id="${st.id}" title="Reactivate"><i class="fa-solid fa-user-check"></i></button>`
              : `<button class="ss-icon-btn" data-act="withdraw" data-id="${st.id}" title="Withdraw"><i class="fa-solid fa-user-minus"></i></button>`;
            return `<tr class="${isOut ? "ss-row-withdrawn" : ""}">
                <td class="ss-col-num">${num}</td>
                <td><span class="ss-student-name">${esc(st.name)}</span></td>
                <td class="ss-col-status">${badge}</td>
                <td class="ss-col-actions">
                  <button class="ss-icon-btn" data-act="rename" data-id="${st.id}" title="Edit name"><i class="fa-solid fa-pen"></i></button>
                  <button class="ss-icon-btn" data-act="move" data-id="${st.id}" title="Move to another group"><i class="fa-solid fa-right-left"></i></button>
                  ${toggle}
                  <button class="ss-icon-btn" data-act="delete" data-id="${st.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td></tr>`;
          })
          .join("")
      : `<tr><td colspan="4" class="ss-muted" style="text-align:center;padding:28px;">No students yet. Add names above or import a list.</td></tr>`;
  }

  function renderSubjects() {
    const year = viewYear();
    const groups = R.groups(year);
    const levels = R.levels(year);
    const subjects = R.subjects(year);
    $("ss-subject-list").innerHTML = subjects.length
      ? subjects
          .map((sub) => {
            const levelRows = levels
              .map((lv) => {
                const chips = groups
                  .filter((g) => g.level === lv.level)
                  .map(
                    (g) => `<label class="ss-chip"><input type="checkbox" data-subject="${sub.id}" data-group="${esc(g.id)}"${sub.groups.includes(g.id) ? " checked" : ""} /><span>${esc(g.id)}</span></label>`,
                  )
                  .join("");
                return chips
                  ? `<div class="ss-subject-level"><span class="ss-subject-level-name">${esc(lv.name)}</span>${chips}</div>`
                  : "";
              })
              .join("");
            return `<div class="ss-subject">
                <div class="ss-subject-head">
                  <i class="fa-solid fa-book" style="color:var(--ss-accent)"></i>
                  <input class="ss-subject-name" data-subject="${sub.id}" value="${esc(sub.name)}" aria-label="Subject name" />
                  <span class="ss-subject-count">${sub.groups.length} group${sub.groups.length === 1 ? "" : "s"}</span>
                  <button class="ss-icon-btn" data-remove-subject="${sub.id}" title="Delete subject"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="ss-subject-levels">${levelRows || '<p class="ss-muted">Add groups first.</p>'}</div>
              </div>`;
          })
          .join("")
      : `<p class="ss-muted">No subjects yet for ${esc(year)}.</p>`;
  }

  function renderAll() {
    renderYears();
    renderGroups();
    renderRoster();
    renderSubjects();
  }

  // ── student actions ─────────────────────────────────
  function studentById(id) {
    return R.students(selectedGroup, { year: viewYear(), includeWithdrawn: true }).find((s) => s.id === id);
  }

  function openStudentDialog(kind, st) {
    const body = $("ss-student-body");
    const foot = $("ss-student-foot");
    const cancel = `<button class="ss-btn ss-btn-ghost-dark" data-close="ss-student-overlay">Cancel</button>`;
    const title = $("ss-student-title");

    if (kind === "rename") {
      title.textContent = "Edit name";
      body.innerHTML = `<label class="ss-field"><span>Student name (${esc(selectedGroup)})</span><input id="ss-dlg-name" type="text" value="${esc(st.name)}" style="text-transform:uppercase" /></label>
        <p class="ss-muted ss-small">Grades already typed for this student in Grade Sheets move to the new name.</p>`;
      foot.innerHTML = `${cancel}<button class="ss-btn ss-btn-primary" id="ss-dlg-ok"><i class="fa-solid fa-check"></i> Save</button>`;
      $("ss-dlg-ok").onclick = () => {
        const res = attempt(() => R.renameStudent(selectedGroup, st.id, $("ss-dlg-name").value, viewYear()));
        if (!res) return;
        migrateGradeSheetName(viewYear(), selectedGroup, res.oldName, res.newName);
        closeOverlay("ss-student-overlay");
        toast("Name updated", "success");
      };
    } else if (kind === "withdraw") {
      title.textContent = "Withdraw student";
      body.innerHTML = `<p style="margin-top:0"><strong>${esc(st.name)}</strong> will be hidden from the turn tracker, material tracker and other tools, and from new grade sheets. Sheets where they already have grades keep them.</p>
        <label class="ss-field"><span>Date</span><input id="ss-dlg-date" type="date" value="${today()}" /></label>
        <label class="ss-field"><span>Note (optional)</span><input id="ss-dlg-note" type="text" placeholder="e.g. Moved to another school" maxlength="120" /></label>`;
      foot.innerHTML = `${cancel}<button class="ss-btn ss-btn-danger" id="ss-dlg-ok"><i class="fa-solid fa-user-minus"></i> Withdraw</button>`;
      $("ss-dlg-ok").onclick = () => {
        const ok = attempt(() =>
          R.setStudentStatus(selectedGroup, st.id, "withdrawn", { date: $("ss-dlg-date").value, note: $("ss-dlg-note").value.trim() }, viewYear()),
        );
        if (ok === undefined) return;
        closeOverlay("ss-student-overlay");
        toast(st.name + " withdrawn", "success");
      };
    } else if (kind === "move") {
      title.textContent = "Move to another group";
      const options = R.groups(viewYear())
        .filter((g) => g.id !== selectedGroup)
        .map((g) => `<option value="${esc(g.id)}">${esc(g.id)}</option>`)
        .join("");
      body.innerHTML = `<p style="margin-top:0"><strong>${esc(st.name)}</strong> · currently in ${esc(selectedGroup)}</p>
        <label class="ss-field"><span>New group</span><select id="ss-dlg-group">${options}</select></label>
        <p class="ss-muted ss-small">Grades already typed in ${esc(selectedGroup)}'s sheets stay there.</p>`;
      foot.innerHTML = `${cancel}<button class="ss-btn ss-btn-primary" id="ss-dlg-ok"${options ? "" : " disabled"}><i class="fa-solid fa-right-left"></i> Move</button>`;
      $("ss-dlg-ok").onclick = () => {
        const to = $("ss-dlg-group").value;
        const ok = attempt(() => R.moveStudent(selectedGroup, st.id, to, viewYear()));
        if (ok === undefined) return;
        closeOverlay("ss-student-overlay");
        toast(`${st.name} moved to ${to}`, "success");
      };
    } else if (kind === "delete") {
      title.textContent = "Delete student";
      body.innerHTML = `<p style="margin-top:0">Delete <strong>${esc(st.name)}</strong> from ${esc(selectedGroup)}?</p>
        <p class="ss-muted ss-small">Use this for names added by mistake. For students who left the school, <strong>Withdraw</strong> keeps their history instead. Grades already saved in Grade Sheets are not deleted.</p>`;
      foot.innerHTML = `${cancel}<button class="ss-btn ss-btn-danger" id="ss-dlg-ok"><i class="fa-solid fa-trash"></i> Delete</button>`;
      $("ss-dlg-ok").onclick = () => {
        attempt(() => R.deleteStudent(selectedGroup, st.id, viewYear()));
        closeOverlay("ss-student-overlay");
        toast(st.name + " deleted", "success");
      };
    }
    openOverlay("ss-student-overlay");
    const first = body.querySelector("input, select");
    if (first) setTimeout(() => first.focus(), 50);
  }

  function onRosterClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const st = studentById(btn.dataset.id);
    if (!st) return;
    if (btn.dataset.act === "reactivate") {
      attempt(() => R.setStudentStatus(selectedGroup, st.id, "active", null, viewYear()));
      toast(st.name + " is active again", "success");
      return;
    }
    openStudentDialog(btn.dataset.act, st);
  }

  // ── import ───────────────────────────────────────────
  const GROUP_RE = /^\s*(\d{1,2})\s*°?\s*[-–]?\s*([A-Z])\s*$/i;

  const LEVEL_BY_NAME = Object.fromEntries(
    Object.entries(R.LEVEL_NAMES).map(([n, name]) => [R.normalizeName(name), n]),
  );

  // "3A", "3 A", "3°A", "TERCERO-A", "Curso: CUARTO-B" → "3A" / "4B"
  function asGroupId(cell) {
    const text = String(cell || "").replace(/^\s*(curso|grupo|course|group)\s*:?/i, "");
    const m = text.match(GROUP_RE);
    if (m) return m[1] + m[2].toUpperCase();
    const w = R.normalizeName(text).match(/^([A-Z]+)\s*([A-Z])$/);
    if (w && LEVEL_BY_NAME[w[1]] != null) return LEVEL_BY_NAME[w[1]] + w[2];
    return null;
  }

  function looksLikeName(cell) {
    const t = String(cell || "").trim();
    return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(t) && !/^(name|nombre|student|estudiante|alumno|apellidos?.*|group|grupo|curso|course)s?$/i.test(t);
  }

  // Each row is an array of cells. Finds the group column (if any) and the
  // best name column, and returns Map(group -> [names]).
  function planFromRows(rows, defaultGroup) {
    const plan = new Map();
    const problems = [];
    rows.forEach((cells) => {
      const clean = cells.map((c) => String(c == null ? "" : c).trim());
      if (!clean.some((c) => c)) return;
      let group = null;
      const nameParts = [];
      clean.forEach((c) => {
        if (!c) return;
        const gid = asGroupId(c);
        if (gid && !group) group = gid;
        else if (/^\d+$/.test(c)) return; // row numbers / codes
        else if (looksLikeName(c)) nameParts.push(c);
      });
      if (!nameParts.length) return;
      // Two name columns (surnames, first names) → join them
      const name =
        nameParts.length > 1 && nameParts.every((p) => p.split(/\s+/).length <= 3)
          ? nameParts.join(" ")
          : [...nameParts].sort((a, b) => b.length - a.length)[0];
      const target = group || defaultGroup;
      if (!target) {
        problems.push(name);
        return;
      }
      if (!plan.has(target)) plan.set(target, []);
      plan.get(target).push(name);
    });
    return { plan, problems };
  }

  function rowsFromText(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => {
        if (line.includes("\t")) return line.split("\t");
        if (/[;,]/.test(line) && asGroupId(line.split(/[;,]/)[0])) return line.split(/[;,]/);
        if (line.includes(";")) return line.split(";");
        return [line];
      });
  }

  function loadExcelJs() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = EXCELJS_URL;
      s.onload = () => resolve(window.ExcelJS);
      s.onerror = () => reject(new Error("Could not load the Excel reader. Check your internet connection."));
      document.head.appendChild(s);
    });
  }

  async function readImportFile(file) {
    if (/\.xlsx$/i.test(file.name)) {
      const ExcelJS = await loadExcelJs();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const lines = [];
      wb.worksheets.forEach((ws) => {
        ws.eachRow((row) => {
          const cells = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            let v = cell.value;
            if (v && typeof v === "object") v = v.richText ? v.richText.map((t) => t.text).join("") : v.result != null ? v.result : v.text || "";
            cells.push(v == null ? "" : String(v));
          });
          lines.push(cells.join("\t"));
        });
      });
      return lines.join("\n");
    }
    return await file.text();
  }

  function openImport(scope) {
    importState = { scope };
    const single = scope === "group";
    $("ss-import-title").textContent = single ? `Import list for ${selectedGroup}` : "Import lists for several groups";
    $("ss-import-help").innerHTML = single
      ? "Paste one student per line (LAST NAMES FIRST NAMES), or choose an Excel/CSV file. Row numbers and header rows are ignored."
      : "Paste or upload a list with a <strong>group</strong> column and a <strong>name</strong> column, e.g. <code>3A&nbsp;&nbsp;ANDRADE RODRIGUEZ SILVANA</code>. Groups that don't exist yet are created.";
    $("ss-import-text").value = "";
    $("ss-import-text").placeholder = single
      ? "ANDRADE RODRIGUEZ SILVANA\nBUITRAGO MÉNDEZ JUAN ANDRÉS\n…"
      : "3A\tANDRADE RODRIGUEZ SILVANA\n3A\tBUITRAGO MÉNDEZ JUAN ANDRÉS\n3B\tARIAS MAJE GABRIEL MATIAS\n…";
    $("ss-import-file").value = "";
    $("ss-import-file-name").textContent = "";
    document.querySelector('input[name="ss-import-mode"][value="add"]').checked = true;
    updateImportPreview();
    openOverlay("ss-import-overlay");
    setTimeout(() => $("ss-import-text").focus(), 50);
  }

  function importMode() {
    return document.querySelector('input[name="ss-import-mode"]:checked').value;
  }

  function updateImportPreview() {
    if (!importState) return;
    const replace = importMode() === "replace";
    $("ss-import-mode-hint").textContent = replace
      ? "Students missing from the new list are marked as withdrawn (not deleted), so their earlier grades are kept."
      : "Names already on the list are skipped; everyone else is added.";

    const defaultGroup = importState.scope === "group" ? selectedGroup : null;
    const { plan, problems } = planFromRows(rowsFromText($("ss-import-text").value), defaultGroup);
    if (importState.scope === "group" && plan.size > 1) {
      // A file with a group column was dropped into a single group: keep only that group's rows when present
      if (plan.has(selectedGroup)) [...plan.keys()].forEach((k) => k !== selectedGroup && plan.delete(k));
    }
    importState.plan = plan;

    const year = viewYear();
    const blocks = [];
    plan.forEach((names, gid) => {
      const existing = R.students(gid, { year, includeWithdrawn: true });
      const known = new Map(existing.map((s) => [R.normalizeName(s.name), s]));
      const incoming = new Set(names.map((n) => R.normalizeName(n)));
      const newNames = [...new Set(names.map((n) => n.trim().toLocaleUpperCase("es")))].filter((n) => !known.has(R.normalizeName(n)));
      const reactivated = existing.filter((s) => s.status === "withdrawn" && incoming.has(R.normalizeName(s.name)));
      const out = replace ? existing.filter((s) => s.status !== "withdrawn" && !incoming.has(R.normalizeName(s.name))) : [];
      const isNewGroup = !R.group(gid, year);
      blocks.push(`<div class="ss-preview-row">
          <strong>${esc(gid)}</strong>${isNewGroup ? ' <span class="ss-stat">new group</span>' : ""}
          <div class="ss-preview-stats">
            <span class="ss-stat ss-stat-add">+${newNames.length} new</span>
            <span class="ss-stat">${names.length - newNames.length} already listed</span>
            ${replace && reactivated.length ? `<span class="ss-stat ss-stat-add">${reactivated.length} reactivated</span>` : ""}
            ${replace ? `<span class="ss-stat ss-stat-out">${out.length} to withdraw</span>` : ""}
          </div>
          ${out.length ? `<div class="ss-preview-names">Withdrawn: ${out.map((s) => esc(s.name)).join(", ")}</div>` : ""}
        </div>`);
    });
    if (problems.length)
      blocks.push(`<div class="ss-preview-row"><span class="ss-stat ss-stat-err">${problems.length} rows without a group</span>
        <div class="ss-preview-names">${problems.slice(0, 6).map(esc).join(", ")}${problems.length > 6 ? "…" : ""}</div></div>`);
    $("ss-import-preview").innerHTML = blocks.join("");
    $("ss-import-confirm").disabled = plan.size === 0;
  }

  function executeImport() {
    if (!importState || !importState.plan || !importState.plan.size) return;
    const year = viewYear();
    const replace = importMode() === "replace";
    let added = 0;
    let withdrawn = 0;
    const ok = attempt(() => {
      importState.plan.forEach((names, gid) => {
        if (!R.group(gid, year)) R.addGroup(gid, year);
        if (replace) {
          const res = R.replaceRoster(gid, names, year);
          added += res.added.length;
          withdrawn += res.withdrawn.length;
        } else {
          added += R.addStudents(gid, names, year).added.length;
        }
      });
      return true;
    });
    if (!ok) return;
    const groups = [...importState.plan.keys()];
    if (importState.scope === "multi" && groups.length) selectedGroup = groups[0];
    closeOverlay("ss-import-overlay");
    toast(`Imported ${added} new student${added === 1 ? "" : "s"}` + (withdrawn ? `, ${withdrawn} withdrawn` : ""), "success");
  }

  // ── years ────────────────────────────────────────────
  function openNewYear() {
    const years = R.years();
    const last = years[years.length - 1];
    const next = last && /^\d{4}$/.test(last) ? String(Number(last) + 1) : String(new Date().getFullYear() + 1);
    $("ss-year-input").value = next;
    $("ss-year-copy").innerHTML =
      years.map((y) => `<option value="${esc(y)}"${y === last ? " selected" : ""}>Copy groups and subjects from ${esc(y)}</option>`).join("") +
      `<option value="">Start empty</option>`;
    openOverlay("ss-year-overlay");
    setTimeout(() => $("ss-year-input").select(), 50);
  }

  function createYear() {
    const y = $("ss-year-input").value.trim();
    if (!/^\d{4}(-\d{4})?$/.test(y)) {
      toast("Use a year like 2027", "error");
      return;
    }
    const ok = attempt(() => {
      R.createYear(y, $("ss-year-copy").value || null);
      R.setActiveYear(y);
      return true;
    });
    if (!ok) return;
    selectedGroup = null;
    closeOverlay("ss-year-overlay");
    toast(`School year ${y} created. Import each group's list to fill it.`, "success");
  }

  // ── backup ───────────────────────────────────────────
  function downloadBackup() {
    const blob = new Blob([JSON.stringify(R.get(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `school-setup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  async function restoreBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !data.years) throw new Error("This file isn't a School Setup backup.");
      const years = Object.keys(data.years).join(", ");
      if (!confirm(`Replace the current setup with this backup (years: ${years})?`)) return;
      R.replaceAll(data);
      selectedGroup = null;
      toast("Backup restored", "success");
    } catch (e) {
      toast(e.message || "Could not read the file", "error");
    }
  }

  // ── Google Drive sync ────────────────────────────────
  const Sync = (() => {
    const META_KEY = "eslSchoolSetupSync";
    const FILE_NAME = "school-setup.json";
    const svc = window.GoogleDriveService
      ? new window.GoogleDriveService({ folderName: "ESL - School Setup", onNotify: () => {} })
      : null;
    let busy = false;
    let timer = null;

    function meta() {
      try {
        return JSON.parse(localStorage.getItem(META_KEY)) || {};
      } catch (e) {
        return {};
      }
    }
    function saveMeta(m) {
      localStorage.setItem(META_KEY, JSON.stringify(m));
    }

    function setStatus(state, label) {
      const chip = $("ss-sync-chip");
      chip.dataset.state = state;
      $("ss-sync-chip-label").textContent = label;
      $("ss-sync-status").textContent = label;
      const m = meta();
      $("ss-sync-last").textContent = m.lastSyncTime ? new Date(m.lastSyncTime).toLocaleString() : "Never";
      const connected = !!(svc && svc.isSignedIn);
      $("ss-drive-connect").hidden = connected;
      $("ss-drive-sync").hidden = !connected;
      $("ss-drive-disconnect").hidden = !connected;
    }

    async function findFile() {
      const folderId = await svc._getOrCreateFolder();
      const res = await gapi.client.drive.files.list({
        q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`,
        fields: "files(id, modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: 1,
      });
      return (res.result.files || [])[0] || null;
    }

    async function download(fileId) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: "Bearer " + svc.accessToken },
      });
      if (!res.ok) throw new Error("Download failed (" + res.status + ")");
      return res.json();
    }

    async function upload(fileId, data) {
      const body = JSON.stringify(data, null, 2);
      if (fileId) {
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers: { Authorization: "Bearer " + svc.accessToken, "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) throw new Error("Upload failed (" + res.status + ")");
        return fileId;
      }
      const folderId = await svc._getOrCreateFolder();
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify({ name: FILE_NAME, mimeType: "application/json", parents: [folderId] })], { type: "application/json" }));
      form.append("file", new Blob([body], { type: "application/json" }));
      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
        method: "POST",
        headers: { Authorization: "Bearer " + svc.accessToken },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed (" + res.status + ")");
      return (await res.json()).id;
    }

    // Decides between pulling, pushing or asking, based on when each side
    // last changed compared with the last successful sync.
    async function syncNow(opts) {
      const quiet = opts && opts.quiet;
      if (!svc || !svc.isSignedIn || busy) return;
      busy = true;
      setStatus("busy", "Syncing…");
      try {
        const m = meta();
        const local = R.get();
        const file = await findFile();
        let outcome;
        if (!file) {
          m.fileId = await upload(null, local);
          outcome = "Uploaded to Drive";
        } else {
          m.fileId = file.id;
          const remote = await download(file.id);
          const base = m.lastSyncedUpdatedAt || 0;
          const localChanged = (local.updatedAt || 0) > base;
          const remoteChanged = (remote.updatedAt || 0) > base && remote.updatedAt !== local.updatedAt;
          if (remote.updatedAt === local.updatedAt) {
            outcome = "Up to date";
          } else if (remoteChanged && (!localChanged || !base)) {
            if (!base && localChanged && !quiet) {
              const useDrive = confirm(
                "Google Drive already has a School Setup from another computer.\n\nOK = use the Drive version here (replaces this computer's setup)\nCancel = keep this computer's setup and overwrite Drive",
              );
              if (!useDrive) {
                await upload(file.id, local);
                outcome = "Uploaded to Drive";
              }
            }
            if (!outcome) {
              R.replaceAll(remote, { keepTimestamp: true, source: "drive" });
              outcome = "Updated from Drive";
            }
          } else if (localChanged && !remoteChanged) {
            await upload(file.id, local);
            outcome = "Uploaded to Drive";
          } else {
            // Both sides changed since the last sync
            if (quiet) throw new Error("Changes on Drive and here — open Sync & Backup to choose");
            const useDrive = confirm(
              "School Setup changed both here and on Google Drive since the last sync.\n\nOK = use the Drive version (replaces this computer's changes)\nCancel = keep this computer's version and overwrite Drive",
            );
            if (useDrive) {
              R.replaceAll(remote, { keepTimestamp: true, source: "drive" });
              outcome = "Updated from Drive";
            } else {
              await upload(file.id, local);
              outcome = "Uploaded to Drive";
            }
          }
        }
        m.lastSyncedUpdatedAt = R.get().updatedAt;
        m.lastSyncTime = Date.now();
        saveMeta(m);
        setStatus("ok", "Synced");
        if (!quiet || outcome === "Updated from Drive") toast(outcome, "success");
      } catch (e) {
        console.error("[SchoolSetup] Drive sync failed", e);
        const expired = e && (e.status === 401 || /401/.test(String(e.message)));
        if (expired && svc) svc.isSignedIn = false;
        setStatus("error", expired ? "Sign-in expired" : "Sync failed");
        toast(expired ? "Google sign-in expired — connect again" : "Drive sync failed: " + (e.message || e), "error");
      } finally {
        busy = false;
      }
    }

    function scheduleAutoSync() {
      if (!svc || !svc.isSignedIn || !$("ss-auto-sync").checked) return;
      clearTimeout(timer);
      timer = setTimeout(() => syncNow({ quiet: true }), 1500);
    }

    async function connect() {
      if (!svc) {
        toast("Google Drive isn't available on this page", "error");
        return;
      }
      setStatus("busy", "Connecting…");
      const ok = await svc.init();
      if (!ok) {
        setStatus("error", "Drive unavailable");
        return;
      }
      if (svc.isSignedIn) {
        syncNow();
        return;
      }
      const original = svc.tokenClient.callback;
      svc.tokenClient.callback = (resp) => {
        if (typeof original === "function") original(resp);
        if (resp && resp.access_token) syncNow();
        else setStatus("off", "Not connected");
      };
      svc.signIn();
    }

    function disconnect() {
      if (svc) svc.signOut();
      setStatus("off", "Not connected");
    }

    async function resume() {
      // Reconnect silently when this browser tab already has a Drive token
      if (!svc) return setStatus("off", "Not connected");
      let cached = null;
      try {
        cached = sessionStorage.getItem("gds_token");
      } catch (e) {}
      if (!cached) return setStatus("off", meta().lastSyncTime ? "Not connected" : "Not synced");
      const ok = await svc.init();
      if (ok && svc.isSignedIn) syncNow({ quiet: true });
      else setStatus("off", "Not connected");
    }

    function loadPrefs() {
      $("ss-auto-sync").checked = meta().auto !== false;
    }
    function savePrefs() {
      const m = meta();
      m.auto = $("ss-auto-sync").checked;
      saveMeta(m);
    }

    return { connect, disconnect, syncNow, scheduleAutoSync, resume, setStatus, loadPrefs, savePrefs };
  })();

  // ── events ───────────────────────────────────────────
  function bind() {
    document.querySelectorAll(".ss-tab").forEach((tab) =>
      tab.addEventListener("click", () => {
        document.querySelectorAll(".ss-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
        document.querySelectorAll(".ss-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
        try {
          sessionStorage.setItem("ssTab", tab.dataset.tab);
        } catch (e) {}
      }),
    );
    try {
      const saved = sessionStorage.getItem("ssTab");
      const tab = saved && document.querySelector(`.ss-tab[data-tab="${saved}"]`);
      if (tab) tab.click();
    } catch (e) {}

    document.addEventListener("click", (e) => {
      const closer = e.target.closest("[data-close]");
      if (closer) closeOverlay(closer.dataset.close);
      if (e.target.classList && e.target.classList.contains("ss-overlay")) closeOverlay(e.target.id);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".ss-overlay:not([hidden])").forEach((o) => closeOverlay(o.id));
    });

    $("ss-year-btn").addEventListener("click", () => setYearMenu($("ss-year-menu").hidden));
    $("ss-year-menu").addEventListener("click", (e) => {
      const opt = e.target.closest(".ss-year-option");
      if (!opt) return;
      setYearMenu(false);
      if (opt.hasAttribute("data-new-year")) {
        openNewYear();
        return;
      }
      const y = opt.dataset.year;
      if (y === viewYear()) return;
      selectedGroup = null;
      R.setActiveYear(y);
      toast(`Showing ${y} — every tool now uses this year's lists`, "info");
    });
    $("ss-year-menu").addEventListener("keydown", (e) => {
      const opts = [...$("ss-year-menu").querySelectorAll(".ss-year-option")];
      const i = opts.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = opts[(i + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length];
        if (next) next.focus();
      } else if (e.key === "Escape") {
        setYearMenu(false);
        $("ss-year-btn").focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (!$("ss-year-menu").hidden && !e.target.closest("#ss-year-picker")) setYearMenu(false);
    });
    $("ss-new-year-btn").addEventListener("click", openNewYear);
    $("ss-year-create").addEventListener("click", createYear);
    $("ss-year-input").addEventListener("keydown", (e) => e.key === "Enter" && createYear());

    $("ss-group-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-group]");
      if (!btn) return;
      selectedGroup = btn.dataset.group;
      renderGroups();
      renderRoster();
    });
    $("ss-add-group-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = attempt(() => R.addGroup($("ss-add-group-input").value, viewYear()));
      if (!id) return;
      selectedGroup = id;
      $("ss-add-group-input").value = "";
      renderGroups();
      renderRoster();
    });
    $("ss-delete-group-btn").addEventListener("click", () => {
      const g = R.group(selectedGroup, viewYear());
      if (!g) return;
      if (!confirm(`Delete group ${g.id} and its list of ${g.students.length} students for ${viewYear()}?\n\nSaved grade sheets are not deleted.`)) return;
      attempt(() => R.removeGroup(g.id, viewYear()));
      selectedGroup = null;
    });

    $("ss-add-student-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("ss-add-student-input");
      const res = attempt(() => R.addStudents(selectedGroup, [input.value], viewYear()));
      if (!res) return;
      if (res.skipped.length) toast(res.skipped[0] + " is already on the list", "error");
      input.value = "";
      input.focus();
    });
    $("ss-roster-body").addEventListener("click", onRosterClick);
    $("ss-show-withdrawn").addEventListener("change", renderRoster);

    $("ss-import-btn").addEventListener("click", () => openImport("group"));
    $("ss-import-multi-btn").addEventListener("click", () => openImport("multi"));
    $("ss-import-text").addEventListener("input", updateImportPreview);
    document.querySelectorAll('input[name="ss-import-mode"]').forEach((r) => r.addEventListener("change", updateImportPreview));
    $("ss-import-file").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      $("ss-import-file-name").textContent = file.name;
      try {
        $("ss-import-text").value = await readImportFile(file);
        updateImportPreview();
      } catch (err) {
        toast(err.message || "Could not read the file", "error");
      }
    });
    $("ss-import-confirm").addEventListener("click", executeImport);

    $("ss-subject-list").addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("input[type=checkbox][data-subject]")) {
        const boxes = document.querySelectorAll(`input[type=checkbox][data-subject="${t.dataset.subject}"]:checked`);
        attempt(() => R.updateSubject(t.dataset.subject, { groups: [...boxes].map((b) => b.dataset.group) }, viewYear()));
      } else if (t.matches(".ss-subject-name")) {
        attempt(() => R.updateSubject(t.dataset.subject, { name: t.value }, viewYear()));
      }
    });
    $("ss-subject-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-subject]");
      if (!btn) return;
      const sub = R.subjects(viewYear()).find((s) => s.id === btn.dataset.removeSubject);
      if (sub && confirm(`Delete the subject ${sub.name}? Grade sheets already created are kept.`))
        attempt(() => R.removeSubject(sub.id, viewYear()));
    });
    $("ss-add-subject-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = attempt(() => R.addSubject($("ss-add-subject-input").value, [], viewYear()));
      if (ok) $("ss-add-subject-input").value = "";
    });

    $("ss-drive-connect").addEventListener("click", Sync.connect);
    $("ss-drive-sync").addEventListener("click", () => Sync.syncNow());
    $("ss-drive-disconnect").addEventListener("click", Sync.disconnect);
    $("ss-auto-sync").addEventListener("change", Sync.savePrefs);
    $("ss-sync-chip").addEventListener("click", () => {
      const tab = document.querySelector('.ss-tab[data-tab="sync"]');
      if (tab) tab.click();
    });
    $("ss-backup-download").addEventListener("click", downloadBackup);
    $("ss-backup-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) restoreBackup(file);
    });

    R.onChange((e) => {
      renderAll();
      const source = e.detail && e.detail.source;
      if (source !== "drive" && source !== "storage") Sync.scheduleAutoSync();
    });
  }

  function init() {
    if (!R) {
      document.body.innerHTML = "<p style='padding:40px'>School roster module failed to load.</p>";
      return;
    }
    bind();
    Sync.loadPrefs();
    renderAll();
    Sync.resume();
  }

  init();
})();
