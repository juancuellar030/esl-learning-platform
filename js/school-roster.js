/**
 * SchoolRoster — shared school-year setup for every tool.
 *
 * Holds the school years, grade levels, groups, student rosters and subjects
 * in localStorage ("eslSchoolSetup"), so every page on the platform reads the
 * same lists. Managed from school-setup.html.
 *
 * Load this file BEFORE js/student-groups-data.js. That file then exposes the
 * active year's roster (active students only) as the legacy STUDENT_GROUPS
 * map, so older tools keep working without changes.
 *
 * Shape:
 * {
 *   version: 1,
 *   updatedAt: <ms>,
 *   activeYear: "2026",
 *   years: {
 *     "2026": {
 *       levels: { "3": "TERCERO", ... },
 *       groups: [{ id: "3A", level: 3, students: [
 *         { id, name, status: "active" | "withdrawn", withdrawnOn: "YYYY-MM-DD", note }
 *       ] }],
 *       subjects: [{ id, name, groups: ["3A", "3B", ...] }]
 *     }
 *   }
 * }
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "eslSchoolSetup";
  const CHANGE_EVENT = "schoolsetup:change";
  const LEVEL_NAMES = {
    0: "TRANSICIÓN",
    1: "PRIMERO",
    2: "SEGUNDO",
    3: "TERCERO",
    4: "CUARTO",
    5: "QUINTO",
    6: "SEXTO",
    7: "SÉPTIMO",
    8: "OCTAVO",
    9: "NOVENO",
    10: "DÉCIMO",
    11: "UNDÉCIMO",
  };

  let cache = null;

  // ── helpers ──────────────────────────────────────────
  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function normalizeName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9Ñ ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanName(name) {
    return String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleUpperCase("es");
  }

  function compareNames(a, b) {
    return normalizeName(a).localeCompare(normalizeName(b));
  }

  function levelOfGroup(groupId) {
    const m = String(groupId || "").match(/^\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function compareGroups(a, b) {
    return String(a.id || a).localeCompare(String(b.id || b), undefined, {
      numeric: true,
    });
  }

  function slug(text) {
    return (
      normalizeName(text).toLowerCase().replace(/\s+/g, "-") || uid("subject")
    );
  }

  function currentYearString() {
    return String(new Date().getFullYear());
  }

  // ── storage ──────────────────────────────────────────
  function read() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      cache = raw ? JSON.parse(raw) : null;
    } catch (e) {
      cache = null;
    }
    return cache;
  }

  function write(setup, opts) {
    const options = opts || {};
    if (!options.keepTimestamp) setup.updatedAt = Date.now();
    cache = setup;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    } catch (e) {
      console.error("[SchoolRoster] Could not save setup", e);
    }
    try {
      global.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: { source: options.source || "local" } }),
      );
    } catch (e) {}
    return setup;
  }

  // Other tabs/pages changed the setup
  try {
    global.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      cache = null;
      try {
        global.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: "storage" } }));
      } catch (err) {}
    });
  } catch (e) {}

  function emptyYear() {
    return { levels: {}, groups: [], subjects: [] };
  }

  // First run: build the current year from the bundled roster and from the
  // subject/group pairs already used in Grade Sheets.
  function seedFrom(seedGroups) {
    const year = "2026";
    const y = emptyYear();
    Object.keys(seedGroups || {})
      .sort((a, b) => compareGroups(a, b))
      .forEach((gid) => {
        const level = levelOfGroup(gid);
        if (level != null && !y.levels[level]) y.levels[level] = LEVEL_NAMES[level] || "GRADE " + level;
        y.groups.push({
          id: gid,
          level,
          students: (seedGroups[gid] || []).map((name) => ({
            id: uid("st"),
            name: cleanName(name),
            status: "active",
          })),
        });
      });

    try {
      const sheets = JSON.parse(localStorage.getItem("gradeSheets")) || [];
      const bySubject = new Map();
      sheets.forEach((s) => {
        const name = String(s.subject || "").trim();
        if (!name) return;
        const key = normalizeName(name);
        if (!bySubject.has(key)) bySubject.set(key, { name, groups: new Set() });
        if (s.group) bySubject.get(key).groups.add(s.group);
      });
      bySubject.forEach((v) =>
        y.subjects.push({
          id: slug(v.name),
          name: v.name,
          groups: [...v.groups].sort((a, b) => compareGroups(a, b)),
        }),
      );
    } catch (e) {}

    return { version: 1, updatedAt: Date.now(), activeYear: year, years: { [year]: y } };
  }

  // ── public read API ──────────────────────────────────
  function init(seedGroups) {
    let setup = read();
    if (!setup || !setup.years || !Object.keys(setup.years).length) {
      setup = write(seedFrom(seedGroups), { source: "seed" });
    }
    return activeMap();
  }

  function get() {
    return read() || { version: 1, updatedAt: 0, activeYear: currentYearString(), years: {} };
  }

  function activeYear() {
    const s = get();
    if (s.activeYear && s.years[s.activeYear]) return s.activeYear;
    const ys = years();
    return ys.length ? ys[ys.length - 1] : currentYearString();
  }

  function years() {
    return Object.keys(get().years || {}).sort();
  }

  function year(y) {
    const s = get();
    return (s.years || {})[y || activeYear()] || null;
  }

  function groups(y) {
    const yr = year(y);
    return yr ? [...yr.groups].sort(compareGroups) : [];
  }

  function group(groupId, y) {
    return groups(y).find((g) => g.id === groupId) || null;
  }

  function students(groupId, opts) {
    const o = opts || {};
    const g = group(groupId, o.year);
    if (!g) return [];
    return g.students
      .filter((st) => o.includeWithdrawn || st.status !== "withdrawn")
      .slice()
      .sort((a, b) => compareNames(a.name, b.name));
  }

  function names(groupId, opts) {
    return students(groupId, opts).map((st) => st.name);
  }

  // { "3A": ["NAME", ...], ... } — active students of the year
  function activeMap(y) {
    const map = {};
    groups(y).forEach((g) => {
      map[g.id] = names(g.id, { year: y });
    });
    return map;
  }

  function levelName(level, y) {
    const yr = year(y);
    return (yr && yr.levels && yr.levels[level]) || LEVEL_NAMES[level] || "GRADE " + level;
  }

  function levels(y) {
    const yr = year(y);
    if (!yr) return [];
    const nums = new Set(Object.keys(yr.levels || {}).map(Number));
    yr.groups.forEach((g) => g.level != null && nums.add(g.level));
    return [...nums].sort((a, b) => a - b).map((n) => ({ level: n, name: levelName(n, y) }));
  }

  function subjects(y) {
    const yr = year(y);
    return yr ? [...yr.subjects].sort((a, b) => a.name.localeCompare(b.name)) : [];
  }

  function subjectByName(name, y) {
    const key = normalizeName(name);
    return subjects(y).find((s) => normalizeName(s.name) === key) || null;
  }

  function findStudent(name, groupId, y) {
    const key = normalizeName(name);
    const g = group(groupId, y);
    return g ? g.students.find((st) => normalizeName(st.name) === key) || null : null;
  }

  function onChange(cb) {
    global.addEventListener(CHANGE_EVENT, cb);
    return () => global.removeEventListener(CHANGE_EVENT, cb);
  }

  // ── mutations (all go through update) ────────────────
  function update(mutator, opts) {
    const setup = JSON.parse(JSON.stringify(get()));
    const result = mutator(setup);
    write(setup, opts);
    return result;
  }

  function mutableYear(setup, y) {
    const key = y || setup.activeYear || currentYearString();
    if (!setup.years[key]) setup.years[key] = emptyYear();
    return setup.years[key];
  }

  function mutableGroup(setup, groupId, y) {
    const g = mutableYear(setup, y).groups.find((x) => x.id === groupId);
    if (!g) throw new Error("Group " + groupId + " not found");
    return g;
  }

  const actions = {
    setActiveYear(y) {
      return update((s) => {
        mutableYear(s, y);
        s.activeYear = y;
      });
    },

    // copyFrom: copy levels, groups (empty rosters) and subjects of that year
    createYear(y, copyFrom) {
      return update((s) => {
        if (s.years[y]) throw new Error("School year " + y + " already exists");
        const src = copyFrom && s.years[copyFrom];
        s.years[y] = src
          ? {
              levels: { ...src.levels },
              groups: src.groups.map((g) => ({ id: g.id, level: g.level, students: [] })),
              subjects: src.subjects.map((sub) => ({ ...sub, groups: [...sub.groups] })),
            }
          : emptyYear();
      });
    },

    deleteYear(y) {
      return update((s) => {
        delete s.years[y];
        if (s.activeYear === y) {
          const rest = Object.keys(s.years).sort();
          s.activeYear = rest.length ? rest[rest.length - 1] : currentYearString();
        }
      });
    },

    setLevelName(level, name, y) {
      return update((s) => {
        mutableYear(s, y).levels[level] = String(name || "").trim().toUpperCase() || LEVEL_NAMES[level];
      });
    },

    addGroup(groupId, y) {
      const id = String(groupId || "").trim().toUpperCase();
      if (!/^\d+\s*[A-Z0-9]*$/.test(id)) throw new Error("Group names start with the grade number, e.g. 3A");
      return update((s) => {
        const yr = mutableYear(s, y);
        if (yr.groups.some((g) => g.id === id)) throw new Error("Group " + id + " already exists");
        const level = levelOfGroup(id);
        if (level != null && !yr.levels[level]) yr.levels[level] = LEVEL_NAMES[level] || "GRADE " + level;
        yr.groups.push({ id, level, students: [] });
        return id;
      });
    },

    removeGroup(groupId, y) {
      return update((s) => {
        const yr = mutableYear(s, y);
        yr.groups = yr.groups.filter((g) => g.id !== groupId);
        yr.subjects.forEach((sub) => (sub.groups = sub.groups.filter((g) => g !== groupId)));
      });
    },

    // Adds names that aren't on the roster yet. Returns { added, skipped }.
    addStudents(groupId, nameList, y) {
      return update((s) => {
        const g = mutableGroup(s, groupId, y);
        const seen = new Set(g.students.map((st) => normalizeName(st.name)));
        const added = [];
        const skipped = [];
        (nameList || []).forEach((raw) => {
          const name = cleanName(raw);
          if (!name) return;
          const key = normalizeName(name);
          if (seen.has(key)) {
            skipped.push(name);
            return;
          }
          seen.add(key);
          g.students.push({ id: uid("st"), name, status: "active" });
          added.push(name);
        });
        return { added, skipped };
      });
    },

    // Replaces the roster; students not in the list are withdrawn (not deleted)
    replaceRoster(groupId, nameList, y) {
      return update((s) => {
        const g = mutableGroup(s, groupId, y);
        const incoming = new Map();
        (nameList || []).forEach((raw) => {
          const name = cleanName(raw);
          if (name) incoming.set(normalizeName(name), name);
        });
        const today = new Date().toISOString().slice(0, 10);
        const result = { added: [], kept: [], withdrawn: [] };
        g.students.forEach((st) => {
          const key = normalizeName(st.name);
          if (incoming.has(key)) {
            st.status = "active";
            delete st.withdrawnOn;
            result.kept.push(st.name);
            incoming.delete(key);
          } else if (st.status !== "withdrawn") {
            st.status = "withdrawn";
            st.withdrawnOn = today;
            result.withdrawn.push(st.name);
          }
        });
        incoming.forEach((name) => {
          g.students.push({ id: uid("st"), name, status: "active" });
          result.added.push(name);
        });
        return result;
      });
    },

    renameStudent(groupId, studentId, newName, y) {
      return update((s) => {
        const g = mutableGroup(s, groupId, y);
        const st = g.students.find((x) => x.id === studentId);
        if (!st) throw new Error("Student not found");
        const name = cleanName(newName);
        if (!name) throw new Error("Name cannot be empty");
        const clash = g.students.find((x) => x.id !== studentId && normalizeName(x.name) === normalizeName(name));
        if (clash) throw new Error(name + " is already in " + groupId);
        const oldName = st.name;
        st.name = name;
        return { oldName, newName: name };
      });
    },

    setStudentStatus(groupId, studentId, status, details, y) {
      return update((s) => {
        const st = mutableGroup(s, groupId, y).students.find((x) => x.id === studentId);
        if (!st) throw new Error("Student not found");
        st.status = status === "withdrawn" ? "withdrawn" : "active";
        if (st.status === "withdrawn") {
          st.withdrawnOn = (details && details.date) || new Date().toISOString().slice(0, 10);
          st.note = (details && details.note) || st.note || "";
        } else {
          delete st.withdrawnOn;
        }
        return st.name;
      });
    },

    moveStudent(fromGroup, studentId, toGroup, y) {
      return update((s) => {
        const from = mutableGroup(s, fromGroup, y);
        const to = mutableGroup(s, toGroup, y);
        const idx = from.students.findIndex((x) => x.id === studentId);
        if (idx === -1) throw new Error("Student not found");
        const st = from.students[idx];
        if (to.students.some((x) => normalizeName(x.name) === normalizeName(st.name)))
          throw new Error(st.name + " is already in " + toGroup);
        from.students.splice(idx, 1);
        to.students.push(st);
        return st.name;
      });
    },

    deleteStudent(groupId, studentId, y) {
      return update((s) => {
        const g = mutableGroup(s, groupId, y);
        const st = g.students.find((x) => x.id === studentId);
        g.students = g.students.filter((x) => x.id !== studentId);
        return st ? st.name : null;
      });
    },

    addSubject(name, groupIds, y) {
      const clean = String(name || "").trim();
      if (!clean) throw new Error("Subject name is required");
      return update((s) => {
        const yr = mutableYear(s, y);
        if (yr.subjects.some((sub) => normalizeName(sub.name) === normalizeName(clean)))
          throw new Error(clean + " already exists");
        const subject = { id: uid("sub"), name: clean, groups: [...(groupIds || [])].sort((a, b) => compareGroups(a, b)) };
        yr.subjects.push(subject);
        return subject.id;
      });
    },

    updateSubject(subjectId, changes, y) {
      return update((s) => {
        const yr = mutableYear(s, y);
        const sub = yr.subjects.find((x) => x.id === subjectId);
        if (!sub) throw new Error("Subject not found");
        if (changes.name != null) {
          const clean = String(changes.name).trim();
          if (!clean) throw new Error("Subject name is required");
          if (yr.subjects.some((x) => x.id !== subjectId && normalizeName(x.name) === normalizeName(clean)))
            throw new Error(clean + " already exists");
          sub.name = clean;
        }
        if (changes.groups) sub.groups = [...changes.groups].sort((a, b) => compareGroups(a, b));
      });
    },

    removeSubject(subjectId, y) {
      return update((s) => {
        const yr = mutableYear(s, y);
        yr.subjects = yr.subjects.filter((x) => x.id !== subjectId);
      });
    },

    // Whole-setup replace (backup import / Drive pull)
    replaceAll(setup, opts) {
      if (!setup || typeof setup !== "object" || !setup.years) throw new Error("Not a school setup file");
      const copy = JSON.parse(JSON.stringify(setup));
      copy.version = copy.version || 1;
      return write(copy, { keepTimestamp: !!(opts && opts.keepTimestamp), source: (opts && opts.source) || "import" });
    },
  };

  global.SchoolRoster = {
    STORAGE_KEY,
    CHANGE_EVENT,
    LEVEL_NAMES,
    init,
    get,
    activeYear,
    years,
    year,
    groups,
    group,
    students,
    names,
    activeMap,
    levels,
    levelName,
    levelOfGroup,
    subjects,
    subjectByName,
    findStudent,
    normalizeName,
    compareNames,
    onChange,
    ...actions,
  };
})(window);
