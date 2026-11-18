/**
 * Class Redistribution / Redistribución de Grupos
 *
 * Builds next school year's groups for one grade from this year's rosters
 * (SchoolRoster), e.g. "2026 · 3rd grade → 2027 · 4th grade".
 *
 * PRIVACY: ratings, links, notes and gender stay ONLY in this device's
 * localStorage under "eslClassRedistribution". They are never written to
 * SchoolRoster ("eslSchoolSetup"), the project's data files or Google Drive.
 * "Finalize" copies names and group assignments only.
 *
 * Storage shape:
 * {
 *   version: 1,
 *   grades: {
 *     "2026:3": {
 *       profiles: { <studentKey>: { behavior, academic, gender, influence, family, note, status } },
 *       extras:   { <id>: { id, name, source: "new" | "repeater", from, rosterId } },
 *       links:    [{ id, type: "apart" | "together", members: [keys], reason }],
 *       plans:    [{ id, name, target, mix, groups: [{ id, name }], assign: { key: groupId | "u" },
 *                    pinned: { key: true }, finalizedAt }],
 *       activePlanId
 *     }
 *   }
 * }
 * studentKey = SchoolRoster student id, or the extra's id for added students.
 */
(function () {
  "use strict";

  // ═══════════════════════════ CONFIG ═══════════════════════════
  const STORE_KEY = "eslClassRedistribution";
  const LANG_KEY = "eslClassRedistributionLang";
  const UI_KEY = "eslClassRedistributionUi";
  const MAX_NEW_LEVEL = 5; // new groups can be 5th grade at most
  const MAX_GROUPS = 8;
  const HISTORY_LIMIT = 60;
  const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
  const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  // Imbalance flags: a new group is compared with the average of the others
  const FLAG_LIMITS = {
    sizeDiff: 2, // students more / fewer than the other groups
    genderGap: 3, // |boys − girls| inside one group
    needsSupportExcess: 2, // more "needs a lot of support" than the others
    offTaskExcess: 2, // more "draws peers off-task" than the others
    leadersShortfall: 2, // fewer positive leaders than the others
  };

  // Rating categories. Order = order of the 5 summary dots on each card.
  const CATEGORIES = [
    {
      id: "behavior",
      icon: "fa-hand-holding-heart",
      levels: [
        { v: "lot", color: "#c62828", icon: "fa-circle-exclamation" },
        { v: "some", color: "#e65100", icon: "fa-hand" },
        { v: "coop", color: "#558b2f", icon: "fa-thumbs-up" },
        { v: "high", color: "#1b7f4b", icon: "fa-star" },
      ],
    },
    {
      id: "academic",
      icon: "fa-book-open",
      levels: [
        { v: "high", color: "#1d4ed8", icon: "fa-rocket" },
        { v: "steady", color: "#a16207", icon: "fa-check" },
        { v: "motivation", color: "#be185d", icon: "fa-battery-quarter" },
      ],
    },
    {
      id: "gender",
      icon: "fa-children",
      levels: [
        { v: "boy", color: "#0891b2", icon: "fa-mars" },
        { v: "girl", color: "#9061c2", icon: "fa-venus" },
      ],
    },
    {
      id: "influence",
      icon: "fa-people-group",
      levels: [
        { v: "leader", color: "#15803d", icon: "fa-crown" },
        { v: "follows", color: "#64748b", icon: "fa-user-group" },
        { v: "offtask", color: "#c2410c", icon: "fa-bolt" },
      ],
    },
    {
      id: "family",
      icon: "fa-house-user",
      levels: [
        { v: "supportive", color: "#0f766e", icon: "fa-handshake" },
        { v: "neutral", color: "#78716c", icon: "fa-minus" },
        { v: "questions", color: "#7e22ce", icon: "fa-comment-dots" },
      ],
    },
  ];
  const CAT = {};
  CATEGORIES.forEach((c) => (CAT[c.id] = c));

  // Auto-balance weights (higher = spread more evenly)
  const BALANCE_WEIGHTS = {
    size: 6,
    "gender:boy": 3,
    "gender:girl": 3,
    "behavior:lot": 4,
    "behavior:some": 2.5,
    "behavior:coop": 1.5,
    "behavior:high": 1.5,
    "academic:high": 1.5,
    "academic:steady": 1,
    "academic:motivation": 2,
    "influence:leader": 4,
    "influence:follows": 1,
    "influence:offtask": 4,
    "family:supportive": 1,
    "family:neutral": 0.5,
    "family:questions": 2,
    prev: 0.8, // per previous group, only when "mix previous groups" is on
    link: 40, // per broken keep-apart / keep-together pair
  };
  const IMPORTANT_LEVELS = new Set(["behavior:lot", "influence:leader", "influence:offtask"]);

  // ═══════════════════════════ TRANSLATIONS ═══════════════════════════
  // All interface, export and dialog texts. {name} = placeholder.
  const I18N = {
    en: {
      "app.title": "Class Redistribution",
      "app.subtitle": "Build next school year's groups from this year's rosters",
      "nav.tools": "Tools",
      "privacy.short": "Private · this device only",
      "privacy.tip":
        "Ratings, links and notes are saved only in this browser on this computer. They are never synced to Google Drive or copied to School Setup.",
      "privacy.profile": "Ratings, links and notes stay on this computer only. Finalize copies names and groups, nothing else.",
      "saved.at": "Saved {time}",

      "tb.year": "School year",
      "tb.grade": "Current grade",
      "tb.plan": "Plan",
      "tb.planActions": "Plan options",
      "tb.groupCount": "New groups",
      "tb.target": "Target size",
      "tb.targetNone": "Any",
      "tb.undo": "Undo (Ctrl+Z)",
      "tb.redo": "Redo (Ctrl+Y)",
      "tb.links": "Links ({n})",
      "tb.autoBalance": "Auto-balance",
      "tb.export": "Export",
      "tb.backup": "Backup",
      "tb.finalize": "Finalize",

      "vb.highlight": "Highlight",
      "vb.all": "Everyone",
      "vb.selectMode": "Select",
      "vb.fastRateHint": "Click a card's label to switch to the next level",

      "cat.behavior": "Behavior",
      "cat.academic": "Academic commitment",
      "cat.gender": "Gender",
      "cat.influence": "Peer influence",
      "cat.family": "Family relationship with the school",
      "catShort.behavior": "Behavior",
      "catShort.academic": "Academic",
      "catShort.gender": "Gender",
      "catShort.influence": "Influence",
      "catShort.family": "Family",

      "lv.behavior.lot": "Needs a lot of support",
      "lv.behavior.some": "Needs some support",
      "lv.behavior.coop": "Generally cooperative",
      "lv.behavior.high": "Highly cooperative",
      "lv.academic.high": "Highly committed",
      "lv.academic.steady": "Steady",
      "lv.academic.motivation": "Needs motivation",
      "lv.gender.boy": "Boy",
      "lv.gender.girl": "Girl",
      "lv.influence.leader": "Positive leader",
      "lv.influence.follows": "Follows the group",
      "lv.influence.offtask": "Draws peers off-task",
      "lv.family.supportive": "Supportive",
      "lv.family.neutral": "Neutral",
      "lv.family.questions": "Often questions the school",
      "lvs.behavior.lot": "Much support",
      "lvs.behavior.some": "Some support",
      "lvs.behavior.coop": "Cooperative",
      "lvs.behavior.high": "Very cooperative",
      "lvs.academic.high": "Committed",
      "lvs.academic.steady": "Steady",
      "lvs.academic.motivation": "Needs motivation",
      "lvs.gender.boy": "Boy",
      "lvs.gender.girl": "Girl",
      "lvs.influence.leader": "Positive leader",
      "lvs.influence.follows": "Follows group",
      "lvs.influence.offtask": "Draws off-task",
      "lvs.family.supportive": "Supportive",
      "lvs.family.neutral": "Neutral",
      "lvs.family.questions": "Questions school",
      notRated: "Not rated",
      notRatedShort: "Not rated",

      "gender.unconfirmed": "suggested, not confirmed",
      "gender.suggested": "Suggested from the name: {g}.",
      "gender.confirm": "Confirm",
      "gender.notSet": "Gender not set",

      "card.from": "from {g}",
      "badge.new": "New",
      "badge.repeater": "Repeating",
      "badge.repeats": "Repeats {grade}",

      "tip.chip": "{cat}: {level} · click for the next level",
      "tip.pin": "Pin in this group (auto-balance won't move this student)",
      "tip.unpin": "Pinned · click to unpin",
      "tip.moveTo": "Move to…",
      "tip.hasNote": "Has a private note",
      "tip.links": "Keep-apart and keep-together links",
      "tip.brokenLinks.one": "{n} link is broken",
      "tip.brokenLinks.other": "{n} links are broken",
      "tip.addRepeater": "Add a current {grade} student who will repeat the grade",

      "warn.apart": "Keep apart: in the same group as {names}",
      "warn.together": "Keep together: separated from {names}",
      "warn.reason": "Reason: {reason}",

      "left.current": "Current groups · {year}",
      "left.toPlace": "{n} of {total} to place",
      "left.allPlaced": "Everyone is placed",
      "zone.unassigned": "Unassigned",
      "zone.unassignedEmpty": "Drop students here to set them aside",
      "zone.notReturning": "Not returning",
      "zone.notReturningHelp": "Leaving the school. Not included in the new groups.",
      "zone.repeating": "Repeating {grade}",
      "zone.repeatingHelp": "Stays in the same grade. Taken out of this redistribution.",
      "zone.dropHere": "Drop students here",
      "loc.inGroup": "In {g}",
      "loc.notPlaced": "Not placed yet",
      "loc.repeating": "Repeating {grade}",

      "btn.addNew": "Add new student",
      "btn.addRepeater": "Add repeating student",
      "btn.add": "Add",
      "btn.cancel": "Cancel",
      "btn.close": "Close",
      "btn.delete": "Delete",
      "btn.edit": "Edit",
      "btn.ok": "OK",
      "btn.remove": "Remove",
      "btn.save": "Save",

      "col.rename": "Group name (click to rename)",
      "col.empty": "Drag students here",

      "sum.students.one": "student",
      "sum.students.other": "students",
      "sum.guessed.one": "{n} gender is only suggested",
      "sum.guessed.other": "{n} genders are only suggested",
      "sum.new": "New: {n}",
      "sum.repeaters": "Repeating: {n}",
      "sum.broken": "Broken links: {n}",
      "sum.newLabel": "New students",
      "sum.brokenLabel": "Broken links",

      "flag.bigger": "{n} more students than the other groups",
      "flag.smaller": "{n} fewer students than the other groups",
      "flag.overTarget": "{n} over the target size",
      "flag.genderGap": "Gender gap: {boys} boys, {girls} girls",
      "flag.needsSupport": "Many students who need a lot of support ({n})",
      "flag.offTask": "Many students who draw peers off-task ({n})",
      "flag.fewLeaders": "Few positive leaders ({n})",
      "flag.brokenLinks.one": "{n} broken link",
      "flag.brokenLinks.other": "{n} broken links",

      "sel.count.one": "{n} selected",
      "sel.count.other": "{n} selected",
      "sel.moveTo": "Move to…",
      "sel.pin": "Pin",
      "sel.unpin": "Unpin",
      "sel.clear": "Clear",
      "sel.done": "Done",
      "sel.hint": "Tap cards to select them",

      "move.toGroup": "Move to {g}",
      "move.backTo": "Back to {g}",
      "move.backToPrevious": "Back to their previous groups",

      "profile.pin": "Pin in group",
      "profile.pinned": "Pinned",
      "profile.note": "Private note",
      "profile.notePh": "Only you can see this note",
      "profile.status": "Status",
      "profile.restore": "Bring back into this redistribution",
      "profile.removeExtra": "Remove from list",
      "confirm.removeExtra": "Remove {name} from this grade's list? Their ratings, note and links will be deleted.",

      "links.title": "Links",
      "links.none": "No links yet.",
      "links.noneAll": "No links yet. Add one to keep students apart or together.",
      "links.apart": "Keep apart",
      "links.together": "Keep together",
      "links.addApart": "Keep apart",
      "links.addTogether": "Keep together",
      "links.broken": "Not honored in this plan",
      "links.ok": "Honored",
      "links.reason": "Reason (optional)",
      "links.reasonPh": "e.g. conflict during recess",
      "links.modalApart": "Keep apart",
      "links.modalTogether": "Keep together",
      "links.helpApart": "Choose two or more students who should not share a group.",
      "links.helpTogether": "Choose two or more students who should be in the same group.",
      "links.helpApartWith": "Choose the students who should not share a group with {name}.",
      "links.helpTogetherWith": "Choose the students who should be in the same group as {name}.",
      "links.needOne": "Choose at least one student.",
      "links.needTwo": "Choose at least two students.",
      "links.removeTitle": "Remove link",
      "links.removeMsg": "Remove this link?",
      "links.overviewTitle": "Student links",

      "picker.search": "Search by name…",

      "add.newTitle": "Add a new student",
      "add.newHelp": "For late enrollments. They start in Unassigned.",
      "add.name": "Full name",
      "add.note": "Note (optional, private)",
      "add.nameRequired": "Write the student's name.",
      "add.duplicate": "{name} is already on the list.",
      "add.added": "{name} added to Unassigned.",
      "add.repTitle": "Add repeating students",
      "add.repHelp": "Current {grade} students who will repeat the grade in {next}. They join this redistribution with a \"Repeating\" badge.",
      "add.repNone": "No students left to add.",
      "add.repAdded.one": "{n} repeating student added to Unassigned.",
      "add.repAdded.other": "{n} repeating students added to Unassigned.",

      "plan.defaultName": "Plan {letter}",
      "plan.new": "New plan",
      "plan.duplicate": "Duplicate plan",
      "plan.rename": "Rename plan",
      "plan.delete": "Delete plan",
      "plan.name": "Plan name",
      "plan.copyOf": "{name} (copy)",
      "plan.deleteMsg": "Delete \"{name}\"? Ratings, links and notes are kept; only this plan's groups are deleted.",

      "groups.removeTitle": "Remove groups",
      "groups.removeMsg.one": "{groups}: {n} student will go back to their previous group.",
      "groups.removeMsg.other": "{groups}: {n} students will go back to their previous groups.",
      "groups.badName": "Group names must start with {n}, e.g. {n}A.",
      "groups.dupName": "There is already a group called {name}.",

      "bal.title": "Auto-balance",
      "bal.modeLabel": "Students to place",
      "bal.modeUnassigned": "Only students not placed yet",
      "bal.modeAll": "Everyone who isn't pinned",
      "bal.mix": "Mix students from different previous groups",
      "bal.working": "Looking for a balanced distribution…",
      "bal.nothing": "There are no students to place.",
      "bal.noneUnassigned": "Everyone is already placed. Choose \"Everyone who isn't pinned\" to redistribute.",
      "bal.nonePinned": "Every student is pinned. Unpin some students to let auto-balance move them.",
      "bal.sizes": "Group sizes: {min} to {max}",
      "bal.gender": "Boys per group: {bmin} to {bmax} · Girls: {gmin} to {gmax}",
      "bal.levels": "Levels spread evenly: {even} of {total}",
      "bal.links": "Links honored: {ok} of {total}",
      "bal.noLinks": "No links to honor",
      "bal.unhonored": "Links it couldn't honor",
      "bal.discard": "Discard",
      "bal.tryAgain": "Try again",
      "bal.apply": "Apply",
      "bal.applied": "Suggestion applied. Undo (Ctrl+Z) reverts it.",

      "fin.title": "Finalize groups",
      "fin.intro": "This creates the {next} · {grade} groups from \"{plan}\" in School Setup:",
      "fin.createYear": "School year {next} doesn't exist yet and will be created. The current active year doesn't change.",
      "fin.clashes": "These groups already have students in {next} and will be replaced: {groups}.",
      "fin.others": "Other groups of this grade already in {next} stay as they are: {groups}.",
      "fin.unplaced.one": "{n} student isn't placed in a group and won't be added.",
      "fin.unplaced.other": "{n} students aren't placed in a group and won't be added.",
      "fin.private": "Only names and group assignments are copied. Ratings, links and notes stay private on this computer.",
      "fin.finalize": "Finalize",
      "fin.replaceAndFinalize": "Replace and finalize",
      "fin.done": "{n} groups created in School Setup for {next}.",
      "fin.skipped.one": "{n} duplicate name was skipped.",
      "fin.skipped.other": "{n} duplicate names were skipped.",
      "fin.error": "Could not finalize: {msg}",

      "backup.download": "Download backup (.json)",
      "backup.load": "Load backup…",
      "backup.downloaded": "Backup downloaded. It contains private ratings and notes: keep it safe.",
      "backup.invalid": "This file isn't a Class Redistribution backup.",
      "backup.loadTitle": "Load backup",
      "backup.loadMsg": "Replace all plans, ratings, links and notes of {scope} with the backup from {date}?",
      "backup.replace": "Replace",
      "backup.loaded": "Backup loaded.",
      "backup.loadedHidden": "Backup saved for {scope}, but that grade isn't in School Setup right now.",

      "export.excel": "Excel (.xlsx)",
      "export.pdf": "PDF (one page per group)",
      "export.preparing": "Preparing the file…",
      "export.libFailed": "Could not load the export library. Check the internet connection.",
      "export.done": "File downloaded.",
      "export.confidential": "Confidential",
      "file.base": "class-redistribution",

      "xl.name": "Name",
      "xl.from": "Previous group",
      "xl.newGroup": "New group",
      "xl.status": "Status",
      "xl.warnings": "Link warnings",
      "xl.groupTitle": "Group {g}",
      "xl.summary": "Summary",
      "xl.summarySheet": "Summary",
      "xl.summaryTitle": "Group balance summary",
      "xl.allSheet": "All students",
      "xl.allTitle": "All students",
      "xl.group": "Group",
      "xl.students": "Students",
      "xl.flags": "Imbalances",
      "xl.linksTotal": "Links",
      "xl.repeaterFrom": "Repeating (from {g})",

      "pdf.from": "From",
      "pdf.cont": "(cont.)",
      "pdf.page": "Page {p} of {n}",
      "pdf.footer": "CONFIDENTIAL · for the teacher's use only",
      "pdf.legend": "* new student · (R) repeating the grade · ! broken keep-apart / keep-together link",

      "empty.title": "No groups to redistribute",
      "empty.noGrades": "This school year has no groups below 5th grade in School Setup.",
      "empty.noYears": "Set up the school year and its groups in School Setup first.",
      "empty.openSetup": "Open School Setup",

      "toast.saveFailed": "Could not save on this device (storage may be full).",
      "toast.undone": "Undone",
      "toast.redone": "Redone",
      "toast.repeatOnlyRoster": "Only students from this grade's current groups can be marked as repeating.",
    },
    es: {
      "app.title": "Redistribución de Grupos",
      "app.subtitle": "Arma los grupos del próximo año escolar a partir de las listas de este año",
      "nav.tools": "Herramientas",
      "privacy.short": "Privado · solo en este equipo",
      "privacy.tip":
        "Las calificaciones, vínculos y notas se guardan solo en este navegador de este computador. Nunca se sincronizan con Google Drive ni se copian a Configuración Escolar.",
      "privacy.profile": "Las calificaciones, vínculos y notas quedan solo en este computador. Finalizar copia nombres y grupos, nada más.",
      "saved.at": "Guardado {time}",

      "tb.year": "Año escolar",
      "tb.grade": "Grado actual",
      "tb.plan": "Plan",
      "tb.planActions": "Opciones del plan",
      "tb.groupCount": "Grupos nuevos",
      "tb.target": "Tamaño ideal",
      "tb.targetNone": "Libre",
      "tb.undo": "Deshacer (Ctrl+Z)",
      "tb.redo": "Rehacer (Ctrl+Y)",
      "tb.links": "Vínculos ({n})",
      "tb.autoBalance": "Balancear automáticamente",
      "tb.export": "Exportar",
      "tb.backup": "Copia de seguridad",
      "tb.finalize": "Finalizar",

      "vb.highlight": "Resaltar",
      "vb.all": "Todos",
      "vb.selectMode": "Seleccionar",
      "vb.fastRateHint": "Haz clic en la etiqueta de una tarjeta para pasar al siguiente nivel",

      "cat.behavior": "Comportamiento",
      "cat.academic": "Compromiso académico",
      "cat.gender": "Género",
      "cat.influence": "Influencia entre pares",
      "cat.family": "Relación de la familia con el colegio",
      "catShort.behavior": "Comportamiento",
      "catShort.academic": "Académico",
      "catShort.gender": "Género",
      "catShort.influence": "Influencia",
      "catShort.family": "Familia",

      "lv.behavior.lot": "Requiere mucho acompañamiento",
      "lv.behavior.some": "Requiere algo de acompañamiento",
      "lv.behavior.coop": "Generalmente colaborador(a)",
      "lv.behavior.high": "Muy colaborador(a)",
      "lv.academic.high": "Muy comprometido(a)",
      "lv.academic.steady": "Constante",
      "lv.academic.motivation": "Requiere motivación",
      "lv.gender.boy": "Niño",
      "lv.gender.girl": "Niña",
      "lv.influence.leader": "Líder positivo(a)",
      "lv.influence.follows": "Sigue al grupo",
      "lv.influence.offtask": "Distrae a sus compañeros",
      "lv.family.supportive": "Colaboradora",
      "lv.family.neutral": "Neutral",
      "lv.family.questions": "Cuestiona con frecuencia",
      "lvs.behavior.lot": "Mucho apoyo",
      "lvs.behavior.some": "Algo de apoyo",
      "lvs.behavior.coop": "Colaborador(a)",
      "lvs.behavior.high": "Muy colaborador(a)",
      "lvs.academic.high": "Comprometido(a)",
      "lvs.academic.steady": "Constante",
      "lvs.academic.motivation": "Req. motivación",
      "lvs.gender.boy": "Niño",
      "lvs.gender.girl": "Niña",
      "lvs.influence.leader": "Líder positivo(a)",
      "lvs.influence.follows": "Sigue al grupo",
      "lvs.influence.offtask": "Distrae",
      "lvs.family.supportive": "Colaboradora",
      "lvs.family.neutral": "Neutral",
      "lvs.family.questions": "Cuestiona",
      notRated: "Sin calificar",
      notRatedShort: "Sin calificar",

      "gender.unconfirmed": "sugerido, sin confirmar",
      "gender.suggested": "Sugerido por el nombre: {g}.",
      "gender.confirm": "Confirmar",
      "gender.notSet": "Género sin definir",

      "card.from": "viene de {g}",
      "badge.new": "Nuevo",
      "badge.repeater": "Repite",
      "badge.repeats": "Repite {grade}",

      "tip.chip": "{cat}: {level} · clic para el siguiente nivel",
      "tip.pin": "Fijar en este grupo (el balanceo automático no lo moverá)",
      "tip.unpin": "Fijado · clic para soltar",
      "tip.moveTo": "Mover a…",
      "tip.hasNote": "Tiene una nota privada",
      "tip.links": "Vínculos para separar o mantener juntos",
      "tip.brokenLinks.one": "{n} vínculo no se cumple",
      "tip.brokenLinks.other": "{n} vínculos no se cumplen",
      "tip.addRepeater": "Agregar un estudiante actual de {grade} que repetirá el grado",

      "warn.apart": "Separar: está en el mismo grupo que {names}",
      "warn.together": "Mantener juntos: está separado(a) de {names}",
      "warn.reason": "Motivo: {reason}",

      "left.current": "Grupos actuales · {year}",
      "left.toPlace": "{n} de {total} por ubicar",
      "left.allPlaced": "Todos están ubicados",
      "zone.unassigned": "Sin asignar",
      "zone.unassignedEmpty": "Suelta aquí estudiantes para dejarlos aparte",
      "zone.notReturning": "No continúa",
      "zone.notReturningHelp": "Se retira del colegio. No se incluye en los grupos nuevos.",
      "zone.repeating": "Repite {grade}",
      "zone.repeatingHelp": "Se queda en el mismo grado. Sale de esta redistribución.",
      "zone.dropHere": "Suelta aquí estudiantes",
      "loc.inGroup": "En {g}",
      "loc.notPlaced": "Sin ubicar",
      "loc.repeating": "Repite {grade}",

      "btn.addNew": "Agregar estudiante nuevo",
      "btn.addRepeater": "Agregar estudiante que repite",
      "btn.add": "Agregar",
      "btn.cancel": "Cancelar",
      "btn.close": "Cerrar",
      "btn.delete": "Eliminar",
      "btn.edit": "Editar",
      "btn.ok": "Aceptar",
      "btn.remove": "Quitar",
      "btn.save": "Guardar",

      "col.rename": "Nombre del grupo (clic para cambiarlo)",
      "col.empty": "Arrastra estudiantes aquí",

      "sum.students.one": "estudiante",
      "sum.students.other": "estudiantes",
      "sum.guessed.one": "{n} género solo es sugerido",
      "sum.guessed.other": "{n} géneros solo son sugeridos",
      "sum.new": "Nuevos: {n}",
      "sum.repeaters": "Repiten: {n}",
      "sum.broken": "Vínculos sin cumplir: {n}",
      "sum.newLabel": "Estudiantes nuevos",
      "sum.brokenLabel": "Vínculos sin cumplir",

      "flag.bigger": "{n} estudiantes más que los otros grupos",
      "flag.smaller": "{n} estudiantes menos que los otros grupos",
      "flag.overTarget": "{n} por encima del tamaño ideal",
      "flag.genderGap": "Desequilibrio de género: {boys} niños, {girls} niñas",
      "flag.needsSupport": "Muchos estudiantes que requieren mucho acompañamiento ({n})",
      "flag.offTask": "Muchos estudiantes que distraen a sus compañeros ({n})",
      "flag.fewLeaders": "Pocos líderes positivos ({n})",
      "flag.brokenLinks.one": "{n} vínculo sin cumplir",
      "flag.brokenLinks.other": "{n} vínculos sin cumplir",

      "sel.count.one": "{n} seleccionado",
      "sel.count.other": "{n} seleccionados",
      "sel.moveTo": "Mover a…",
      "sel.pin": "Fijar",
      "sel.unpin": "Soltar",
      "sel.clear": "Limpiar",
      "sel.done": "Listo",
      "sel.hint": "Toca las tarjetas para seleccionarlas",

      "move.toGroup": "Mover a {g}",
      "move.backTo": "Regresar a {g}",
      "move.backToPrevious": "Regresar a su grupo anterior",

      "profile.pin": "Fijar en el grupo",
      "profile.pinned": "Fijado",
      "profile.note": "Nota privada",
      "profile.notePh": "Solo tú puedes ver esta nota",
      "profile.status": "Estado",
      "profile.restore": "Volver a incluir en esta redistribución",
      "profile.removeExtra": "Quitar de la lista",
      "confirm.removeExtra": "¿Quitar a {name} de la lista de este grado? Se borrarán sus calificaciones, nota y vínculos.",

      "links.title": "Vínculos",
      "links.none": "Aún no hay vínculos.",
      "links.noneAll": "Aún no hay vínculos. Agrega uno para separar o mantener juntos a algunos estudiantes.",
      "links.apart": "Separar",
      "links.together": "Mantener juntos",
      "links.addApart": "Separar",
      "links.addTogether": "Mantener juntos",
      "links.broken": "No se cumple en este plan",
      "links.ok": "Se cumple",
      "links.reason": "Motivo (opcional)",
      "links.reasonPh": "p. ej. conflicto en el descanso",
      "links.modalApart": "Separar",
      "links.modalTogether": "Mantener juntos",
      "links.helpApart": "Elige dos o más estudiantes que no deben quedar en el mismo grupo.",
      "links.helpTogether": "Elige dos o más estudiantes que deben quedar en el mismo grupo.",
      "links.helpApartWith": "Elige los estudiantes que no deben quedar en el mismo grupo que {name}.",
      "links.helpTogetherWith": "Elige los estudiantes que deben quedar en el mismo grupo que {name}.",
      "links.needOne": "Elige al menos un estudiante.",
      "links.needTwo": "Elige al menos dos estudiantes.",
      "links.removeTitle": "Quitar vínculo",
      "links.removeMsg": "¿Quitar este vínculo?",
      "links.overviewTitle": "Vínculos entre estudiantes",

      "picker.search": "Buscar por nombre…",

      "add.newTitle": "Agregar estudiante nuevo",
      "add.newHelp": "Para matrículas tardías. Empieza en Sin asignar.",
      "add.name": "Nombre completo",
      "add.note": "Nota (opcional, privada)",
      "add.nameRequired": "Escribe el nombre del estudiante.",
      "add.duplicate": "{name} ya está en la lista.",
      "add.added": "{name} se agregó a Sin asignar.",
      "add.repTitle": "Agregar estudiantes que repiten",
      "add.repHelp": "Estudiantes actuales de {grade} que repetirán el grado en {next}. Entran a esta redistribución con la etiqueta \"Repite\".",
      "add.repNone": "No quedan estudiantes por agregar.",
      "add.repAdded.one": "Se agregó {n} estudiante que repite a Sin asignar.",
      "add.repAdded.other": "Se agregaron {n} estudiantes que repiten a Sin asignar.",

      "plan.defaultName": "Plan {letter}",
      "plan.new": "Nuevo plan",
      "plan.duplicate": "Duplicar plan",
      "plan.rename": "Cambiar nombre del plan",
      "plan.delete": "Eliminar plan",
      "plan.name": "Nombre del plan",
      "plan.copyOf": "{name} (copia)",
      "plan.deleteMsg": "¿Eliminar \"{name}\"? Las calificaciones, vínculos y notas se conservan; solo se borran los grupos de este plan.",

      "groups.removeTitle": "Quitar grupos",
      "groups.removeMsg.one": "{groups}: {n} estudiante regresará a su grupo anterior.",
      "groups.removeMsg.other": "{groups}: {n} estudiantes regresarán a sus grupos anteriores.",
      "groups.badName": "El nombre del grupo debe empezar por {n}, p. ej. {n}A.",
      "groups.dupName": "Ya hay un grupo llamado {name}.",

      "bal.title": "Balancear automáticamente",
      "bal.modeLabel": "Estudiantes por ubicar",
      "bal.modeUnassigned": "Solo los que aún no están ubicados",
      "bal.modeAll": "Todos los que no están fijados",
      "bal.mix": "Mezclar estudiantes de distintos grupos anteriores",
      "bal.working": "Buscando una distribución equilibrada…",
      "bal.nothing": "No hay estudiantes por ubicar.",
      "bal.noneUnassigned": "Todos ya están ubicados. Elige \"Todos los que no están fijados\" para redistribuir.",
      "bal.nonePinned": "Todos los estudiantes están fijados. Suelta algunos para que el balanceo pueda moverlos.",
      "bal.sizes": "Tamaño de los grupos: de {min} a {max}",
      "bal.gender": "Niños por grupo: de {bmin} a {bmax} · Niñas: de {gmin} a {gmax}",
      "bal.levels": "Niveles bien repartidos: {even} de {total}",
      "bal.links": "Vínculos cumplidos: {ok} de {total}",
      "bal.noLinks": "No hay vínculos por cumplir",
      "bal.unhonored": "Vínculos que no pudo cumplir",
      "bal.discard": "Descartar",
      "bal.tryAgain": "Intentar de nuevo",
      "bal.apply": "Aplicar",
      "bal.applied": "Sugerencia aplicada. Deshacer (Ctrl+Z) la revierte.",

      "fin.title": "Finalizar grupos",
      "fin.intro": "Esto crea los grupos de {next} · {grade} a partir de \"{plan}\" en Configuración Escolar:",
      "fin.createYear": "El año escolar {next} aún no existe y se creará. El año activo no cambia.",
      "fin.clashes": "Estos grupos ya tienen estudiantes en {next} y serán reemplazados: {groups}.",
      "fin.others": "Otros grupos de este grado que ya existen en {next} quedan igual: {groups}.",
      "fin.unplaced.one": "{n} estudiante no está ubicado en un grupo y no se agregará.",
      "fin.unplaced.other": "{n} estudiantes no están ubicados en un grupo y no se agregarán.",
      "fin.private": "Solo se copian los nombres y los grupos. Las calificaciones, vínculos y notas quedan privados en este computador.",
      "fin.finalize": "Finalizar",
      "fin.replaceAndFinalize": "Reemplazar y finalizar",
      "fin.done": "Se crearon {n} grupos en Configuración Escolar para {next}.",
      "fin.skipped.one": "Se omitió {n} nombre repetido.",
      "fin.skipped.other": "Se omitieron {n} nombres repetidos.",
      "fin.error": "No se pudo finalizar: {msg}",

      "backup.download": "Descargar copia de seguridad (.json)",
      "backup.load": "Cargar copia de seguridad…",
      "backup.downloaded": "Copia descargada. Contiene calificaciones y notas privadas: guárdala en un lugar seguro.",
      "backup.invalid": "Este archivo no es una copia de Redistribución de Grupos.",
      "backup.loadTitle": "Cargar copia de seguridad",
      "backup.loadMsg": "¿Reemplazar todos los planes, calificaciones, vínculos y notas de {scope} con la copia del {date}?",
      "backup.replace": "Reemplazar",
      "backup.loaded": "Copia cargada.",
      "backup.loadedHidden": "La copia se guardó para {scope}, pero ese grado no está ahora en Configuración Escolar.",

      "export.excel": "Excel (.xlsx)",
      "export.pdf": "PDF (una página por grupo)",
      "export.preparing": "Preparando el archivo…",
      "export.libFailed": "No se pudo cargar la librería de exportación. Revisa la conexión a internet.",
      "export.done": "Archivo descargado.",
      "export.confidential": "Confidencial",
      "file.base": "redistribucion-grupos",

      "xl.name": "Nombre",
      "xl.from": "Grupo anterior",
      "xl.newGroup": "Grupo nuevo",
      "xl.status": "Estado",
      "xl.warnings": "Alertas de vínculos",
      "xl.groupTitle": "Grupo {g}",
      "xl.summary": "Resumen",
      "xl.summarySheet": "Resumen",
      "xl.summaryTitle": "Resumen del equilibrio de los grupos",
      "xl.allSheet": "Todos los estudiantes",
      "xl.allTitle": "Todos los estudiantes",
      "xl.group": "Grupo",
      "xl.students": "Estudiantes",
      "xl.flags": "Desequilibrios",
      "xl.linksTotal": "Vínculos",
      "xl.repeaterFrom": "Repite (viene de {g})",

      "pdf.from": "Viene de",
      "pdf.cont": "(cont.)",
      "pdf.page": "Página {p} de {n}",
      "pdf.footer": "CONFIDENCIAL · solo para uso del docente",
      "pdf.legend": "* estudiante nuevo · (R) repite el grado · ! vínculo de separar / mantener juntos sin cumplir",

      "empty.title": "No hay grupos para redistribuir",
      "empty.noGrades": "Este año escolar no tiene grupos por debajo de quinto en Configuración Escolar.",
      "empty.noYears": "Primero configura el año escolar y sus grupos en Configuración Escolar.",
      "empty.openSetup": "Abrir Configuración Escolar",

      "toast.saveFailed": "No se pudo guardar en este equipo (puede que el almacenamiento esté lleno).",
      "toast.undone": "Deshecho",
      "toast.redone": "Rehecho",
      "toast.repeatOnlyRoster": "Solo los estudiantes de los grupos actuales de este grado pueden marcarse como que repiten.",
    },
  };

  // ═══════════════════════════ STATE ═══════════════════════════
  let store = loadJSON(STORE_KEY, null);
  if (!store || typeof store !== "object" || !store.grades) store = { version: 1, grades: {} };
  const ui = Object.assign({ view: "behavior", filter: "", collapsed: {} }, loadJSON(UI_KEY, {}) || {});
  if (!CAT[ui.view]) ui.view = "behavior";
  let lang = readLang();

  let sel = { year: null, level: null, key: null };
  let G = null; // state of the selected grade
  let undoStack = [];
  let redoStack = [];
  const selected = new Set();
  let selectMode = false;
  let ctx = null; // last computed context
  let openProfileKey = null;
  let saveTimer = null;
  let lastSavedAt = null;

  // ═══════════════════════════ HELPERS ═══════════════════════════
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeLS(key, value) {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function readLang() {
    try {
      return localStorage.getItem(LANG_KEY) === "es" ? "es" : "en";
    } catch (e) {
      return "en";
    }
  }

  function t(key, params) {
    let s = I18N[lang] && I18N[lang][key];
    if (s == null) s = I18N.en[key];
    if (s == null) {
      console.warn("[ClassRedistribution] missing text", key);
      s = key;
    }
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
    return s;
  }

  // t() with ".one" / ".other" forms
  function tn(key, n, params) {
    return t(key + (n === 1 ? ".one" : ".other"), Object.assign({ n }, params || {}));
  }

  function norm(s) {
    return SchoolRoster.normalizeName(s);
  }

  function cleanName(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleUpperCase("es");
  }

  function byName(a, b) {
    return SchoolRoster.compareNames(a.name, b.name);
  }

  function cmpGroupId(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  function levelDef(cat, v) {
    return v ? CAT[cat].levels.find((l) => l.v === v) || null : null;
  }

  function lvLabel(cat, v, short) {
    return v ? t((short ? "lvs." : "lv.") + cat + "." + v) : t("notRated");
  }

  function catLabel(cat) {
    return t("cat." + cat);
  }

  const ES_GRADES = ["Transición", "Primero", "Segundo", "Tercero", "Cuarto", "Quinto"];
  function gradeName(level) {
    const n = Number(level);
    if (lang === "es") return ES_GRADES[n] || "Grado " + n;
    if (n === 0) return "Transition";
    const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
    return n + s + " grade";
  }

  function nextYearOf(y) {
    return String(Number(y) + 1);
  }

  function scopeText(arrow) {
    return (
      sel.year + " · " + gradeName(sel.level) + " " + (arrow || "→") + " " + nextYearOf(sel.year) + " · " +
      gradeName(sel.level + 1)
    );
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(lang === "es" ? "es-CO" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString(lang === "es" ? "es-CO" : "en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function cssEsc(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function loadScript(url, ready) {
    if (ready()) return Promise.resolve(ready());
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => (ready() ? resolve(ready()) : reject(new Error("Library not available")));
      s.onerror = () => {
        s.remove();
        reject(new Error("Could not load " + url));
      };
      document.head.appendChild(s);
    });
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function fileSlug(s) {
    return String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function fileBase() {
    return fileSlug(t("file.base")) + "-" + sel.year + "-" + fileSlug(gradeName(sel.level)) + "-" + fileSlug(plan().name);
  }

  // ═══════════════════════════ GENDER GUESS ═══════════════════════════
  // Only a suggestion: shown as unconfirmed ("?") until the teacher confirms it.
  const GIRL_NAMES = new Set(
    (
      "ABRIL ADRIANA AITANA ALEJANDRA ALETH ALICIA ALLISON AMELIA AMERICA ANA ANALUCIA ANAMARIA ANDREA ANGELA ANGELICA " +
      "ANNIE ANNY ANTONELLA ANTONIA ARIADNA ARIANA AURORA AVRIL BEATRIZ BIANCA BRIANA CAMILA CAROLINA CATALINA CELESTE " +
      "CLARA DAILY DALIANA DANIELA DANNA DULCE ELENA ELIZABETH EMILIA EMILIANA EMILY EMMA ESTEFANIA ESTRELLITA EVA FERNANDA " +
      "FLORENCIA GABRIELA GABRIELLA GINA GUADALUPE HELENA INES IRENE ISABEL ISABELA ISABELLA IVANNA JIMENA JOSEFINA JUANA " +
      "JULIA JULIANA JULIETA KAREN KATHERINE KESHIA LAURA LORENA LUCIA LUCIANA LUISA LUNA MAGDALENA MANUELA MARCELA " +
      "MARGARITA MARIA MARIANA MARIANNE MARTHA MARTINA MATILDA MAYTE MELISSA MIA MICHELLE MILAGROS NATALIA NHARA NICOL " +
      "NICOLE NICOLL OLIVIA ORALIS PALOMA PAOLA PATRICIA PAULA PAULINA RENATA REBECA ROCIO ROSA SALOME SAMANTHA SAMARA " +
      "SARA SARAH SELENE SILVANA SIMONA SOFIA SOPHIA TATIANA THALIANA THALYA VALENTINA VALERIA VALERY VANESSA VERONICA " +
      "VICTORIA VIOLETA VIOLETTA XIMENA YULIANY ZAHIRA ZOE"
    ).split(" "),
  );
  const BOY_NAMES = new Set(
    (
      "AARON ADRIAN AGUSTIN ALAN ALEJANDRO ALEXANDER ALFREDO ALVARO ANDRES ANGEL ARTURO BENJAMIN BRUNO CARLOS " +
      "CRISTOBAL DANIEL DANTE DAVID DIEGO DYLAN EDINSON EDUARD EDUARDO EIDER EMANUEL EMILIANO EMILIO EMMANUEL ERMES " +
      "ESTEBAN ESTIVEN FEDERICK FELIPE FERNANDO FRANCISCO GABRIEL GUSTAVO HECTOR HUGO IANN IGNACIO IKER ISAAC IVAN JACOBO " +
      "JAIRO JEREMY JERONIMO JESUS JHON JOAQUIN JORGE JOSE JUAN JULIAN KEVIN KILIAN LENIN LEONARDO LIAM LORENZO LUCAS " +
      "LUCIANO LUIS MANUEL MARCOS MARIO MARTIN MATEO MATHIAS MATIAS MAURICIO MAXIMILIANO MAXIMO MIGUEL MILAN NICOLAS " +
      "NOAH OSCAR PABLO PEDRO RAFAEL RICARDO ROBERTO RONNY SALOMON SAMUEL SANTIAGO SEBASTIAN SERGIO SIMON STEVEN " +
      "THIAGO THOMAS TOMAS VICTOR WILLIAM"
    ).split(" "),
  );
  (function addHintsFromStudentsData() {
    try {
      // eslint-disable-next-line no-undef
      const data = typeof STUDENTS_DATA !== "undefined" ? STUDENTS_DATA : [];
      data.forEach((s) => {
        const first = norm(s.name).split(" ")[0];
        if (!first) return;
        if (s.gender === "girl" && !BOY_NAMES.has(first)) GIRL_NAMES.add(first);
        if (s.gender === "boy" && !GIRL_NAMES.has(first)) BOY_NAMES.add(first);
      });
    } catch (e) {}
  })();

  const guessCache = new Map();
  function guessGender(name) {
    if (guessCache.has(name)) return guessCache.get(name);
    const parts = norm(name).split(" ").filter(Boolean);
    // Roster names are "SURNAME SURNAME FIRST [SECOND]": try the given names first
    const order = parts.length >= 3 ? parts.slice(2).concat(parts.slice(0, 2)) : parts.slice().reverse();
    let g = null;
    for (const p of order) {
      if (GIRL_NAMES.has(p)) {
        g = "girl";
        break;
      }
      if (BOY_NAMES.has(p)) {
        g = "boy";
        break;
      }
    }
    guessCache.set(name, g);
    return g;
  }

  // ═══════════════════════════ STORAGE ═══════════════════════════
  function saveStore(immediate) {
    clearTimeout(saveTimer);
    const run = () => {
      saveTimer = null;
      if (writeLS(STORE_KEY, store)) {
        lastSavedAt = Date.now();
        renderSaved();
      } else {
        toast(t("toast.saveFailed"), "error");
      }
    };
    if (immediate) run();
    else saveTimer = setTimeout(run, 300);
  }

  function flushSave() {
    if (saveTimer) saveStore(true);
  }

  function saveUi() {
    writeLS(UI_KEY, ui);
  }

  function renderSaved() {
    const el = $("cr-saved");
    if (!el) return;
    el.innerHTML = lastSavedAt
      ? '<i class="fa-solid fa-check"></i> ' + esc(t("saved.at", { time: fmtTime(lastSavedAt) }))
      : "";
  }

  // ═══════════════════════════ GRADE STATE ═══════════════════════════
  function groupLetter(i) {
    return String.fromCharCode(65 + i);
  }

  function makeGroups(count, existing) {
    const next = sel.level + 1;
    const groups = (existing || []).slice(0, count);
    const used = new Set(groups.map((g) => g.name));
    let i = 0;
    while (groups.length < count) {
      const name = next + groupLetter(i++);
      if (used.has(name)) continue;
      used.add(name);
      groups.push({ id: uid("g"), name });
    }
    return groups;
  }

  function currentGroupIds() {
    return SchoolRoster.groups(sel.year)
      .filter((g) => g.level === sel.level)
      .map((g) => g.id)
      .sort(cmpGroupId);
  }

  function newPlan(name, count, target) {
    return {
      id: uid("plan"),
      name,
      target: target || null,
      mix: true,
      groups: makeGroups(count),
      assign: {},
      pinned: {},
      finalizedAt: null,
    };
  }

  function newGrade() {
    const count = Math.max(1, Math.min(MAX_GROUPS, currentGroupIds().length || 3));
    const p = newPlan(t("plan.defaultName", { letter: "A" }), count);
    return { profiles: {}, extras: {}, links: [], plans: [p], activePlanId: p.id };
  }

  function plan() {
    return G.plans.find((p) => p.id === G.activePlanId) || G.plans[0];
  }

  function prof(key) {
    return G.profiles[key] || (G.profiles[key] = {});
  }

  function availableLevels(year) {
    const levels = new Set();
    SchoolRoster.groups(year).forEach((g) => {
      if (g.level != null && g.level < MAX_NEW_LEVEL) levels.add(g.level);
    });
    return [...levels].sort((a, b) => a - b);
  }

  function selectGrade(year, level) {
    flushSave();
    sel = { year, level, key: year + ":" + level };
    if (!store.grades[sel.key]) store.grades[sel.key] = newGrade();
    G = store.grades[sel.key];
    if (!G.plans || !G.plans.length) {
      const fresh = newGrade();
      G.plans = fresh.plans;
      G.activePlanId = fresh.activePlanId;
    }
    G.profiles = G.profiles || {};
    G.extras = G.extras || {};
    G.links = G.links || [];
    undoStack = [];
    redoStack = [];
    selected.clear();
    closeProfile();
    ui.year = year;
    ui.level = level;
    saveUi();
    render();
  }

  // Every edit goes through change(): history + autosave + render
  function change(mutator, opts) {
    const o = opts || {};
    const before = JSON.stringify(G);
    const result = mutator();
    if (result === false) return false;
    const after = JSON.stringify(G);
    if (after !== before) {
      if (o.history !== false) {
        undoStack.push(before);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack = [];
      }
      saveStore();
    }
    render();
    return true;
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(G));
    G = JSON.parse(undoStack.pop());
    store.grades[sel.key] = G;
    saveStore();
    render();
    toast(t("toast.undone"));
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(G));
    G = JSON.parse(redoStack.pop());
    store.grades[sel.key] = G;
    saveStore();
    render();
    toast(t("toast.redone"));
  }

  // ═══════════════════════════ STUDENTS & CONTEXT ═══════════════════════════
  function buildStudents() {
    const list = [];
    const seen = new Set();
    SchoolRoster.groups(sel.year)
      .filter((g) => g.level === sel.level)
      .forEach((g) => {
        SchoolRoster.students(g.id, { year: sel.year }).forEach((st) => {
          if (seen.has(st.id)) return;
          seen.add(st.id);
          list.push(mkStudent(st.id, st.name, g.id, "roster"));
        });
      });
    Object.values(G.extras || {}).forEach((x) => {
      if (seen.has(x.id)) return;
      seen.add(x.id);
      list.push(mkStudent(x.id, x.name, x.from || null, x.source || "new"));
    });
    return list;
  }

  function mkStudent(key, name, from, source) {
    const p = G.profiles[key] || {};
    let status = p.status || "active";
    if (status === "repeating" && source !== "roster") status = "active";
    return { key, name, from, source, status };
  }

  function genderInfo(st) {
    const p = G.profiles[st.key] || {};
    if (p.gender === "boy" || p.gender === "girl") return { value: p.gender, guessed: false };
    if (p.gender === null || st.source === "new") return { value: null, guessed: false };
    const g = guessGender(st.name);
    return { value: g, guessed: !!g };
  }

  function ratingOf(st, cat) {
    if (cat === "gender") return genderInfo(st).value;
    const p = G.profiles[st.key];
    const v = p && p[cat];
    return levelDef(cat, v) ? v : null;
  }

  function computeContext() {
    const pl = plan();
    const students = buildStudents().sort(byName);
    const byKey = new Map(students.map((s) => [s.key, s]));
    const groupIds = new Set(pl.groups.map((g) => g.id));
    const members = {};
    pl.groups.forEach((g) => (members[g.id] = []));
    const originIds = currentGroupIds();
    const origin = {};
    const originTotals = {};
    originIds.forEach((id) => {
      origin[id] = [];
      originTotals[id] = 0;
    });
    const unassigned = [];
    const notReturning = [];
    const repeating = [];

    students.forEach((st) => {
      if (st.source === "roster" && originTotals[st.from] != null) originTotals[st.from]++;
      st.pinned = false;
      if (st.status === "notReturning") {
        st.loc = "notReturning";
        notReturning.push(st);
        return;
      }
      if (st.status === "repeating") {
        st.loc = "repeating";
        repeating.push(st);
        return;
      }
      const a = pl.assign[st.key];
      if (a && groupIds.has(a)) {
        st.loc = a;
        st.pinned = !!pl.pinned[st.key];
        members[a].push(st);
      } else if (a === "u" || st.source !== "roster" || !origin[st.from]) {
        st.loc = "u";
        unassigned.push(st);
      } else {
        st.loc = "origin";
        origin[st.from].push(st);
      }
    });

    const placeOf = (k) => {
      const s = byKey.get(k);
      return s && groupIds.has(s.loc) ? s.loc : null;
    };
    const links = evaluateLinks(placeOf, byKey);

    const stats = {};
    pl.groups.forEach((g) => (stats[g.id] = groupStats(members[g.id])));
    const flags = {};
    pl.groups.forEach((g) => (flags[g.id] = groupFlags(g.id, stats, pl, links)));

    return {
      students,
      byKey,
      groupIds,
      members,
      originIds,
      origin,
      originTotals,
      unassigned,
      notReturning,
      repeating,
      links,
      stats,
      flags,
      placeOf,
    };
  }

  function activeLinkMembers(link, byKey) {
    return link.members.filter((k) => byKey.has(k) && byKey.get(k).status === "active");
  }

  // Which links are broken for a given placement
  function evaluateLinks(placeOf, byKey) {
    const res = { total: 0, honored: 0, broken: [], brokenIds: new Set(), perStudent: new Map(), perGroup: {} };
    const warn = (k, link, others) => {
      if (!res.perStudent.has(k)) res.perStudent.set(k, []);
      res.perStudent.get(k).push({ link, others });
    };
    (G.links || []).forEach((link) => {
      const ms = activeLinkMembers(link, byKey);
      if (ms.length < 2) return;
      res.total++;
      const placed = ms.filter((k) => placeOf(k));
      const hit = new Set();
      if (link.type === "apart") {
        const by = {};
        placed.forEach((k) => (by[placeOf(k)] = by[placeOf(k)] || []).push(k));
        Object.keys(by).forEach((gid) => {
          const ks = by[gid];
          if (ks.length < 2) return;
          hit.add(gid);
          ks.forEach((k) => warn(k, link, ks.filter((o) => o !== k)));
        });
      } else {
        const gs = new Set(placed.map(placeOf));
        if (gs.size > 1) {
          gs.forEach((g) => hit.add(g));
          placed.forEach((k) =>
            warn(
              k,
              link,
              placed.filter((o) => placeOf(o) !== placeOf(k)),
            ),
          );
        }
      }
      if (hit.size) {
        res.broken.push({ link, groups: [...hit] });
        res.brokenIds.add(link.id);
        hit.forEach((g) => (res.perGroup[g] = (res.perGroup[g] || 0) + 1));
      } else res.honored++;
    });
    return res;
  }

  function groupStats(list) {
    const s = { total: list.length, cats: {}, guessed: 0, newCount: 0, repeaterCount: 0 };
    CATEGORIES.forEach((c) => {
      s.cats[c.id] = { none: 0 };
      c.levels.forEach((l) => (s.cats[c.id][l.v] = 0));
    });
    list.forEach((st) => {
      CATEGORIES.forEach((c) => {
        const v = ratingOf(st, c.id);
        s.cats[c.id][v || "none"]++;
      });
      if (genderInfo(st).guessed) s.guessed++;
      if (st.source === "new") s.newCount++;
      if (st.source === "repeater") s.repeaterCount++;
    });
    return s;
  }

  function groupFlags(gid, stats, pl, links) {
    const s = stats[gid];
    const others = Object.keys(stats).filter((k) => k !== gid);
    const avg = (fn) => (others.length ? others.reduce((sum, k) => sum + fn(stats[k]), 0) / others.length : null);
    const flags = [];
    if (others.length) {
      const d = s.total - avg((x) => x.total);
      if (d >= FLAG_LIMITS.sizeDiff) flags.push({ key: "flag.bigger", n: Math.round(d), mark: "size" });
      if (-d >= FLAG_LIMITS.sizeDiff) flags.push({ key: "flag.smaller", n: Math.round(-d), mark: "size" });
      const lot = s.cats.behavior.lot - avg((x) => x.cats.behavior.lot);
      if (lot >= FLAG_LIMITS.needsSupportExcess)
        flags.push({ key: "flag.needsSupport", n: s.cats.behavior.lot, mark: "behavior:lot" });
      const off = s.cats.influence.offtask - avg((x) => x.cats.influence.offtask);
      if (off >= FLAG_LIMITS.offTaskExcess)
        flags.push({ key: "flag.offTask", n: s.cats.influence.offtask, mark: "influence:offtask" });
      const lead = avg((x) => x.cats.influence.leader) - s.cats.influence.leader;
      if (lead >= FLAG_LIMITS.leadersShortfall)
        flags.push({ key: "flag.fewLeaders", n: s.cats.influence.leader, mark: "influence:leader" });
    }
    if (pl.target && s.total > pl.target) flags.push({ key: "flag.overTarget", n: s.total - pl.target, mark: "size" });
    const b = s.cats.gender.boy;
    const g = s.cats.gender.girl;
    if (Math.abs(b - g) >= FLAG_LIMITS.genderGap) flags.push({ key: "flag.genderGap", boys: b, girls: g, mark: "gender" });
    const broken = links.perGroup[gid] || 0;
    if (broken) flags.push({ key: "flag.brokenLinks", n: broken, mark: "links" });
    return flags;
  }

  function flagText(f) {
    if (f.key === "flag.genderGap") return t(f.key, { boys: f.boys, girls: f.girls });
    if (f.key === "flag.brokenLinks") return tn("flag.brokenLinks", f.n);
    return t(f.key, { n: f.n });
  }

  function groupName(gid) {
    const g = plan().groups.find((x) => x.id === gid);
    return g ? g.name : "";
  }

  function locLabel(st) {
    if (ctx.groupIds.has(st.loc)) return t("loc.inGroup", { g: groupName(st.loc) });
    if (st.loc === "notReturning") return t("zone.notReturning");
    if (st.loc === "repeating") return t("loc.repeating", { grade: gradeName(sel.level) });
    if (st.loc === "u") return t("zone.unassigned");
    return t("loc.notPlaced");
  }

  function namesOf(keys) {
    return keys.map((k) => (ctx.byKey.get(k) || { name: "?" }).name);
  }

  function warnText(w) {
    const names = namesOf(w.others).join(", ");
    const reason = w.link.reason ? "\n" + t("warn.reason", { reason: w.link.reason }) : "";
    return t(w.link.type === "apart" ? "warn.apart" : "warn.together", { names }) + reason;
  }

  function matchesFilter(st) {
    if (!ui.filter) return true;
    const v = ratingOf(st, ui.view);
    return ui.filter === "none" ? !v : v === ui.filter;
  }

  // ═══════════════════════════ RENDER ═══════════════════════════
  function applyStaticI18n() {
    document.documentElement.lang = lang;
    document.title = t("app.title") + " - ESL Learning Platform";
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-tip]").forEach((el) => {
      el.dataset.tip = t(el.dataset.i18nTip);
      el.setAttribute("aria-label", t(el.dataset.i18nTip));
    });
    document
      .querySelectorAll("[data-i18n-placeholder]")
      .forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
    document.querySelectorAll(".cr-lang-btn").forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderSaved();
  }

  function render() {
    if (!sel.key) {
      renderEmpty();
      return;
    }
    $("cr-empty").hidden = true;
    $("cr-toolbar").classList.remove("is-disabled");
    $("cr-board").hidden = false;
    $("cr-viewbar").hidden = false;
    ctx = computeContext();
    // drop selections of students that are gone
    [...selected].forEach((k) => {
      if (!ctx.byKey.has(k)) selected.delete(k);
    });
    renderToolbar();
    renderViewbar();
    renderLeft();
    renderGroups();
    renderSelBar();
    if (openProfileKey) renderProfile();
    if (linksModal) refreshLinksModal();
  }

  function renderEmpty() {
    const years = SchoolRoster.years();
    $("cr-board").hidden = true;
    $("cr-viewbar").hidden = true;
    $("cr-toolbar").classList.add("is-disabled");
    fillYearLevel();
    const el = $("cr-empty");
    el.hidden = false;
    el.innerHTML =
      '<i class="fa-solid fa-school-circle-xmark"></i><h2>' +
      esc(t("empty.title")) +
      "</h2><p>" +
      esc(years.length ? t("empty.noGrades") : t("empty.noYears")) +
      '</p><a class="cr-btn cr-btn-primary" href="school-setup.html"><i class="fa-solid fa-school"></i> ' +
      esc(t("empty.openSetup")) +
      "</a>";
  }

  function fillYearLevel() {
    const ySel = $("cr-year");
    const years = SchoolRoster.years();
    ySel.innerHTML = years.map((y) => '<option value="' + esc(y) + '">' + esc(y) + "</option>").join("");
    if (sel.year) ySel.value = sel.year;
    const lSel = $("cr-level");
    const levels = sel.year ? availableLevels(sel.year) : [];
    lSel.innerHTML = levels
      .map((l) => '<option value="' + l + '">' + esc(gradeName(l) + " → " + gradeName(l + 1)) + "</option>")
      .join("");
    if (sel.level != null) lSel.value = String(sel.level);
  }

  function renderToolbar() {
    fillYearLevel();
    $("cr-scope").innerHTML =
      '<i class="fa-solid fa-arrow-trend-up"></i> <span>' + esc(scopeText()) + "</span>";
    const pl = plan();
    $("cr-plan").innerHTML = G.plans
      .map(
        (p) =>
          '<option value="' +
          esc(p.id) +
          '">' +
          esc(p.name + (p.finalizedAt ? " ✓" : "")) +
          "</option>",
      )
      .join("");
    $("cr-plan").value = pl.id;
    const countEl = $("cr-group-count");
    if (document.activeElement !== countEl) countEl.value = pl.groups.length;
    const targetEl = $("cr-target");
    if (document.activeElement !== targetEl) targetEl.value = pl.target || "";
    $("cr-undo").disabled = !undoStack.length;
    $("cr-redo").disabled = !redoStack.length;
    const broken = ctx.links.broken.length;
    $("cr-links-label").textContent = t("tb.links", { n: (G.links || []).length });
    $("cr-links-btn").classList.toggle("has-warning", broken > 0);
    $("cr-links-btn").dataset.tip = broken ? tn("tip.brokenLinks", broken) : t("tip.links");
  }

  function renderViewbar() {
    $("cr-views").innerHTML = CATEGORIES.map(
      (c) =>
        '<button type="button" role="tab" class="cr-view-tab' +
        (ui.view === c.id ? " is-active" : "") +
        '" data-view="' +
        c.id +
        '" aria-selected="' +
        (ui.view === c.id) +
        '"><i class="fa-solid ' +
        c.icon +
        '"></i> ' +
        esc(catLabel(c.id)) +
        "</button>",
    ).join("");
    const f = $("cr-filter");
    f.innerHTML =
      '<option value="">' +
      esc(t("vb.all")) +
      "</option>" +
      CAT[ui.view].levels.map((l) => '<option value="' + l.v + '">' + esc(lvLabel(ui.view, l.v)) + "</option>").join("") +
      '<option value="none">' +
      esc(t("notRated")) +
      "</option>";
    f.value = ui.filter || "";
    $("cr-select-mode").classList.toggle("is-active", selectMode);
    $("cr-select-mode").setAttribute("aria-pressed", selectMode ? "true" : "false");
    $("cr-legend").innerHTML =
      '<span class="cr-legend-hint"><i class="fa-solid fa-hand-pointer"></i> ' +
      esc(t("vb.fastRateHint")) +
      "</span>" +
      CAT[ui.view].levels
        .map(
          (l) =>
            '<span class="cr-legend-item" style="--lv:' +
            l.color +
            '"><i class="fa-solid ' +
            l.icon +
            '"></i> ' +
            esc(lvLabel(ui.view, l.v)) +
            "</span>",
        )
        .join("") +
      '<span class="cr-legend-item is-none"><i class="fa-regular fa-circle"></i> ' +
      esc(t("notRated")) +
      "</span>";
  }

  function dotsHtml(st) {
    const lines = [];
    const dots = CATEGORIES.map((c) => {
      const v = ratingOf(st, c.id);
      const d = levelDef(c.id, v);
      const guessed = c.id === "gender" && genderInfo(st).guessed;
      lines.push(catLabel(c.id) + ": " + lvLabel(c.id, v) + (guessed ? " (" + t("gender.unconfirmed") + ")" : ""));
      return (
        '<span class="cr-dot' +
        (d ? "" : " is-none") +
        (guessed ? " is-guess" : "") +
        '"' +
        (d ? ' style="--dot:' + d.color + '"' : "") +
        "></span>"
      );
    }).join("");
    return '<span class="cr-dots" data-tip="' + esc(lines.join("\n")) + '">' + dots + "</span>";
  }

  function cardHtml(st) {
    const view = ui.view;
    const v = ratingOf(st, view);
    const lv = levelDef(view, v);
    const gi = genderInfo(st);
    const guessed = view === "gender" && gi.guessed;
    const placed = ctx.groupIds.has(st.loc);
    const warns = placed ? ctx.links.perStudent.get(st.key) || [] : [];
    const p = G.profiles[st.key] || {};
    const cls = ["cr-card"];
    if (!lv) cls.push("is-unrated");
    if (selected.has(st.key)) cls.push("is-selected");
    if (ui.filter && !matchesFilter(st)) cls.push("is-dim");
    if (ui.filter && matchesFilter(st)) cls.push("is-match");
    if (st.pinned) cls.push("is-pinned");
    if (warns.length) cls.push("has-warning");

    let meta = "";
    if (st.from) meta += '<span class="cr-from">' + esc(t("card.from", { g: st.from })) + "</span>";
    if (st.source === "new") meta += '<span class="cr-badge cr-badge-new">' + esc(t("badge.new")) + "</span>";
    if (st.source === "repeater") meta += '<span class="cr-badge cr-badge-rep">' + esc(t("badge.repeater")) + "</span>";
    if (st.status === "repeating")
      meta += '<span class="cr-badge cr-badge-stay">' + esc(t("badge.repeats", { grade: gradeName(sel.level) })) + "</span>";
    if (p.note) meta += '<i class="fa-regular fa-note-sticky cr-note-ico" data-tip="' + esc(t("tip.hasNote")) + '"></i>';
    warns.forEach((w) => {
      meta +=
        '<button type="button" class="cr-warn" data-act="warn" data-tip="' +
        esc(warnText(w)) +
        '" aria-label="' +
        esc(warnText(w)) +
        '"><i class="fa-solid ' +
        (w.link.type === "apart" ? "fa-people-arrows" : "fa-link-slash") +
        '"></i></button>';
    });

    const chipLabel = lv ? lvLabel(view, v, true) + (guessed ? " ?" : "") : t("notRatedShort");
    const chipTip = t("tip.chip", { cat: catLabel(view), level: lvLabel(view, v) + (guessed ? " (" + t("gender.unconfirmed") + ")" : "") });

    return (
      '<div class="' +
      cls.join(" ") +
      '" data-key="' +
      esc(st.key) +
      '" style="--lv:' +
      (lv ? lv.color : "var(--cr-none)") +
      '">' +
      '<div class="cr-card-top"><span class="cr-card-name">' +
      esc(st.name) +
      "</span>" +
      (placed
        ? '<button type="button" class="cr-pin' +
          (st.pinned ? " is-on" : "") +
          '" data-act="pin" data-tip="' +
          esc(st.pinned ? t("tip.unpin") : t("tip.pin")) +
          '" aria-pressed="' +
          (st.pinned ? "true" : "false") +
          '"><i class="fa-solid fa-thumbtack"></i></button>'
        : "") +
      '<button type="button" class="cr-more" data-act="menu" data-tip="' +
      esc(t("tip.moveTo")) +
      '" aria-label="' +
      esc(t("tip.moveTo")) +
      '"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>' +
      (meta ? '<div class="cr-card-meta">' + meta + "</div>" : "") +
      '<div class="cr-card-bottom"><button type="button" class="cr-chip' +
      (lv ? "" : " is-none") +
      (guessed ? " is-guess" : "") +
      '" data-act="chip" data-tip="' +
      esc(chipTip) +
      '"><i class="fa-solid ' +
      (lv ? lv.icon : "fa-circle-question") +
      '"></i><span>' +
      esc(chipLabel) +
      "</span></button>" +
      dotsHtml(st) +
      "</div></div>"
    );
  }

  function cardsHtml(list, emptyText) {
    if (!list.length) return '<p class="cr-zone-empty">' + esc(emptyText) + "</p>";
    return list.map(cardHtml).join("");
  }

  function zoneHtml(o) {
    const collapsed = !!ui.collapsed[sel.key + ":" + o.cid];
    return (
      '<section class="cr-zone cr-zone-' +
      o.kind +
      (collapsed ? " is-collapsed" : "") +
      '" data-drop="' +
      o.drop +
      '">' +
      '<button type="button" class="cr-zone-head" data-act="collapse" data-cid="' +
      esc(o.cid) +
      '" aria-expanded="' +
      (!collapsed) +
      '"><i class="fa-solid fa-chevron-down cr-zone-caret"></i>' +
      (o.icon ? '<i class="fa-solid ' + o.icon + ' cr-zone-ico"></i>' : "") +
      '<span class="cr-zone-title">' +
      esc(o.title) +
      '</span><span class="cr-count">' +
      esc(o.count) +
      "</span></button>" +
      (o.help ? '<p class="cr-zone-help">' + esc(o.help) + "</p>" : "") +
      '<div class="cr-zone-body">' +
      o.body +
      "</div></section>"
    );
  }

  function renderLeft() {
    const el = $("cr-left");
    const scroll = el.scrollTop;
    let html = '<div class="cr-left-head"><h2>' + esc(t("left.current", { year: sel.year })) + "</h2></div>";
    ctx.originIds.forEach((gid) => {
      const list = ctx.origin[gid] || [];
      html += zoneHtml({
        kind: "origin",
        drop: "origin",
        cid: gid,
        title: gid,
        icon: "fa-users",
        count: t("left.toPlace", { n: list.length, total: ctx.originTotals[gid] || 0 }),
        body: cardsHtml(list, t("left.allPlaced")),
      });
    });
    html += zoneHtml({
      kind: "unassigned",
      drop: "u",
      cid: "__u",
      title: t("zone.unassigned"),
      icon: "fa-inbox",
      count: String(ctx.unassigned.length),
      body: cardsHtml(ctx.unassigned, t("zone.unassignedEmpty")),
    });
    const nextGroups = SchoolRoster.groups(sel.year).filter((g) => g.level === sel.level + 1);
    html +=
      '<div class="cr-left-actions">' +
      '<button type="button" class="cr-btn cr-btn-soft cr-btn-sm" data-act="add-new"><i class="fa-solid fa-user-plus"></i> ' +
      esc(t("btn.addNew")) +
      "</button>" +
      '<button type="button" class="cr-btn cr-btn-soft cr-btn-sm" data-act="add-repeater"' +
      (nextGroups.length ? "" : " disabled") +
      ' data-tip="' +
      esc(t("tip.addRepeater", { grade: gradeName(sel.level + 1) })) +
      '"><i class="fa-solid fa-arrow-rotate-left"></i> ' +
      esc(t("btn.addRepeater")) +
      "</button></div>";
    html += zoneHtml({
      kind: "out",
      drop: "notReturning",
      cid: "__nr",
      title: t("zone.notReturning"),
      icon: "fa-door-open",
      count: String(ctx.notReturning.length),
      help: t("zone.notReturningHelp"),
      body: cardsHtml(ctx.notReturning, t("zone.dropHere")),
    });
    html += zoneHtml({
      kind: "out",
      drop: "repeating",
      cid: "__rep",
      title: t("zone.repeating", { grade: gradeName(sel.level) }),
      icon: "fa-arrow-rotate-left",
      count: String(ctx.repeating.length),
      help: t("zone.repeatingHelp"),
      body: cardsHtml(ctx.repeating, t("zone.dropHere")),
    });
    el.innerHTML = html;
    el.scrollTop = scroll;
  }

  function pillHtml(cat, l, n, flagged) {
    return (
      '<span class="cr-pill' +
      (n ? "" : " is-zero") +
      (flagged ? " is-flag" : "") +
      '" style="--lv:' +
      l.color +
      '" data-tip="' +
      esc(lvLabel(cat, l.v) + ": " + n) +
      '"><i class="fa-solid ' +
      l.icon +
      '"></i>' +
      n +
      "</span>"
    );
  }

  function summaryHtml(gid) {
    const s = ctx.stats[gid];
    const flags = ctx.flags[gid];
    const marks = new Set(flags.map((f) => f.mark));
    const pl = plan();
    let html = '<div class="cr-sum">';
    html +=
      '<div class="cr-sum-top"><span class="cr-sum-total' +
      (marks.has("size") ? " is-flag" : "") +
      '"><i class="fa-solid fa-users"></i> <b>' +
      s.total +
      "</b>" +
      (pl.target ? " / " + pl.target : "") +
      " " +
      esc(tn("sum.students", s.total)) +
      "</span>" +
      '<span class="cr-sum-gender' +
      (marks.has("gender") ? " is-flag" : "") +
      '">' +
      CAT.gender.levels.map((l) => pillHtml("gender", l, s.cats.gender[l.v], false)).join("") +
      (s.cats.gender.none
        ? '<span class="cr-pill is-none" data-tip="' + esc(t("gender.notSet") + ": " + s.cats.gender.none) + '">?' + s.cats.gender.none + "</span>"
        : "") +
      "</span></div>";
    if (s.guessed) html += '<p class="cr-sum-note">' + esc(tn("sum.guessed", s.guessed)) + "</p>";
    CATEGORIES.filter((c) => c.id !== "gender").forEach((c) => {
      html +=
        '<div class="cr-sum-row"><span class="cr-sum-cat"><i class="fa-solid ' +
        c.icon +
        '"></i> ' +
        esc(t("catShort." + c.id)) +
        '</span><span class="cr-sum-pills">' +
        c.levels.map((l) => pillHtml(c.id, l, s.cats[c.id][l.v], marks.has(c.id + ":" + l.v))).join("") +
        (s.cats[c.id].none
          ? '<span class="cr-pill is-none" data-tip="' + esc(t("notRated") + ": " + s.cats[c.id].none) + '">–' + s.cats[c.id].none + "</span>"
          : "") +
        "</span></div>";
    });
    const broken = ctx.links.perGroup[gid] || 0;
    html +=
      '<div class="cr-sum-extra"><span><i class="fa-solid fa-star-of-life"></i> ' +
      esc(t("sum.new", { n: s.newCount })) +
      "</span>" +
      (s.repeaterCount
        ? "<span><i class=\"fa-solid fa-arrow-rotate-left\"></i> " + esc(t("sum.repeaters", { n: s.repeaterCount })) + "</span>"
        : "") +
      '<span class="' +
      (broken ? "is-flag" : "") +
      '"><i class="fa-solid fa-link-slash"></i> ' +
      esc(t("sum.broken", { n: broken })) +
      "</span></div>";
    if (flags.length) {
      html +=
        '<ul class="cr-flags">' +
        flags.map((f) => '<li><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(flagText(f)) + "</li>").join("") +
        "</ul>";
    }
    return html + "</div>";
  }

  function renderGroups() {
    const pl = plan();
    const el = $("cr-groups");
    el.style.setProperty("--cols", Math.min(pl.groups.length, 4));
    el.innerHTML = pl.groups
      .map((g) => {
        const list = ctx.members[g.id];
        const flags = ctx.flags[g.id];
        return (
          '<section class="cr-col' +
          (flags.length ? " has-flags" : "") +
          '" data-drop="group" data-gid="' +
          esc(g.id) +
          '">' +
          '<header class="cr-col-head"><input class="cr-col-name" data-gid="' +
          esc(g.id) +
          '" value="' +
          esc(g.name) +
          '" maxlength="12" aria-label="' +
          esc(t("col.rename")) +
          '" data-tip="' +
          esc(t("col.rename")) +
          '"/><span class="cr-col-count">' +
          list.length +
          (pl.target ? "/" + pl.target : "") +
          "</span>" +
          (flags.length
            ? '<span class="cr-col-flag" data-tip="' +
              esc(flags.map(flagText).join("\n")) +
              '"><i class="fa-solid fa-triangle-exclamation"></i> ' +
              flags.length +
              "</span>"
            : "") +
          "</header>" +
          '<div class="cr-col-body">' +
          cardsHtml(list, t("col.empty")) +
          "</div>" +
          summaryHtml(g.id) +
          "</section>"
        );
      })
      .join("");
  }

  function renderSelBar() {
    const bar = $("cr-selbar");
    const n = selected.size;
    if (!n && !selectMode) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.innerHTML =
      '<span class="cr-selbar-count"><i class="fa-regular fa-square-check"></i> ' +
      esc(tn("sel.count", n)) +
      "</span>" +
      (n
        ? '<button type="button" class="cr-btn cr-btn-sm cr-btn-primary" data-act="sel-move"><i class="fa-solid fa-arrow-right-arrow-left"></i> ' +
          esc(t("sel.moveTo")) +
          "</button>" +
          '<button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="sel-pin"><i class="fa-solid fa-thumbtack"></i> ' +
          esc(t("sel.pin")) +
          "</button>" +
          '<button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="sel-unpin">' +
          esc(t("sel.unpin")) +
          "</button>"
        : '<span class="cr-selbar-hint">' + esc(t("sel.hint")) + "</span>") +
      '<button type="button" class="cr-btn cr-btn-sm cr-btn-ghost" data-act="sel-clear"><i class="fa-solid fa-xmark"></i> ' +
      esc(selectMode ? t("sel.done") : t("sel.clear")) +
      "</button>";
  }

  // ═══════════════════════════ MOVES ═══════════════════════════
  function moveStudents(keys, dest, gid) {
    const pl = plan();
    let skipped = 0;
    change(() => {
      keys.forEach((k) => {
        const st = ctx.byKey.get(k);
        if (!st) return;
        const p = prof(k);
        if (dest === "group") {
          if (!pl.groups.some((g) => g.id === gid)) return;
          pl.assign[k] = gid;
          delete p.status;
        } else if (dest === "u") {
          pl.assign[k] = "u";
          delete pl.pinned[k];
          delete p.status;
        } else if (dest === "origin") {
          delete pl.assign[k];
          delete pl.pinned[k];
          delete p.status;
        } else if (dest === "notReturning") {
          p.status = "notReturning";
          delete pl.assign[k];
          delete pl.pinned[k];
        } else if (dest === "repeating") {
          if (st.source !== "roster") {
            skipped++;
            return;
          }
          p.status = "repeating";
          delete pl.assign[k];
          delete pl.pinned[k];
        }
        if (!Object.keys(p).length) delete G.profiles[k];
      });
    });
    if (skipped) toast(t("toast.repeatOnlyRoster"), "warn");
    selected.clear();
    renderSelBar();
    document.querySelectorAll(".cr-card.is-selected").forEach((el) => el.classList.remove("is-selected"));
  }

  function setPinned(keys, on) {
    const pl = plan();
    change(() => {
      keys.forEach((k) => {
        const st = ctx.byKey.get(k);
        if (!st || !ctx.groupIds.has(st.loc)) return;
        if (on) pl.pinned[k] = true;
        else delete pl.pinned[k];
      });
    });
  }

  function moveMenuItems(keys) {
    const pl = plan();
    const sts = keys.map((k) => ctx.byKey.get(k)).filter(Boolean);
    const items = pl.groups.map((g) => ({
      icon: "fa-people-roof",
      label: t("move.toGroup", { g: g.name }),
      disabled: sts.every((s) => s.loc === g.id),
      run: () => moveStudents(keys, "group", g.id),
    }));
    items.push({ sep: true });
    items.push({ icon: "fa-inbox", label: t("zone.unassigned"), run: () => moveStudents(keys, "u") });
    if (sts.some((s) => s.source === "roster"))
      items.push({
        icon: "fa-users",
        label: sts.length === 1 ? t("move.backTo", { g: sts[0].from }) : t("move.backToPrevious"),
        run: () => moveStudents(keys, "origin"),
      });
    items.push({ sep: true });
    items.push({ icon: "fa-door-open", label: t("zone.notReturning"), run: () => moveStudents(keys, "notReturning") });
    if (sts.every((s) => s.source === "roster"))
      items.push({
        icon: "fa-arrow-rotate-left",
        label: t("zone.repeating", { grade: gradeName(sel.level) }),
        run: () => moveStudents(keys, "repeating"),
      });
    return items;
  }

  function cycleChip(key) {
    const st = ctx.byKey.get(key);
    if (!st) return;
    const cat = ui.view;
    change(() => {
      const p = prof(key);
      if (cat === "gender") {
        const gi = genderInfo(st);
        if (gi.guessed) p.gender = gi.value; // first click confirms the suggestion
        else if (gi.value === "boy") p.gender = "girl";
        else if (gi.value === "girl") p.gender = null;
        else p.gender = "boy";
        return;
      }
      const levels = CAT[cat].levels.map((l) => l.v);
      const cur = ratingOf(st, cat);
      const idx = cur ? levels.indexOf(cur) : -1;
      if (idx + 1 < levels.length) p[cat] = levels[idx + 1];
      else delete p[cat];
    });
  }

  function toggleSelect(key) {
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    document
      .querySelectorAll('.cr-card[data-key="' + cssEsc(key) + '"]')
      .forEach((el) => el.classList.toggle("is-selected", selected.has(key)));
    renderSelBar();
  }

  // ═══════════════════════════ DRAG & DROP (mouse + touch) ═══════════════════════════
  // Same idea as classroom-distribution-v2.js: the card follows the pointer as a
  // floating copy and the zone under it lights up. Touch starts after a short
  // hold so the page still scrolls when you swipe over cards.
  let drag = null;
  let suppressClickUntil = 0;
  let lastTouchAt = 0;

  function dragStart(e, isTouch) {
    const card = e.target.closest(".cr-card[data-key]");
    if (!card || card.closest(".cr-modal")) return;
    if (e.target.closest("button, input, textarea, select, a")) return;
    if (!isTouch && e.button !== 0) return;
    if (isTouch && e.touches.length !== 1) return;
    const pt = isTouch ? e.touches[0] : e;
    drag = {
      key: card.dataset.key,
      card,
      x0: pt.clientX,
      y0: pt.clientY,
      x: pt.clientX,
      y: pt.clientY,
      active: false,
      touch: isTouch,
      timer: null,
      zone: null,
    };
    if (isTouch) {
      lastTouchAt = Date.now();
      drag.timer = setTimeout(() => {
        if (drag && !drag.active) {
          beginDrag();
          if (navigator.vibrate) {
            try {
              navigator.vibrate(12);
            } catch (err) {}
          }
        }
      }, 220);
    } else {
      e.preventDefault(); // no text selection while dragging
    }
  }

  function beginDrag() {
    drag.active = true;
    const keys = selected.has(drag.key) ? [...selected] : [drag.key];
    drag.keys = keys;
    const rect = drag.card.getBoundingClientRect();
    drag.offX = Math.min(Math.max(drag.x0 - rect.left, 0), rect.width);
    drag.offY = Math.min(Math.max(drag.y0 - rect.top, 0), rect.height);
    const ghost = drag.card.cloneNode(true);
    ghost.classList.add("cr-ghost");
    ghost.classList.remove("is-dim");
    ghost.style.width = rect.width + "px";
    if (keys.length > 1) ghost.insertAdjacentHTML("beforeend", '<span class="cr-ghost-count">' + keys.length + "</span>");
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    keys.forEach((k) =>
      document.querySelectorAll('.cr-card[data-key="' + cssEsc(k) + '"]').forEach((el) => el.classList.add("is-dragging")),
    );
    document.body.classList.add("cr-is-dragging");
    hideTip();
    closeMenu();
    moveGhost();
    requestAnimationFrame(autoScroll);
  }

  function moveGhost() {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.transform =
      "translate3d(" + (drag.x - drag.offX) + "px," + (drag.y - drag.offY) + "px,0) rotate(1.5deg)";
    updateDropTarget();
  }

  function updateDropTarget() {
    const el = document.elementFromPoint(drag.x, drag.y);
    const zone = el ? el.closest("[data-drop]") : null;
    if (zone !== drag.zone) {
      if (drag.zone) drag.zone.classList.remove("is-over");
      if (zone) zone.classList.add("is-over");
      drag.zone = zone;
    }
  }

  function autoScroll() {
    if (!drag || !drag.active) return;
    const edge = 70;
    const speed = (d) => Math.ceil(((edge - d) / edge) * 18);
    let scrolled = false;
    const left = $("cr-left");
    const lr = left.getBoundingClientRect();
    const overLeft = drag.x >= lr.left && drag.x <= lr.right && left.scrollHeight > left.clientHeight + 2;
    if (overLeft && drag.y < lr.top + edge && drag.y > lr.top - 10 && left.scrollTop > 0) {
      left.scrollTop -= speed(Math.max(0, drag.y - lr.top));
      scrolled = true;
    } else if (overLeft && drag.y > lr.bottom - edge && drag.y < lr.bottom + 10) {
      left.scrollTop += speed(Math.max(0, lr.bottom - drag.y));
      scrolled = true;
    } else if (drag.y < edge) {
      window.scrollBy(0, -speed(Math.max(0, drag.y)));
      scrolled = true;
    } else if (drag.y > window.innerHeight - edge) {
      window.scrollBy(0, speed(Math.max(0, window.innerHeight - drag.y)));
      scrolled = true;
    }
    if (scrolled) updateDropTarget();
    requestAnimationFrame(autoScroll);
  }

  function finishDrag(cancel) {
    const d = drag;
    drag = null;
    if (!d) return;
    clearTimeout(d.timer);
    if (!d.active) return;
    suppressClickUntil = Date.now() + 350;
    if (d.ghost) d.ghost.remove();
    if (d.zone) d.zone.classList.remove("is-over");
    document.body.classList.remove("cr-is-dragging");
    document.querySelectorAll(".cr-card.is-dragging").forEach((el) => el.classList.remove("is-dragging"));
    if (cancel || !d.zone) {
      suppressClickUntil = Date.now() + 350;
      return;
    }
    moveStudents(d.keys, d.zone.dataset.drop, d.zone.dataset.gid);
  }

  function bindDrag() {
    document.addEventListener("mousedown", (e) => {
      if (Date.now() - lastTouchAt < 800) return; // emulated mouse after touch
      dragStart(e, false);
    });
    document.addEventListener("mousemove", (e) => {
      if (!drag || drag.touch) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (!drag.active) {
        if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 5) return;
        beginDrag();
      }
      moveGhost();
    });
    document.addEventListener("mouseup", () => {
      if (drag && !drag.touch) finishDrag(false);
    });
    document.addEventListener("touchstart", (e) => dragStart(e, true), { passive: true });
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!drag || !drag.touch) return;
        const pt = e.touches[0];
        drag.x = pt.clientX;
        drag.y = pt.clientY;
        if (!drag.active) {
          if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 10) {
            clearTimeout(drag.timer);
            drag = null; // the finger is scrolling the page
          }
          return;
        }
        e.preventDefault();
        moveGhost();
      },
      { passive: false },
    );
    document.addEventListener("touchend", (e) => {
      if (!drag || !drag.touch) return;
      lastTouchAt = Date.now();
      if (drag.active) e.preventDefault();
      finishDrag(false);
    });
    document.addEventListener("touchcancel", () => {
      if (drag && drag.touch) finishDrag(true);
    });
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".cr-card") && (drag || Date.now() - lastTouchAt < 800)) e.preventDefault();
    });
    window.addEventListener("blur", () => drag && finishDrag(true));
  }

  // ═══════════════════════════ TOOLTIP ═══════════════════════════
  let tipTarget = null;
  let tipTimer = null;
  function showTip(el) {
    const text = el.dataset.tip;
    if (!text) return;
    const tip = $("cr-tip");
    tip.textContent = text;
    tip.hidden = false;
    tipTarget = el;
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - tr.width - 8));
    let y = r.top - tr.height - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function hideTip() {
    clearTimeout(tipTimer);
    $("cr-tip").hidden = true;
    tipTarget = null;
  }

  function bindTips() {
    document.addEventListener("mouseover", (e) => {
      if (drag && drag.active) return;
      if (Date.now() - lastTouchAt < 800) return;
      const el = e.target.closest("[data-tip]");
      if (el === tipTarget) return;
      clearTimeout(tipTimer);
      if (!el) {
        hideTip();
        return;
      }
      tipTimer = setTimeout(() => showTip(el), el.classList.contains("cr-warn") ? 80 : 350);
    });
    document.addEventListener("scroll", hideTip, true);
  }

  // ═══════════════════════════ POPUP MENU ═══════════════════════════
  let menuItems = [];
  function showMenu(anchor, items, title) {
    const menu = $("cr-menu");
    menuItems = items;
    menu.innerHTML =
      (title ? '<div class="cr-menu-title">' + esc(title) + "</div>" : "") +
      items
        .map((it, i) =>
          it.sep
            ? '<div class="cr-menu-sep"></div>'
            : '<button type="button" role="menuitem" class="cr-menu-item' +
              (it.danger ? " is-danger" : "") +
              '" data-idx="' +
              i +
              '"' +
              (it.disabled ? " disabled" : "") +
              ">" +
              (it.icon ? '<i class="fa-solid ' + it.icon + '"></i>' : "") +
              "<span>" +
              esc(it.label) +
              "</span></button>",
        )
        .join("");
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    const mr = menu.getBoundingClientRect();
    let x = r.left;
    if (x + mr.width > window.innerWidth - 8) x = Math.max(8, r.right - mr.width);
    let y = r.bottom + 6;
    if (y + mr.height > window.innerHeight - 8) y = Math.max(8, r.top - mr.height - 6);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    const first = menu.querySelector(".cr-menu-item:not([disabled])");
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu() {
    $("cr-menu").hidden = true;
    menuItems = [];
  }

  function bindMenu() {
    $("cr-menu").addEventListener("click", (e) => {
      const b = e.target.closest(".cr-menu-item");
      if (!b) return;
      e.stopPropagation();
      const it = menuItems[Number(b.dataset.idx)];
      closeMenu();
      if (it && it.run) it.run();
    });
    document.addEventListener("mousedown", (e) => {
      if (!$("cr-menu").hidden && !e.target.closest("#cr-menu")) closeMenu();
    });
    document.addEventListener("touchstart", (e) => {
      if (!$("cr-menu").hidden && !e.target.closest("#cr-menu")) closeMenu();
    }, { passive: true });
    window.addEventListener("resize", closeMenu);
  }

  // ═══════════════════════════ TOAST ═══════════════════════════
  let toastTimer = null;
  function toast(msg, kind) {
    const el = $("cr-toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "cr-toast" + (kind ? " is-" + kind : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), kind === "error" ? 6000 : 3200);
  }

  // ═══════════════════════════ MODALS ═══════════════════════════
  const modalStack = [];
  function openModal(o) {
    const wrap = document.createElement("div");
    wrap.className = "cr-modal-backdrop";
    wrap.innerHTML =
      '<div class="cr-modal' +
      (o.wide ? " is-wide" : "") +
      (o.className ? " " + o.className : "") +
      '" role="dialog" aria-modal="true"><div class="cr-modal-head"><h3></h3>' +
      '<button type="button" class="cr-icon-btn cr-modal-x" aria-label="' +
      esc(t("btn.close")) +
      '"><i class="fa-solid fa-xmark"></i></button></div><div class="cr-modal-body"></div><div class="cr-modal-foot"></div></div>';
    wrap.querySelector("h3").textContent = o.title;
    const body = wrap.querySelector(".cr-modal-body");
    if (typeof o.body === "string") body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);
    const foot = wrap.querySelector(".cr-modal-foot");
    const m = { el: wrap, body, foot, closed: false };
    m.close = () => {
      if (m.closed) return;
      m.closed = true;
      wrap.remove();
      const i = modalStack.indexOf(m);
      if (i >= 0) modalStack.splice(i, 1);
      if (o.onClose) o.onClose();
    };
    m.setButtons = (buttons) => {
      foot.innerHTML = "";
      (buttons || []).forEach((b) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cr-btn cr-btn-" + (b.kind || "soft");
        btn.innerHTML = (b.icon ? '<i class="fa-solid ' + b.icon + '"></i> ' : "") + esc(b.label);
        if (b.disabled) btn.disabled = true;
        btn.addEventListener("click", () => {
          const r = b.onClick ? b.onClick(m) : undefined;
          if (r !== false) m.close();
        });
        foot.appendChild(btn);
      });
    };
    m.setButtons(o.buttons);
    wrap.querySelector(".cr-modal-x").addEventListener("click", m.close);
    let downOnBackdrop = false;
    wrap.addEventListener("mousedown", (e) => (downOnBackdrop = e.target === wrap));
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap && downOnBackdrop) m.close();
    });
    $("cr-modal-root").appendChild(wrap);
    modalStack.push(m);
    hideTip();
    closeMenu();
    const focusEl = wrap.querySelector("[autofocus], input, textarea, select");
    if (focusEl) setTimeout(() => focusEl.focus(), 30);
    if (o.onOpen) o.onOpen(m);
    return m;
  }

  function confirmDialog(o) {
    return new Promise((resolve) => {
      let answered = false;
      openModal({
        title: o.title,
        body: '<p class="cr-modal-text">' + esc(o.message) + "</p>" + (o.extraHtml || ""),
        onClose: () => !answered && resolve(false),
        buttons: [
          { label: t("btn.cancel"), kind: "ghost", onClick: () => ((answered = true), resolve(false)) },
          {
            label: o.okLabel || t("btn.ok"),
            kind: o.danger ? "danger" : "primary",
            onClick: () => ((answered = true), resolve(true)),
          },
        ],
      });
    });
  }

  function promptDialog(o) {
    return new Promise((resolve) => {
      let answered = false;
      const m = openModal({
        title: o.title,
        body:
          '<label class="cr-label">' +
          esc(o.label) +
          '<input class="cr-input cr-input-wide" id="cr-prompt-input" maxlength="' +
          (o.maxLength || 40) +
          '" value="' +
          esc(o.value || "") +
          '"/></label>',
        onClose: () => !answered && resolve(null),
        buttons: [
          { label: t("btn.cancel"), kind: "ghost", onClick: () => ((answered = true), resolve(null)) },
          {
            label: o.okLabel || t("btn.save"),
            kind: "primary",
            onClick: () => {
              const v = m.body.querySelector("input").value.trim();
              if (!v) return false;
              answered = true;
              resolve(v);
            },
          },
        ],
      });
      const input = m.body.querySelector("input");
      input.select();
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") m.foot.querySelector(".cr-btn-primary").click();
      });
    });
  }

  // ═══════════════════════════ PROFILE DRAWER ═══════════════════════════
  let noteSnapshot = null;

  function openProfile(key) {
    openProfileKey = key;
    renderProfile();
    const d = $("cr-drawer");
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
  }

  function closeProfile() {
    openProfileKey = null;
    const d = $("cr-drawer");
    if (!d) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
  }

  function ratingRowHtml(st, c) {
    const cur = ratingOf(st, c.id);
    const gi = genderInfo(st);
    const guessed = c.id === "gender" && gi.guessed;
    let html =
      '<div class="cr-rate"><div class="cr-rate-title"><i class="fa-solid ' +
      c.icon +
      '"></i> ' +
      esc(catLabel(c.id)) +
      '</div><div class="cr-seg">';
    c.levels.forEach((l) => {
      const on = cur === l.v && !guessed;
      html +=
        '<button type="button" class="cr-seg-btn' +
        (on ? " is-on" : "") +
        (guessed && cur === l.v ? " is-guess" : "") +
        '" style="--lv:' +
        l.color +
        '" data-act="rate" data-cat="' +
        c.id +
        '" data-val="' +
        l.v +
        '" aria-pressed="' +
        on +
        '"><i class="fa-solid ' +
        l.icon +
        '"></i> ' +
        esc(lvLabel(c.id, l.v)) +
        "</button>";
    });
    html +=
      '<button type="button" class="cr-seg-btn is-none-btn' +
      (!cur ? " is-on" : "") +
      '" data-act="rate" data-cat="' +
      c.id +
      '" data-val="">' +
      esc(t("notRated")) +
      "</button></div>";
    if (guessed) {
      html +=
        '<p class="cr-guess-note"><i class="fa-solid fa-wand-magic-sparkles"></i> ' +
        esc(t("gender.suggested", { g: lvLabel("gender", gi.value) })) +
        ' <button type="button" class="cr-link-btn" data-act="rate" data-cat="gender" data-val="' +
        gi.value +
        '">' +
        esc(t("gender.confirm")) +
        "</button></p>";
    }
    return html + "</div>";
  }

  function linkItemHtml(link, selfKey) {
    const others = link.members.filter((k) => k !== selfKey && ctx.byKey.has(k));
    const broken = ctx.links.brokenIds.has(link.id);
    return (
      '<li class="cr-link-item' +
      (broken ? " is-broken" : "") +
      '"><i class="fa-solid ' +
      (link.type === "apart" ? "fa-people-arrows" : "fa-link") +
      '"></i><div class="cr-link-text"><strong>' +
      esc(t(link.type === "apart" ? "links.apart" : "links.together")) +
      ":</strong> " +
      esc(namesOf(others).join(", ") || "—") +
      (link.reason ? '<small>' + esc(link.reason) + "</small>" : "") +
      (broken ? '<small class="cr-link-broken"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(t("links.broken")) + "</small>" : "") +
      '</div><button type="button" class="cr-icon-btn cr-icon-sm" data-act="link-edit" data-link="' +
      esc(link.id) +
      '" aria-label="' +
      esc(t("btn.edit")) +
      '" data-tip="' +
      esc(t("btn.edit")) +
      '"><i class="fa-solid fa-pen"></i></button><button type="button" class="cr-icon-btn cr-icon-sm" data-act="link-remove" data-link="' +
      esc(link.id) +
      '" aria-label="' +
      esc(t("btn.remove")) +
      '" data-tip="' +
      esc(t("btn.remove")) +
      '"><i class="fa-solid fa-trash"></i></button></li>'
    );
  }

  function renderProfile() {
    const st = ctx && ctx.byKey.get(openProfileKey);
    const inner = $("cr-drawer-inner");
    if (!st) {
      closeProfile();
      return;
    }
    if (inner.contains(document.activeElement) && document.activeElement.id === "cr-note") return; // typing
    const p = G.profiles[st.key] || {};
    const placed = ctx.groupIds.has(st.loc);
    let html =
      '<div class="cr-drawer-head"><div class="cr-drawer-title">' +
      (st.source === "roster"
        ? "<h3>" + esc(st.name) + "</h3>"
        : '<input class="cr-input cr-name-input" id="cr-extra-name" value="' + esc(st.name) + '" aria-label="' + esc(t("add.name")) + '"/>') +
      '<div class="cr-drawer-sub">' +
      (st.from ? '<span class="cr-from">' + esc(t("card.from", { g: st.from })) + "</span>" : "") +
      (st.source === "new" ? '<span class="cr-badge cr-badge-new">' + esc(t("badge.new")) + "</span>" : "") +
      (st.source === "repeater" ? '<span class="cr-badge cr-badge-rep">' + esc(t("badge.repeater")) + "</span>" : "") +
      '<span class="cr-loc"><i class="fa-solid fa-location-dot"></i> ' +
      esc(locLabel(st)) +
      "</span></div></div>" +
      '<button type="button" class="cr-icon-btn" data-act="close-profile" aria-label="' +
      esc(t("btn.close")) +
      '"><i class="fa-solid fa-xmark"></i></button></div>';

    html += '<div class="cr-drawer-actions">';
    if (placed)
      html +=
        '<button type="button" class="cr-btn cr-btn-sm ' +
        (st.pinned ? "cr-btn-primary" : "cr-btn-soft") +
        '" data-act="profile-pin"><i class="fa-solid fa-thumbtack"></i> ' +
        esc(st.pinned ? t("profile.pinned") : t("profile.pin")) +
        "</button>";
    html +=
      '<button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="profile-move"><i class="fa-solid fa-arrow-right-arrow-left"></i> ' +
      esc(t("sel.moveTo")) +
      "</button></div>";

    CATEGORIES.forEach((c) => (html += ratingRowHtml(st, c)));

    html +=
      '<div class="cr-rate"><label class="cr-rate-title" for="cr-note"><i class="fa-solid fa-lock"></i> ' +
      esc(t("profile.note")) +
      '</label><textarea id="cr-note" class="cr-textarea" rows="3" placeholder="' +
      esc(t("profile.notePh")) +
      '">' +
      esc(p.note || "") +
      "</textarea></div>";

    const myLinks = (G.links || []).filter((l) => l.members.includes(st.key));
    html +=
      '<div class="cr-rate"><div class="cr-rate-title"><i class="fa-solid fa-link"></i> ' +
      esc(t("links.title")) +
      "</div>" +
      (myLinks.length
        ? '<ul class="cr-link-list">' + myLinks.map((l) => linkItemHtml(l, st.key)).join("") + "</ul>"
        : '<p class="cr-muted">' + esc(t("links.none")) + "</p>") +
      '<div class="cr-inline-wrap"><button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="link-add" data-type="apart"><i class="fa-solid fa-people-arrows"></i> ' +
      esc(t("links.addApart")) +
      '</button><button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="link-add" data-type="together"><i class="fa-solid fa-link"></i> ' +
      esc(t("links.addTogether")) +
      "</button></div></div>";

    html += '<div class="cr-rate"><div class="cr-rate-title"><i class="fa-solid fa-user-gear"></i> ' + esc(t("profile.status")) + '</div><div class="cr-inline-wrap">';
    if (st.status !== "active") {
      html +=
        '<button type="button" class="cr-btn cr-btn-sm cr-btn-primary" data-act="status" data-val="active"><i class="fa-solid fa-rotate"></i> ' +
        esc(t("profile.restore")) +
        "</button>";
    }
    if (st.status !== "notReturning")
      html +=
        '<button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="status" data-val="notReturning"><i class="fa-solid fa-door-open"></i> ' +
        esc(t("zone.notReturning")) +
        "</button>";
    if (st.source === "roster" && st.status !== "repeating")
      html +=
        '<button type="button" class="cr-btn cr-btn-sm cr-btn-soft" data-act="status" data-val="repeating"><i class="fa-solid fa-arrow-rotate-left"></i> ' +
        esc(t("zone.repeating", { grade: gradeName(sel.level) })) +
        "</button>";
    if (st.source !== "roster")
      html +=
        '<button type="button" class="cr-btn cr-btn-sm cr-btn-danger" data-act="extra-remove"><i class="fa-solid fa-trash"></i> ' +
        esc(t("profile.removeExtra")) +
        "</button>";
    html += "</div></div>";
    html += '<p class="cr-privacy-note"><i class="fa-solid fa-shield-halved"></i> ' + esc(t("privacy.profile")) + "</p>";

    inner.innerHTML = html;

    const note = $("cr-note");
    note.addEventListener("focus", () => (noteSnapshot = JSON.stringify(G)));
    note.addEventListener("input", () => {
      const v = note.value;
      const pp = prof(st.key);
      if (v) pp.note = v;
      else delete pp.note;
      saveStore();
    });
    note.addEventListener("blur", () => {
      if (noteSnapshot && noteSnapshot !== JSON.stringify(G)) {
        undoStack.push(noteSnapshot);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack = [];
      }
      noteSnapshot = null;
      setTimeout(render, 0);
    });
    const nameInput = $("cr-extra-name");
    if (nameInput)
      nameInput.addEventListener("change", () => {
        const v = cleanName(nameInput.value);
        if (!v) {
          nameInput.value = st.name;
          return;
        }
        change(() => {
          if (G.extras[st.key]) G.extras[st.key].name = v;
        });
      });
  }

  function setStatus(key, status) {
    const st = ctx.byKey.get(key);
    if (!st) return;
    if (status === "active") {
      change(() => {
        delete prof(key).status;
      });
    } else moveStudents([key], status);
  }

  async function removeExtra(key) {
    const st = ctx.byKey.get(key);
    if (!st) return;
    const ok = await confirmDialog({
      title: t("profile.removeExtra"),
      message: t("confirm.removeExtra", { name: st.name }),
      okLabel: t("btn.remove"),
      danger: true,
    });
    if (!ok) return;
    closeProfile();
    change(() => {
      delete G.extras[key];
      delete G.profiles[key];
      G.plans.forEach((p) => {
        delete p.assign[key];
        delete p.pinned[key];
      });
      G.links = G.links
        .map((l) => Object.assign({}, l, { members: l.members.filter((k) => k !== key) }))
        .filter((l) => l.members.length >= 2);
    });
  }

  // ═══════════════════════════ LINKS ═══════════════════════════
  function studentPickerHtml(excludeKey, checkedKeys) {
    const checked = new Set(checkedKeys || []);
    const groups = {};
    ctx.students
      .filter((s) => s.key !== excludeKey && s.status === "active")
      .forEach((s) => {
        const g = s.from || t("zone.unassigned");
        (groups[g] = groups[g] || []).push(s);
      });
    return (
      '<input class="cr-input cr-input-wide cr-picker-search" type="search" placeholder="' +
      esc(t("picker.search")) +
      '"/><div class="cr-picker">' +
      Object.keys(groups)
        .sort(cmpGroupId)
        .map(
          (g) =>
            '<div class="cr-picker-group"><div class="cr-picker-title">' +
            esc(g) +
            "</div>" +
            groups[g]
              .map(
                (s) =>
                  '<label class="cr-picker-item" data-name="' +
                  esc(norm(s.name)) +
                  '"><input type="checkbox" value="' +
                  esc(s.key) +
                  '"' +
                  (checked.has(s.key) ? " checked" : "") +
                  "/> <span>" +
                  esc(s.name) +
                  "</span>" +
                  (ctx.groupIds.has(s.loc) ? '<small>' + esc(groupName(s.loc)) + "</small>" : "") +
                  "</label>",
              )
              .join("") +
            "</div>",
        )
        .join("") +
      "</div>"
    );
  }

  function bindPickerSearch(root) {
    const input = root.querySelector(".cr-picker-search");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = norm(input.value);
      root.querySelectorAll(".cr-picker-item").forEach((el) => {
        el.hidden = q && !el.dataset.name.includes(q);
      });
      root.querySelectorAll(".cr-picker-group").forEach((g) => {
        g.hidden = ![...g.querySelectorAll(".cr-picker-item")].some((el) => !el.hidden);
      });
    });
  }

  // baseKey: the student whose profile is open (null from the links overview)
  function openLinkModal(type, baseKey, existing) {
    const link = existing || { type, members: baseKey ? [baseKey] : [], reason: "" };
    const kind = existing ? existing.type : type;
    const fixedKey = baseKey && link.members.includes(baseKey) ? baseKey : null;
    const pre = link.members.filter((k) => k !== fixedKey);
    const base = fixedKey ? ctx.byKey.get(fixedKey) : null;
    const m = openModal({
      title: t(kind === "apart" ? "links.modalApart" : "links.modalTogether"),
      wide: true,
      body:
        '<p class="cr-modal-text">' +
        esc(
          base
            ? t(kind === "apart" ? "links.helpApartWith" : "links.helpTogetherWith", { name: base.name })
            : t(kind === "apart" ? "links.helpApart" : "links.helpTogether"),
        ) +
        "</p>" +
        studentPickerHtml(fixedKey, pre) +
        '<label class="cr-label">' +
        esc(t("links.reason")) +
        '<input class="cr-input cr-input-wide" id="cr-link-reason" maxlength="120" value="' +
        esc(link.reason || "") +
        '" placeholder="' +
        esc(t("links.reasonPh")) +
        '"/></label>',
      buttons: [
        { label: t("btn.cancel"), kind: "ghost" },
        {
          label: t("btn.save"),
          kind: "primary",
          onClick: (mm) => {
            const chosen = [...mm.body.querySelectorAll('.cr-picker input[type="checkbox"]:checked')].map((i) => i.value);
            const members = (fixedKey ? [fixedKey] : []).concat(chosen);
            if (members.length < 2) {
              toast(t(fixedKey ? "links.needOne" : "links.needTwo"), "warn");
              return false;
            }
            const reason = mm.body.querySelector("#cr-link-reason").value.trim();
            change(() => {
              // keep members that aren't in this redistribution right now (e.g. not returning)
              const hidden = existing ? existing.members.filter((k) => !ctx.byKey.has(k) || ctx.byKey.get(k).status !== "active") : [];
              const all = [...new Set(members.concat(hidden))];
              if (existing) {
                const l = G.links.find((x) => x.id === existing.id);
                if (l) {
                  l.members = all;
                  l.reason = reason;
                }
              } else G.links.push({ id: uid("link"), type: kind, members: all, reason });
            });
          },
        },
      ],
    });
    bindPickerSearch(m.body);
  }

  async function removeLink(id) {
    const ok = await confirmDialog({
      title: t("links.removeTitle"),
      message: t("links.removeMsg"),
      okLabel: t("btn.remove"),
      danger: true,
    });
    if (!ok) return;
    change(() => {
      G.links = G.links.filter((l) => l.id !== id);
    });
    refreshLinksModal();
  }

  let linksModal = null;
  function linksOverviewHtml() {
    const links = G.links || [];
    if (!links.length) return '<p class="cr-muted">' + esc(t("links.noneAll")) + "</p>";
    return (
      '<ul class="cr-link-list">' +
      links
        .map((l) => {
          const broken = ctx.links.brokenIds.has(l.id);
          const names = namesOf(l.members.filter((k) => ctx.byKey.has(k)));
          return (
            '<li class="cr-link-item' +
            (broken ? " is-broken" : "") +
            '"><i class="fa-solid ' +
            (l.type === "apart" ? "fa-people-arrows" : "fa-link") +
            '"></i><div class="cr-link-text"><strong>' +
            esc(t(l.type === "apart" ? "links.apart" : "links.together")) +
            ":</strong> " +
            esc(names.join(", ")) +
            (l.reason ? "<small>" + esc(l.reason) + "</small>" : "") +
            (broken
              ? '<small class="cr-link-broken"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(t("links.broken")) + "</small>"
              : '<small class="cr-link-ok"><i class="fa-solid fa-check"></i> ' + esc(t("links.ok")) + "</small>") +
            '</div><button type="button" class="cr-icon-btn cr-icon-sm" data-act="link-edit" data-link="' +
            esc(l.id) +
            '" aria-label="' +
            esc(t("btn.edit")) +
            '"><i class="fa-solid fa-pen"></i></button><button type="button" class="cr-icon-btn cr-icon-sm" data-act="link-remove" data-link="' +
            esc(l.id) +
            '" aria-label="' +
            esc(t("btn.remove")) +
            '"><i class="fa-solid fa-trash"></i></button></li>'
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function openLinksOverview() {
    linksModal = openModal({
      title: t("links.overviewTitle"),
      wide: true,
      body: '<div id="cr-links-overview">' + linksOverviewHtml() + "</div>",
      onClose: () => (linksModal = null),
      buttons: [
        { label: t("links.addApart"), icon: "fa-people-arrows", kind: "soft", onClick: () => (openLinkModal("apart", null), false) },
        { label: t("links.addTogether"), icon: "fa-link", kind: "soft", onClick: () => (openLinkModal("together", null), false) },
        { label: t("btn.close"), kind: "primary" },
      ],
    });
  }

  function refreshLinksModal() {
    const el = $("cr-links-overview");
    if (el) el.innerHTML = linksOverviewHtml();
  }

  // ═══════════════════════════ ADD STUDENTS ═══════════════════════════
  function openAddNew() {
    let gender = null;
    const m = openModal({
      title: t("add.newTitle"),
      body:
        '<p class="cr-modal-text">' +
        esc(t("add.newHelp")) +
        '</p><label class="cr-label">' +
        esc(t("add.name")) +
        '<input class="cr-input cr-input-wide" id="cr-new-name" maxlength="80" autofocus/></label>' +
        '<div class="cr-label">' +
        esc(catLabel("gender")) +
        '<div class="cr-seg" id="cr-new-gender">' +
        CAT.gender.levels
          .map(
            (l) =>
              '<button type="button" class="cr-seg-btn" style="--lv:' +
              l.color +
              '" data-val="' +
              l.v +
              '"><i class="fa-solid ' +
              l.icon +
              '"></i> ' +
              esc(lvLabel("gender", l.v)) +
              "</button>",
          )
          .join("") +
        '<button type="button" class="cr-seg-btn is-none-btn is-on" data-val="">' +
        esc(t("notRated")) +
        "</button></div></div>" +
        '<label class="cr-label">' +
        esc(t("add.note")) +
        '<textarea class="cr-textarea" id="cr-new-note" rows="2"></textarea></label>',
      buttons: [
        { label: t("btn.cancel"), kind: "ghost" },
        {
          label: t("btn.add"),
          kind: "primary",
          icon: "fa-user-plus",
          onClick: (mm) => {
            const name = cleanName(mm.body.querySelector("#cr-new-name").value);
            if (!name) {
              toast(t("add.nameRequired"), "warn");
              return false;
            }
            if (ctx.students.some((s) => norm(s.name) === norm(name))) {
              toast(t("add.duplicate", { name }), "warn");
              return false;
            }
            const note = mm.body.querySelector("#cr-new-note").value.trim();
            change(() => {
              const id = uid("new");
              G.extras[id] = { id, name, source: "new" };
              const p = prof(id);
              if (gender) p.gender = gender;
              if (note) p.note = note;
            });
            toast(t("add.added", { name }));
          },
        },
      ],
    });
    m.body.querySelector("#cr-new-gender").addEventListener("click", (e) => {
      const b = e.target.closest(".cr-seg-btn");
      if (!b) return;
      gender = b.dataset.val || null;
      m.body.querySelectorAll("#cr-new-gender .cr-seg-btn").forEach((x) => x.classList.toggle("is-on", x === b));
    });
  }

  function openAddRepeater() {
    const nextLevel = sel.level + 1;
    const already = new Set(Object.values(G.extras).map((x) => x.rosterId).filter(Boolean));
    const groups = SchoolRoster.groups(sel.year).filter((g) => g.level === nextLevel);
    let body =
      '<p class="cr-modal-text">' +
      esc(t("add.repHelp", { grade: gradeName(nextLevel), next: nextYearOf(sel.year) })) +
      '</p><input class="cr-input cr-input-wide cr-picker-search" type="search" placeholder="' +
      esc(t("picker.search")) +
      '"/><div class="cr-picker">';
    let any = false;
    groups.forEach((g) => {
      const list = SchoolRoster.students(g.id, { year: sel.year }).filter((s) => !already.has(s.id));
      if (!list.length) return;
      any = true;
      body +=
        '<div class="cr-picker-group"><div class="cr-picker-title">' +
        esc(g.id) +
        "</div>" +
        list
          .map(
            (s) =>
              '<label class="cr-picker-item" data-name="' +
              esc(norm(s.name)) +
              '"><input type="checkbox" value="' +
              esc(s.id) +
              '" data-name="' +
              esc(s.name) +
              '" data-group="' +
              esc(g.id) +
              '"/> <span>' +
              esc(s.name) +
              "</span></label>",
          )
          .join("") +
        "</div>";
    });
    body += any ? "</div>" : '<p class="cr-muted">' + esc(t("add.repNone")) + "</p></div>";
    const m = openModal({
      title: t("add.repTitle"),
      wide: true,
      body,
      buttons: [
        { label: t("btn.cancel"), kind: "ghost" },
        {
          label: t("btn.add"),
          kind: "primary",
          icon: "fa-arrow-rotate-left",
          onClick: (mm) => {
            const picks = [...mm.body.querySelectorAll('.cr-picker input[type="checkbox"]:checked')];
            if (!picks.length) {
              toast(t("links.needOne"), "warn");
              return false;
            }
            change(() => {
              picks.forEach((i) => {
                const id = "rep_" + i.value;
                G.extras[id] = { id, rosterId: i.value, name: i.dataset.name, from: i.dataset.group, source: "repeater" };
              });
            });
            toast(tn("add.repAdded", picks.length));
          },
        },
      ],
    });
    bindPickerSearch(m.body);
  }

  // ═══════════════════════════ PLANS & GROUP SETUP ═══════════════════════════
  function nextPlanName() {
    const names = new Set(G.plans.map((p) => p.name));
    for (let i = 0; i < 26; i++) {
      const n = t("plan.defaultName", { letter: groupLetter(i) });
      if (!names.has(n)) return n;
    }
    return t("plan.defaultName", { letter: G.plans.length + 1 });
  }

  function planMenu(anchor) {
    const pl = plan();
    showMenu(anchor, [
      {
        icon: "fa-plus",
        label: t("plan.new"),
        run: async () => {
          const name = await promptDialog({ title: t("plan.new"), label: t("plan.name"), value: nextPlanName() });
          if (!name) return;
          change(() => {
            const p = newPlan(name, pl.groups.length, pl.target);
            p.groups = pl.groups.map((g) => ({ id: uid("g"), name: g.name }));
            G.plans.push(p);
            G.activePlanId = p.id;
          });
        },
      },
      {
        icon: "fa-copy",
        label: t("plan.duplicate"),
        run: async () => {
          const name = await promptDialog({ title: t("plan.duplicate"), label: t("plan.name"), value: t("plan.copyOf", { name: pl.name }) });
          if (!name) return;
          change(() => {
            const p = JSON.parse(JSON.stringify(pl));
            p.id = uid("plan");
            p.name = name;
            p.finalizedAt = null;
            G.plans.push(p);
            G.activePlanId = p.id;
          });
        },
      },
      {
        icon: "fa-pen",
        label: t("plan.rename"),
        run: async () => {
          const name = await promptDialog({ title: t("plan.rename"), label: t("plan.name"), value: pl.name });
          if (!name) return;
          change(() => {
            plan().name = name;
          });
        },
      },
      { sep: true },
      {
        icon: "fa-trash",
        label: t("plan.delete"),
        danger: true,
        disabled: G.plans.length < 2,
        run: async () => {
          const ok = await confirmDialog({
            title: t("plan.delete"),
            message: t("plan.deleteMsg", { name: pl.name }),
            okLabel: t("btn.delete"),
            danger: true,
          });
          if (!ok) return;
          change(() => {
            G.plans = G.plans.filter((p) => p.id !== pl.id);
            G.activePlanId = G.plans[0].id;
          });
        },
      },
    ]);
  }

  async function setGroupCount(n) {
    const pl = plan();
    n = Math.max(1, Math.min(MAX_GROUPS, Math.round(Number(n) || 0)));
    if (n === pl.groups.length) {
      renderToolbar();
      return;
    }
    if (n < pl.groups.length) {
      const removed = pl.groups.slice(n);
      const count = removed.reduce((s, g) => s + ctx.members[g.id].length, 0);
      if (count) {
        const ok = await confirmDialog({
          title: t("groups.removeTitle"),
          message: tn("groups.removeMsg", count, { groups: removed.map((g) => g.name).join(", ") }),
          okLabel: t("btn.remove"),
          danger: true,
        });
        if (!ok) {
          renderToolbar();
          return;
        }
      }
      change(() => {
        const gone = new Set(removed.map((g) => g.id));
        pl.groups = pl.groups.slice(0, n);
        Object.keys(pl.assign).forEach((k) => {
          if (gone.has(pl.assign[k])) {
            delete pl.assign[k];
            delete pl.pinned[k];
          }
        });
      });
    } else {
      change(() => {
        pl.groups = makeGroups(n, pl.groups);
      });
    }
  }

  function validGroupName(name, gid) {
    const next = sel.level + 1;
    if (!/^\d+\s*[A-Z0-9]*$/.test(name)) return t("groups.badName", { n: next });
    const m = name.match(/^(\d+)/);
    if (Number(m[1]) !== next) return t("groups.badName", { n: next });
    if (plan().groups.some((g) => g.id !== gid && g.name === name)) return t("groups.dupName", { name });
    return null;
  }

  function renameGroup(gid, raw) {
    const name = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    const g = plan().groups.find((x) => x.id === gid);
    if (!g || name === g.name) {
      render();
      return;
    }
    const err = validGroupName(name, gid);
    if (err) {
      toast(err, "warn");
      render();
      return;
    }
    change(() => {
      g.name = name;
    });
  }

  // ═══════════════════════════ AUTO-BALANCE ═══════════════════════════
  // Cost = Σ groups Σ features w·(count − ideal)² + link penalties.
  // A greedy start is improved by simulated annealing (moves + swaps) over
  // several random restarts, so "Try again" gives a different valid option.
  function buildProblem(mode, mix) {
    const pl = plan();
    const gids = pl.groups.map((g) => g.id);
    const K = gids.length;
    const studs = ctx.students.filter((s) => s.status === "active");
    const N = studs.length;
    const index = new Map(studs.map((s, i) => [s.key, i]));
    const fIndex = new Map();
    const fW = [];
    const fNames = [];
    const fid = (name, w) => {
      if (!fIndex.has(name)) {
        fIndex.set(name, fW.length);
        fW.push(w);
        fNames.push(name);
      }
      return fIndex.get(name);
    };
    const feats = studs.map((st) => {
      const f = [fid("size", BALANCE_WEIGHTS.size)];
      CATEGORIES.forEach((c) => {
        const v = ratingOf(st, c.id);
        if (v) f.push(fid(c.id + ":" + v, BALANCE_WEIGHTS[c.id + ":" + v] || 1));
      });
      if (mix && st.from) f.push(fid("prev:" + st.from, BALANCE_WEIGHTS.prev));
      return f;
    });
    const F = fW.length;
    const totals = new Array(F).fill(0);
    feats.forEach((f) => f.forEach((x) => totals[x]++));
    const ideal = totals.map((n) => n / K);

    const apart = studs.map(() => []);
    const together = studs.map(() => []);
    (G.links || []).forEach((l) => {
      const ms = l.members.map((k) => index.get(k)).filter((i) => i != null);
      for (let a = 0; a < ms.length; a++)
        for (let b = a + 1; b < ms.length; b++) {
          const list = l.type === "apart" ? apart : together;
          list[ms[a]].push(ms[b]);
          list[ms[b]].push(ms[a]);
        }
    });

    const fixed = new Array(N).fill(-1);
    const movable = [];
    studs.forEach((st, i) => {
      const gi = gids.indexOf(st.loc);
      if (gi >= 0 && (st.pinned || mode === "unassigned")) fixed[i] = gi;
      else movable.push(i);
    });
    return { gids, K, studs, N, feats, F, fW, ideal, apart, together, fixed, movable };
  }

  function solveOnce(P) {
    const { K, N, feats, F, fW, ideal, apart, together, fixed, movable } = P;
    const L = BALANCE_WEIGHTS.link;
    const counts = [];
    for (let g = 0; g < K; g++) counts.push(new Float64Array(F));
    const where = fixed.slice();
    const add = (i, g) => {
      where[i] = g;
      feats[i].forEach((f) => counts[g][f]++);
    };
    const remove = (i) => {
      const g = where[i];
      feats[i].forEach((f) => counts[g][f]--);
      where[i] = -1;
    };
    // Δcost of putting unplaced i into g
    const addDelta = (i, g) => {
      let d = 0;
      const fs = feats[i];
      for (let k = 0; k < fs.length; k++) d += fW[fs[k]] * (2 * (counts[g][fs[k]] - ideal[fs[k]]) + 1);
      const ap = apart[i];
      for (let k = 0; k < ap.length; k++) if (where[ap[k]] === g) d += L;
      const tg = together[i];
      for (let k = 0; k < tg.length; k++) if (where[tg[k]] >= 0 && where[tg[k]] !== g) d += L;
      return d;
    };
    // Δcost of taking placed i out of its group
    const removeDelta = (i) => {
      const g = where[i];
      let d = 0;
      const fs = feats[i];
      for (let k = 0; k < fs.length; k++) d += fW[fs[k]] * (-2 * (counts[g][fs[k]] - ideal[fs[k]]) + 1);
      const ap = apart[i];
      for (let k = 0; k < ap.length; k++) if (where[ap[k]] === g) d -= L;
      const tg = together[i];
      for (let k = 0; k < tg.length; k++) if (where[tg[k]] >= 0 && where[tg[k]] !== g) d -= L;
      return d;
    };
    const moveTo = (i, g) => {
      const d1 = removeDelta(i);
      remove(i);
      const d2 = addDelta(i, g);
      add(i, g);
      return d1 + d2;
    };

    for (let i = 0; i < N; i++) if (fixed[i] >= 0) add(i, fixed[i]);
    // greedy start in random order, with a little noise for variety
    shuffle(movable.slice()).forEach((i) => {
      let best = 0;
      let bestD = Infinity;
      for (let g = 0; g < K; g++) {
        const d = addDelta(i, g) + Math.random() * 1.5;
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      add(i, best);
    });

    const cost = () => {
      let c = 0;
      for (let g = 0; g < K; g++) for (let f = 0; f < F; f++) c += fW[f] * Math.pow(counts[g][f] - ideal[f], 2);
      for (let i = 0; i < N; i++) {
        apart[i].forEach((j) => j > i && where[j] === where[i] && (c += L));
        together[i].forEach((j) => j > i && where[j] !== where[i] && (c += L));
      }
      return c;
    };

    const M = movable.length;
    if (K > 1 && M > 0) {
      const iters = Math.min(60000, 4000 + M * K * 150);
      const T0 = 4;
      const T1 = 0.02;
      for (let it = 0; it < iters; it++) {
        const temp = T0 * Math.pow(T1 / T0, it / iters);
        const i = movable[(Math.random() * M) | 0];
        const a = where[i];
        if (M < 2 || Math.random() < 0.45) {
          let b = (Math.random() * (K - 1)) | 0;
          if (b >= a) b++;
          const d = moveTo(i, b);
          if (d > 0 && Math.random() >= Math.exp(-d / temp)) moveTo(i, a);
        } else {
          const j = movable[(Math.random() * M) | 0];
          const b = where[j];
          if (b === a) continue;
          const d = moveTo(i, b) + moveTo(j, a);
          if (d > 0 && Math.random() >= Math.exp(-d / temp)) {
            moveTo(j, b);
            moveTo(i, a);
          }
        }
      }
    }
    return { where: where.slice(), cost: cost() };
  }

  function solve(P, avoidSignature) {
    let best = null;
    for (let r = 0; r < 5; r++) {
      const res = solveOnce(P);
      const sig = P.movable.map((i) => res.where[i]).join(",");
      if (sig === avoidSignature) continue;
      res.sig = sig;
      if (!best || res.cost < best.cost) best = res;
    }
    if (!best) {
      best = solveOnce(P);
      best.sig = P.movable.map((i) => best.where[i]).join(",");
    }
    return best;
  }

  // Score 0–100 with a short breakdown, for any placement key → groupId
  function scorePlacement(placeOf) {
    const pl = plan();
    const gids = pl.groups.map((g) => g.id);
    const studs = ctx.students.filter((s) => s.status === "active" && placeOf(s.key));
    const sizes = {};
    const counts = {};
    gids.forEach((g) => {
      sizes[g] = 0;
      counts[g] = {};
    });
    const totals = {};
    studs.forEach((st) => {
      const g = placeOf(st.key);
      sizes[g]++;
      CATEGORIES.forEach((c) => {
        const v = ratingOf(st, c.id);
        if (!v) return;
        const k = c.id + ":" + v;
        counts[g][k] = (counts[g][k] || 0) + 1;
        totals[k] = (totals[k] || 0) + 1;
      });
    });
    const spread = (arr) => (arr.length ? Math.max(...arr) - Math.min(...arr) : 0);
    const sizeArr = gids.map((g) => sizes[g]);
    const sizeSpread = spread(sizeArr);
    const boys = gids.map((g) => counts[g]["gender:boy"] || 0);
    const girls = gids.map((g) => counts[g]["gender:girl"] || 0);
    const sizeScore = Math.max(0, 100 - 30 * Math.max(0, sizeSpread - 1));
    const genderScore = Math.max(0, 100 - 15 * (Math.max(0, spread(boys) - 1) + Math.max(0, spread(girls) - 1)));
    let levelsTotal = 0;
    let levelsEven = 0;
    let pen = 0;
    Object.keys(totals).forEach((k) => {
      if (k.startsWith("gender:")) return;
      levelsTotal++;
      const s = spread(gids.map((g) => counts[g][k] || 0));
      if (s <= 1) levelsEven++;
      else pen += (s - 1) * (IMPORTANT_LEVELS.has(k) ? 14 : 7);
    });
    const spreadScore = Math.max(0, 100 - pen);
    const byKey = ctx.byKey;
    const links = evaluateLinks(placeOf, byKey);
    const linkScore = links.total ? (100 * links.honored) / links.total : 100;
    const overall = Math.round(0.2 * sizeScore + 0.2 * genderScore + 0.35 * spreadScore + 0.25 * linkScore);
    return {
      overall,
      sizeMin: Math.min(...sizeArr),
      sizeMax: Math.max(...sizeArr),
      boysMin: Math.min(...boys),
      boysMax: Math.max(...boys),
      girlsMin: Math.min(...girls),
      girlsMax: Math.max(...girls),
      levelsTotal,
      levelsEven,
      links,
    };
  }

  function openBalance() {
    const pl = plan();
    if (pl.groups.length < 1) return;
    const state = { mode: "all", mix: pl.mix !== false, result: null, lastSig: null };
    const hasUnassigned = ctx.students.some((s) => s.status === "active" && !ctx.groupIds.has(s.loc));
    if (!ctx.students.some((s) => s.status === "active")) {
      toast(t("bal.nothing"), "warn");
      return;
    }
    if (hasUnassigned && ctx.students.some((s) => ctx.groupIds.has(s.loc))) state.mode = "unassigned";

    const m = openModal({
      title: t("bal.title"),
      wide: true,
      className: "cr-balance-modal",
      body:
        '<div class="cr-bal-options"><fieldset class="cr-radio-row"><legend>' +
        esc(t("bal.modeLabel")) +
        '</legend><label><input type="radio" name="cr-bal-mode" value="unassigned"/> ' +
        esc(t("bal.modeUnassigned")) +
        '</label><label><input type="radio" name="cr-bal-mode" value="all"/> ' +
        esc(t("bal.modeAll")) +
        '</label></fieldset><label class="cr-check"><input type="checkbox" id="cr-bal-mix"/> ' +
        esc(t("bal.mix")) +
        '</label></div><div id="cr-bal-result" class="cr-bal-result"></div>',
      buttons: [],
    });
    m.body.querySelector('input[name="cr-bal-mode"][value="' + state.mode + '"]').checked = true;
    m.body.querySelector("#cr-bal-mix").checked = state.mix;

    const run = (fresh) => {
      const P = buildProblem(state.mode, state.mix);
      const out = m.body.querySelector("#cr-bal-result");
      if (!P.movable.length) {
        state.result = null;
        out.innerHTML = '<p class="cr-muted">' + esc(t(state.mode === "unassigned" ? "bal.noneUnassigned" : "bal.nonePinned")) + "</p>";
        setButtons();
        return;
      }
      const best = solve(P, fresh ? state.lastSig : null);
      state.lastSig = best.sig;
      const assign = {};
      P.movable.forEach((i) => (assign[P.studs[i].key] = P.gids[best.where[i]]));
      const placeMap = new Map();
      P.studs.forEach((st, i) => best.where[i] >= 0 && placeMap.set(st.key, P.gids[best.where[i]]));
      state.result = { assign, placeMap, movedCount: P.movable.length };
      out.innerHTML = previewHtml(placeMap, P);
      setButtons();
    };

    function setButtons() {
      m.setButtons([
        { label: t("bal.discard"), kind: "ghost" },
        { label: t("bal.tryAgain"), kind: "soft", icon: "fa-shuffle", disabled: !state.result, onClick: () => (run(true), false) },
        {
          label: t("bal.apply"),
          kind: "primary",
          icon: "fa-check",
          disabled: !state.result,
          onClick: () => {
            const res = state.result;
            change(() => {
              const p = plan();
              p.mix = state.mix;
              Object.keys(res.assign).forEach((k) => (p.assign[k] = res.assign[k]));
            });
            toast(t("bal.applied"));
          },
        },
      ]);
    }

    m.body.querySelectorAll('input[name="cr-bal-mode"]').forEach((r) =>
      r.addEventListener("change", () => {
        state.mode = r.value;
        state.lastSig = null;
        run(false);
      }),
    );
    m.body.querySelector("#cr-bal-mix").addEventListener("change", (e) => {
      state.mix = e.target.checked;
      state.lastSig = null;
      run(false);
    });
    m.body.querySelector("#cr-bal-result").innerHTML = '<p class="cr-muted"><i class="fa-solid fa-spinner fa-spin"></i> ' + esc(t("bal.working")) + "</p>";
    setButtons();
    setTimeout(() => run(false), 30);
  }

  function previewHtml(placeMap, P) {
    const placeOf = (k) => placeMap.get(k) || null;
    const sc = scorePlacement(placeOf);
    const pl = plan();
    const scoreClass = sc.overall >= 85 ? "is-good" : sc.overall >= 65 ? "is-ok" : "is-poor";
    let html =
      '<div class="cr-bal-score"><div class="cr-score ' +
      scoreClass +
      '"><b>' +
      sc.overall +
      "</b><span>/100</span></div><ul class=\"cr-bal-break\">" +
      "<li><i class=\"fa-solid fa-users\"></i> " +
      esc(t("bal.sizes", { min: sc.sizeMin, max: sc.sizeMax })) +
      "</li><li><i class=\"fa-solid fa-children\"></i> " +
      esc(t("bal.gender", { bmin: sc.boysMin, bmax: sc.boysMax, gmin: sc.girlsMin, gmax: sc.girlsMax })) +
      "</li><li><i class=\"fa-solid fa-layer-group\"></i> " +
      esc(t("bal.levels", { even: sc.levelsEven, total: sc.levelsTotal })) +
      "</li><li><i class=\"fa-solid fa-link\"></i> " +
      esc(sc.links.total ? t("bal.links", { ok: sc.links.honored, total: sc.links.total }) : t("bal.noLinks")) +
      "</li></ul></div>";
    if (sc.links.broken.length) {
      html +=
        '<div class="cr-bal-broken"><strong><i class="fa-solid fa-triangle-exclamation"></i> ' +
        esc(t("bal.unhonored")) +
        "</strong><ul>" +
        sc.links.broken
          .map(
            (b) =>
              "<li>" +
              esc(t(b.link.type === "apart" ? "links.apart" : "links.together")) +
              ": " +
              esc(namesOf(activeLinkMembers(b.link, ctx.byKey)).join(", ")) +
              (b.link.reason ? " (" + esc(b.link.reason) + ")" : "") +
              "</li>",
          )
          .join("") +
        "</ul></div>";
    }
    html += '<div class="cr-bal-cols">';
    pl.groups.forEach((g) => {
      const list = ctx.students.filter((s) => placeMap.get(s.key) === g.id).sort(byName);
      const st = groupStats(list);
      html +=
        '<div class="cr-bal-col"><div class="cr-bal-col-head"><b>' +
        esc(g.name) +
        "</b><span>" +
        list.length +
        "</span></div><div class=\"cr-bal-col-sum\">" +
        CAT.gender.levels.map((l) => pillHtml("gender", l, st.cats.gender[l.v], false)).join("") +
        pillHtml("behavior", CAT.behavior.levels[0], st.cats.behavior.lot, false) +
        pillHtml("influence", CAT.influence.levels[0], st.cats.influence.leader, false) +
        pillHtml("influence", CAT.influence.levels[2], st.cats.influence.offtask, false) +
        '</div><ol class="cr-bal-list">' +
        list
          .map((s) => {
            const v = ratingOf(s, ui.view);
            const d = levelDef(ui.view, v);
            const moved = s.loc !== g.id;
            return (
              '<li class="' +
              (moved ? "is-moved" : "") +
              '"><span class="cr-mini-dot' +
              (d ? "" : " is-none") +
              '"' +
              (d ? ' style="--dot:' + d.color + '"' : "") +
              ' data-tip="' +
              esc(catLabel(ui.view) + ": " + lvLabel(ui.view, v)) +
              '"></span>' +
              esc(s.name) +
              (s.pinned ? ' <i class="fa-solid fa-thumbtack" data-tip="' + esc(t("tip.unpin")) + '"></i>' : "") +
              (moved ? ' <small>' + esc(s.from ? t("card.from", { g: s.from }) : t("badge.new")) + "</small>" : "") +
              "</li>"
            );
          })
          .join("") +
        "</ol></div>";
    });
    html += "</div>";
    return html;
  }

  // ═══════════════════════════ FINALIZE ═══════════════════════════
  function openFinalize() {
    const pl = plan();
    const next = nextYearOf(sel.year);
    const nextLevel = sel.level + 1;
    for (const g of pl.groups) {
      const err = validGroupName(g.name, g.id);
      if (err) {
        toast(err, "warn");
        return;
      }
    }
    const nextExists = SchoolRoster.years().includes(next);
    const activeCount = (g) => (g ? g.students.filter((s) => s.status !== "withdrawn").length : 0);
    const clashes = nextExists
      ? pl.groups.filter((g) => activeCount(SchoolRoster.group(g.name, next)) > 0)
      : [];
    const others = nextExists
      ? SchoolRoster.groups(next).filter(
          (g) => g.level === nextLevel && !pl.groups.some((pg) => pg.name === g.id) && activeCount(g) > 0,
        )
      : [];
    const unplaced = ctx.students.filter((s) => s.status === "active" && !ctx.groupIds.has(s.loc));

    let body =
      '<p class="cr-modal-text">' +
      esc(t("fin.intro", { next, grade: gradeName(nextLevel), plan: pl.name })) +
      '</p><ul class="cr-fin-list">' +
      pl.groups
        .map((g) => {
          const n = ctx.members[g.id].length;
          return "<li><b>" + esc(g.name) + "</b> · " + n + " " + esc(tn("sum.students", n)) + "</li>";
        })
        .join("") +
      "</ul>";
    if (!nextExists) body += '<p class="cr-note-box"><i class="fa-solid fa-calendar-plus"></i> ' + esc(t("fin.createYear", { next })) + "</p>";
    if (clashes.length)
      body +=
        '<p class="cr-note-box is-danger"><i class="fa-solid fa-triangle-exclamation"></i> ' +
        esc(
          t("fin.clashes", {
            next,
            groups: clashes.map((g) => g.name + " (" + activeCount(SchoolRoster.group(g.name, next)) + ")").join(", "),
          }),
        ) +
        "</p>";
    if (others.length)
      body +=
        '<p class="cr-note-box"><i class="fa-solid fa-circle-info"></i> ' +
        esc(t("fin.others", { next, groups: others.map((g) => g.id + " (" + activeCount(g) + ")").join(", ") })) +
        "</p>";
    if (unplaced.length)
      body += '<p class="cr-note-box is-warn"><i class="fa-solid fa-user-clock"></i> ' + esc(tn("fin.unplaced", unplaced.length)) + "</p>";
    body += '<p class="cr-note-box is-private"><i class="fa-solid fa-lock"></i> ' + esc(t("fin.private")) + "</p>";

    openModal({
      title: t("fin.title"),
      body,
      buttons: [
        { label: t("btn.cancel"), kind: "ghost" },
        {
          label: clashes.length ? t("fin.replaceAndFinalize") : t("fin.finalize"),
          kind: clashes.length ? "danger" : "green",
          icon: "fa-flag-checkered",
          onClick: () => doFinalize(),
        },
      ],
    });
  }

  function doFinalize() {
    const pl = plan();
    const next = nextYearOf(sel.year);
    let skipped = 0;
    try {
      if (!SchoolRoster.years().includes(next)) {
        SchoolRoster.createYear(next);
        SchoolRoster.levels(sel.year).forEach((l) => SchoolRoster.setLevelName(l.level, l.name, next));
      }
      pl.groups.forEach((g) => {
        const existing = SchoolRoster.group(g.name, next);
        if (!existing) SchoolRoster.addGroup(g.name, next);
        else existing.students.slice().forEach((s) => SchoolRoster.deleteStudent(g.name, s.id, next));
        const names = ctx.members[g.id].map((s) => s.name);
        if (names.length) skipped += SchoolRoster.addStudents(g.name, names, next).skipped.length;
      });
    } catch (e) {
      console.error(e);
      toast(t("fin.error", { msg: e.message }), "error");
      return;
    }
    change(
      () => {
        plan().finalizedAt = Date.now();
      },
      { history: false },
    );
    toast(t("fin.done", { next, n: pl.groups.length }) + (skipped ? " " + tn("fin.skipped", skipped) : ""), "success");
  }

  // ═══════════════════════════ BACKUP ═══════════════════════════
  function downloadBackup() {
    const data = {
      type: "eslClassRedistributionBackup",
      version: 1,
      year: sel.year,
      level: sel.level,
      exportedAt: new Date().toISOString(),
      grade: G,
    };
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      fileSlug(t("file.base")) + "-backup-" + sel.year + "-" + fileSlug(gradeName(sel.level)) + ".json",
    );
    toast(t("backup.downloaded"));
  }

  async function loadBackup(file) {
    let data = null;
    try {
      data = JSON.parse(await file.text());
    } catch (e) {
      data = null;
    }
    if (!data || data.type !== "eslClassRedistributionBackup" || !data.grade || !Array.isArray(data.grade.plans)) {
      toast(t("backup.invalid"), "error");
      return;
    }
    const year = String(data.year);
    const level = Number(data.level);
    const when = Date.parse(data.exportedAt) || Date.now();
    const ok = await confirmDialog({
      title: t("backup.loadTitle"),
      message: t("backup.loadMsg", { scope: year + " · " + gradeName(level), date: fmtDate(when) }),
      okLabel: t("backup.replace"),
      danger: true,
    });
    if (!ok) return;
    const g = data.grade;
    g.profiles = g.profiles || {};
    g.extras = g.extras || {};
    g.links = g.links || [];
    store.grades[year + ":" + level] = g;
    saveStore(true);
    if (SchoolRoster.years().includes(year) && availableLevels(year).includes(level)) {
      selectGrade(year, level);
      toast(t("backup.loaded"), "success");
    } else toast(t("backup.loadedHidden", { scope: year + " · " + gradeName(level) }), "warn");
  }

  // ═══════════════════════════ EXPORT: shared ═══════════════════════════
  const EXPORT_CATS = ["gender", "behavior", "academic", "influence", "family"];

  function statusText(st) {
    if (st.source === "new") return t("badge.new");
    if (st.source === "repeater") return t("xl.repeaterFrom", { g: st.from });
    return "";
  }

  function linkNames(key, type) {
    return (G.links || [])
      .filter((l) => l.type === type && l.members.includes(key))
      .map(
        (l) =>
          namesOf(l.members.filter((k) => k !== key && ctx.byKey.has(k))).join(", ") + (l.reason ? " (" + l.reason + ")" : ""),
      )
      .join("; ");
  }

  function exportRating(st, cat, short) {
    const v = ratingOf(st, cat);
    const d = levelDef(cat, v);
    const guessed = cat === "gender" && genderInfo(st).guessed;
    return { text: d ? lvLabel(cat, v, short) + (guessed ? " (?)" : "") : t("notRated"), color: d ? d.color : null };
  }

  // ═══════════════════════════ EXPORT: Excel ═══════════════════════════
  function argb(hex) {
    return "FF" + hex.replace("#", "").toUpperCase();
  }

  function sheetName(raw, used) {
    let base = String(raw).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Sheet";
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) name = base.slice(0, 28) + " " + i++;
    used.add(name.toLowerCase());
    return name;
  }

  async function exportExcel() {
    let ExcelJS;
    try {
      toast(t("export.preparing"));
      ExcelJS = await loadScript(EXCELJS_URL, () => window.ExcelJS);
    } catch (e) {
      toast(t("export.libFailed"), "error");
      return;
    }
    ctx = computeContext();
    const pl = plan();
    const wb = new ExcelJS.Workbook();
    wb.creator = "ESL Learning Platform";
    wb.created = new Date();
    const used = new Set();
    const thin = { style: "thin", color: { argb: "FFD0D0D0" } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    const headerBlock = (ws, title, ncols) => {
      const r1 = ws.addRow([title]);
      r1.font = { bold: true, size: 14 };
      ws.mergeCells(r1.number, 1, r1.number, ncols);
      const r2 = ws.addRow([t("export.confidential")]);
      r2.font = { bold: true, size: 11, color: { argb: "FFC62828" } };
      ws.mergeCells(r2.number, 1, r2.number, ncols);
      const r3 = ws.addRow([scopeText() + " · " + t("tb.plan") + ": " + pl.name + " · " + fmtDate(Date.now())]);
      r3.font = { italic: true, color: { argb: "FF555555" } };
      ws.mergeCells(r3.number, 1, r3.number, ncols);
      ws.addRow([]);
    };

    const studentCols = (withGroup) =>
      [
        { h: "#", w: 5 },
        { h: t("xl.name"), w: 38 },
        withGroup ? { h: t("xl.newGroup"), w: 12 } : null,
        { h: t("xl.from"), w: 13 },
        { h: t("xl.status"), w: 16 },
      ]
        .filter(Boolean)
        .concat(EXPORT_CATS.map((c) => ({ h: catLabel(c), w: 24, cat: c })))
        .concat([
          { h: t("links.apart"), w: 32 },
          { h: t("links.together"), w: 32 },
          { h: t("xl.warnings"), w: 40 },
          { h: t("profile.note"), w: 44 },
        ]);

    const styleHeader = (row) => {
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.alignment = { vertical: "middle", wrapText: true };
      row.height = 22;
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3D348B" } };
        c.border = border;
      });
    };

    const addStudentRows = (ws, cols, list, withGroup) => {
      list.forEach((st, i) => {
        const vals = [i + 1, st.name];
        if (withGroup) vals.push(ctx.groupIds.has(st.loc) ? groupName(st.loc) : locLabel(st));
        vals.push(st.from || "", statusText(st));
        const ratings = EXPORT_CATS.map((c) => exportRating(st, c));
        ratings.forEach((r) => vals.push(r.text));
        const warns = (ctx.links.perStudent.get(st.key) || []).map((w) => warnText(w).replace(/\n/g, " ")).join(" | ");
        vals.push(linkNames(st.key, "apart"), linkNames(st.key, "together"), warns, (G.profiles[st.key] || {}).note || "");
        const row = ws.addRow(vals);
        row.alignment = { vertical: "top", wrapText: true };
        row.eachCell({ includeEmpty: true }, (c) => (c.border = border));
        const first = cols.findIndex((c) => c.cat) + 1;
        ratings.forEach((r, k) => {
          const cell = row.getCell(first + k);
          if (r.color) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(r.color) } };
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          } else cell.font = { color: { argb: "FF888888" } };
        });
        if (warns) row.getCell(cols.length - 1).font = { color: { argb: "FFC62828" }, bold: true };
      });
    };

    // one sheet per new group
    pl.groups.forEach((g) => {
      const cols = studentCols(false);
      const ws = wb.addWorksheet(sheetName(g.name, used), {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });
      cols.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));
      headerBlock(ws, t("xl.groupTitle", { g: g.name }), cols.length);
      const hr = ws.addRow(cols.map((c) => c.h));
      styleHeader(hr);
      ws.views = [{ state: "frozen", ySplit: hr.number, xSplit: 2 }];
      addStudentRows(ws, cols, ctx.members[g.id], false);
      ws.addRow([]);
      const s = ctx.stats[g.id];
      const sumRows = [
        [t("xl.summary")],
        [tn("sum.students", s.total), s.total],
        [lvLabel("gender", "boy"), s.cats.gender.boy],
        [lvLabel("gender", "girl"), s.cats.gender.girl],
        [t("gender.notSet"), s.cats.gender.none],
      ];
      CATEGORIES.filter((c) => c.id !== "gender").forEach((c) =>
        c.levels.forEach((l) => sumRows.push([catLabel(c.id) + ": " + lvLabel(c.id, l.v), s.cats[c.id][l.v]])),
      );
      sumRows.push([t("sum.newLabel"), s.newCount], [t("sum.brokenLabel"), ctx.links.perGroup[g.id] || 0]);
      ctx.flags[g.id].forEach((f) => sumRows.push(["⚠ " + flagText(f)]));
      sumRows.forEach((r, i) => {
        const row = ws.addRow(["", ...r]);
        if (i === 0) row.font = { bold: true, size: 12 };
      });
    });

    // Summary sheet
    {
      const ws = wb.addWorksheet(sheetName(t("xl.summarySheet"), used), {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });
      const lead = [t("xl.group"), t("xl.students"), t("tb.target"), lvLabel("gender", "boy"), lvLabel("gender", "girl"), t("gender.notSet"), t("gender.unconfirmed")];
      const catCols = [];
      CATEGORIES.filter((c) => c.id !== "gender").forEach((c) => {
        c.levels.forEach((l) => catCols.push({ cat: c.id, v: l.v, color: l.color }));
        catCols.push({ cat: c.id, v: null });
      });
      const tail = [t("sum.newLabel"), t("badge.repeater"), t("sum.brokenLabel"), t("xl.flags")];
      const ncols = lead.length + catCols.length + tail.length;
      headerBlock(ws, t("xl.summaryTitle"), ncols);
      const h1 = ws.addRow(lead.map(() => "").concat(catCols.map((c) => catLabel(c.cat))).concat(tail.map(() => "")));
      const h2 = ws.addRow(lead.concat(catCols.map((c) => lvLabel(c.cat, c.v))).concat(tail));
      styleHeader(h1);
      styleHeader(h2);
      // merge category titles
      let col = lead.length + 1;
      CATEGORIES.filter((c) => c.id !== "gender").forEach((c) => {
        const span = c.levels.length + 1;
        ws.mergeCells(h1.number, col, h1.number, col + span - 1);
        h1.getCell(col).alignment = { horizontal: "center" };
        col += span;
      });
      lead.forEach((_, i) => ws.mergeCells(h1.number, i + 1, h2.number, i + 1));
      tail.forEach((_, i) => ws.mergeCells(h1.number, lead.length + catCols.length + i + 1, h2.number, lead.length + catCols.length + i + 1));
      catCols.forEach((c, i) => {
        if (c.color) h2.getCell(lead.length + i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(c.color) } };
      });
      h2.height = 34;
      pl.groups.forEach((g) => {
        const s = ctx.stats[g.id];
        const row = ws.addRow(
          [g.name, s.total, pl.target || "", s.cats.gender.boy, s.cats.gender.girl, s.cats.gender.none, s.guessed]
            .concat(catCols.map((c) => s.cats[c.cat][c.v || "none"]))
            .concat([s.newCount, s.repeaterCount, ctx.links.perGroup[g.id] || 0, ctx.flags[g.id].map(flagText).join("; ")]),
        );
        row.eachCell({ includeEmpty: true }, (c) => (c.border = border));
        row.getCell(1).font = { bold: true };
        row.alignment = { vertical: "top", wrapText: true };
      });
      ws.getColumn(1).width = 12;
      for (let i = 2; i < ncols; i++) ws.getColumn(i).width = 11;
      ws.getColumn(ncols).width = 50;
      ws.addRow([]);
      const notPlaced = ctx.students.filter((s) => s.status === "active" && !ctx.groupIds.has(s.loc));
      ws.addRow([t("loc.notPlaced"), notPlaced.length, notPlaced.map((s) => s.name).join(", ")]);
      ws.addRow([t("zone.notReturning"), ctx.notReturning.length, ctx.notReturning.map((s) => s.name).join(", ")]);
      ws.addRow([t("zone.repeating", { grade: gradeName(sel.level) }), ctx.repeating.length, ctx.repeating.map((s) => s.name).join(", ")]);
      ws.addRow([t("xl.linksTotal"), ctx.links.total, t("bal.links", { ok: ctx.links.honored, total: ctx.links.total })]);
      ws.views = [{ state: "frozen", ySplit: h2.number, xSplit: 1 }];
    }

    // All students sheet
    {
      const cols = studentCols(true);
      const ws = wb.addWorksheet(sheetName(t("xl.allSheet"), used), {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });
      cols.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));
      headerBlock(ws, t("xl.allTitle"), cols.length);
      const hr = ws.addRow(cols.map((c) => c.h));
      styleHeader(hr);
      const list = ctx.students.filter((s) => s.status === "active").concat(ctx.notReturning, ctx.repeating);
      addStudentRows(ws, cols, list, true);
      ws.autoFilter = { from: { row: hr.number, column: 1 }, to: { row: hr.number + list.length, column: cols.length } };
      ws.views = [{ state: "frozen", ySplit: hr.number, xSplit: 2 }];
    }

    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      fileBase() + ".xlsx",
    );
    toast(t("export.done"), "success");
  }

  // ═══════════════════════════ EXPORT: PDF ═══════════════════════════
  function hexRgb(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // Standard PDF fonts only cover Latin-1: replace anything else
  function pdfText(s) {
    return String(s == null ? "" : s)
      .replace(/→/g, ">")
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/⚠\s?/g, "! ")
      .replace(/[^\u0000-ÿ]/g, "");
  }

  function fitText(doc, text, maxW) {
    let s = pdfText(text);
    if (doc.getTextWidth(s) <= maxW) return s;
    while (s.length > 1 && doc.getTextWidth(s + ".") > maxW) s = s.slice(0, -1);
    return s + ".";
  }

  async function exportPdf() {
    try {
      toast(t("export.preparing"));
      await loadScript(JSPDF_URL, () => window.jspdf && window.jspdf.jsPDF);
    } catch (e) {
      toast(t("export.libFailed"), "error");
      return;
    }
    ctx = computeContext();
    const pl = plan();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
    const W = 215.9;
    const H = 279.4;
    const M = 10;
    const rowH = 5.6;
    const cols = [
      { k: "num", w: 8, h: "#" },
      { k: "name", w: 63, h: t("xl.name") },
      { k: "from", w: 13, h: t("pdf.from") },
      { k: "gender", w: 18, h: catLabel("gender"), cat: true },
      { k: "behavior", w: 24, h: t("catShort.behavior"), cat: true },
      { k: "academic", w: 24, h: t("catShort.academic"), cat: true },
      { k: "influence", w: 24, h: t("catShort.influence"), cat: true },
      { k: "family", w: 21.9, h: t("catShort.family"), cat: true },
    ];

    const header = (g, cont) => {
      doc.setFillColor(61, 52, 139);
      doc.rect(0, 0, W, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(pdfText(t("xl.groupTitle", { g: g.name }) + (cont ? " " + t("pdf.cont") : "")), M, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(pdfText(scopeText(">") + " · " + t("tb.plan") + ": " + pl.name), M, 18);
      // confidential stamp
      doc.setFillColor(198, 40, 40);
      const label = pdfText(t("export.confidential").toUpperCase());
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const lw = doc.getTextWidth(label) + 6;
      doc.roundedRect(W - M - lw, 7, lw, 7, 1.5, 1.5, "F");
      doc.text(label, W - M - lw + 3, 11.9);
      doc.setTextColor(0, 0, 0);
      return 30;
    };

    const tableHead = (y) => {
      doc.setFillColor(230, 228, 245);
      doc.rect(M, y, W - 2 * M, 6.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 60);
      let x = M;
      cols.forEach((c) => {
        doc.text(fitText(doc, c.h, c.w - 2), x + 1.2, y + 4.4);
        x += c.w;
      });
      return y + 6.5;
    };

    const drawRow = (st, i, y) => {
      if (i % 2) {
        doc.setFillColor(247, 247, 250);
        doc.rect(M, y, W - 2 * M, rowH, "F");
      }
      let x = M;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      cols.forEach((c) => {
        if (c.k === "num") doc.text(String(i + 1), x + 1.2, y + 3.9);
        else if (c.k === "name") {
          let name = st.name;
          if (st.source === "new") name += " *";
          if (st.source === "repeater") name += " (R)";
          doc.text(fitText(doc, name, c.w - 2.4), x + 1.2, y + 3.9);
        } else if (c.k === "from") doc.text(fitText(doc, st.from || "", c.w - 2), x + 1.2, y + 3.9);
        else {
          const r = exportRating(st, c.k, true);
          if (r.color) {
            const [rr, gg, bb] = hexRgb(r.color);
            doc.setFillColor(rr, gg, bb);
            doc.roundedRect(x + 0.6, y + 0.6, c.w - 1.2, rowH - 1.2, 1, 1, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.6);
            doc.text(fitText(doc, r.text, c.w - 2.6), x + 1.6, y + 3.8);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(30, 30, 30);
          } else {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(6.6);
            doc.text(fitText(doc, t("notRatedShort"), c.w - 2.6), x + 1.6, y + 3.8);
            doc.setFontSize(8);
            doc.setTextColor(30, 30, 30);
          }
        }
        x += c.w;
      });
      // warning marker for broken links
      if ((ctx.links.perStudent.get(st.key) || []).length) {
        doc.setTextColor(198, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text("!", M + cols[0].w + cols[1].w - 2.2, y + 3.9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
      }
      doc.setDrawColor(225, 225, 230);
      doc.line(M, y + rowH, W - M, y + rowH);
    };

    const drawSummary = (g, y) => {
      const s = ctx.stats[g.id];
      doc.setDrawColor(61, 52, 139);
      doc.setLineWidth(0.3);
      const top = y;
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(61, 52, 139);
      doc.text(pdfText(t("xl.summary")), M + 3, y);
      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      const line1 =
        tn("sum.students", s.total) + ": " + s.total + (pl.target ? " / " + pl.target : "") + "   ·   " +
        lvLabel("gender", "boy") + ": " + s.cats.gender.boy + "   ·   " + lvLabel("gender", "girl") + ": " + s.cats.gender.girl +
        (s.cats.gender.none ? "   ·   " + t("gender.notSet") + ": " + s.cats.gender.none : "") +
        "   ·   " + t("sum.newLabel") + ": " + s.newCount +
        "   ·   " + t("sum.brokenLabel") + ": " + (ctx.links.perGroup[g.id] || 0);
      doc.text(fitText(doc, line1, W - 2 * M - 6), M + 3, y);
      y += 5.5;
      CATEGORIES.filter((c) => c.id !== "gender").forEach((c) => {
        doc.setFont("helvetica", "bold");
        doc.text(fitText(doc, t("catShort." + c.id) + ":", 42), M + 3, y);
        doc.setFont("helvetica", "normal");
        let x = M + 48;
        c.levels.forEach((l) => {
          const [rr, gg, bb] = hexRgb(l.color);
          doc.setFillColor(rr, gg, bb);
          doc.rect(x, y - 2.6, 3, 3, "F");
          const txt = pdfText(lvLabel(c.id, l.v, true) + ": " + s.cats[c.id][l.v]);
          doc.text(txt, x + 4, y);
          x += doc.getTextWidth(txt) + 9;
        });
        if (s.cats[c.id].none) doc.text(pdfText(t("notRated") + ": " + s.cats[c.id].none), x, y);
        y += 5;
      });
      const flags = ctx.flags[g.id];
      if (flags.length) {
        doc.setTextColor(198, 40, 40);
        flags.forEach((f) => {
          doc.text(fitText(doc, "! " + flagText(f), W - 2 * M - 6), M + 3, y);
          y += 4.5;
        });
        doc.setTextColor(30, 30, 30);
      }
      const broken = ctx.links.broken.filter((b) => b.groups.includes(g.id));
      broken.forEach((b) => {
        doc.setTextColor(198, 40, 40);
        const txt =
          "! " + t(b.link.type === "apart" ? "links.apart" : "links.together") + ": " +
          namesOf(activeLinkMembers(b.link, ctx.byKey)).join(", ");
        doc.text(fitText(doc, txt, W - 2 * M - 6), M + 3, y);
        y += 4.5;
        doc.setTextColor(30, 30, 30);
      });
      y += 1.5;
      doc.roundedRect(M, top, W - 2 * M, y - top, 2, 2, "S");
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      doc.text(pdfText(t("pdf.legend")), M, y + 5);
      return y + 8;
    };

    const summaryHeight = (g) => 6 + 6 + 5.5 + 4 * 5 + ctx.flags[g.id].length * 4.5 +
      ctx.links.broken.filter((b) => b.groups.includes(g.id)).length * 4.5 + 10;

    pl.groups.forEach((g, gi) => {
      if (gi > 0) doc.addPage();
      let y = header(g, false);
      y = tableHead(y);
      const list = ctx.members[g.id];
      list.forEach((st, i) => {
        if (y + rowH > H - 16) {
          doc.addPage();
          y = tableHead(header(g, true));
        }
        drawRow(st, i, y);
        y += rowH;
      });
      if (!list.length) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(pdfText(t("col.empty")), M + 2, y + 6);
        y += 10;
      }
      if (y + 4 + summaryHeight(g) > H - 14) {
        doc.addPage();
        y = header(g, true);
      }
      drawSummary(g, y + 4);
    });

    const pages = doc.getNumberOfPages();
    const stamp = fmtDate(Date.now());
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(198, 40, 40);
      doc.text(pdfText(t("pdf.footer")), M, H - 7);
      doc.setTextColor(110, 110, 110);
      const right = pdfText(stamp + "  ·  " + t("pdf.page", { p, n: pages }));
      doc.text(right, W - M - doc.getTextWidth(right), H - 7);
    }
    doc.save(fileBase() + ".pdf");
    toast(t("export.done"), "success");
  }

  // ═══════════════════════════ EVENTS ═══════════════════════════
  function cardKeyOf(el) {
    const card = el.closest(".cr-card[data-key]");
    return card ? card.dataset.key : null;
  }

  function handleAct(el, e) {
    const act = el.dataset.act;
    const key = cardKeyOf(el);
    switch (act) {
      case "chip":
        if (key) cycleChip(key);
        break;
      case "pin": {
        const st = ctx.byKey.get(key);
        if (st) setPinned([key], !st.pinned);
        break;
      }
      case "menu": {
        const st = ctx.byKey.get(key);
        if (!st) break;
        const keys = selected.has(key) && selected.size > 1 ? [...selected] : [key];
        showMenu(el, moveMenuItems(keys), keys.length > 1 ? tn("sel.count", keys.length) : st.name);
        break;
      }
      case "warn":
        showTip(el);
        clearTimeout(tipTimer);
        tipTimer = setTimeout(hideTip, 3500);
        break;
      case "collapse": {
        const id = sel.key + ":" + el.dataset.cid;
        if (ui.collapsed[id]) delete ui.collapsed[id];
        else ui.collapsed[id] = true;
        saveUi();
        renderLeft();
        break;
      }
      case "add-new":
        openAddNew();
        break;
      case "add-repeater":
        openAddRepeater();
        break;
      case "sel-move":
        if (selected.size) showMenu(el, moveMenuItems([...selected]), tn("sel.count", selected.size));
        break;
      case "sel-pin":
        setPinned([...selected], true);
        break;
      case "sel-unpin":
        setPinned([...selected], false);
        break;
      case "sel-clear":
        selected.clear();
        selectMode = false;
        render();
        break;
      case "close-profile":
        closeProfile();
        break;
      case "profile-pin": {
        const st = ctx.byKey.get(openProfileKey);
        if (st) setPinned([st.key], !st.pinned);
        break;
      }
      case "profile-move":
        if (openProfileKey) showMenu(el, moveMenuItems([openProfileKey]));
        break;
      case "rate": {
        const k = openProfileKey;
        const cat = el.dataset.cat;
        const val = el.dataset.val;
        if (!k) break;
        change(() => {
          const p = prof(k);
          if (cat === "gender") p.gender = val || null;
          else if (val) p[cat] = val;
          else delete p[cat];
        });
        break;
      }
      case "link-add":
        if (openProfileKey) openLinkModal(el.dataset.type, openProfileKey);
        break;
      case "link-edit": {
        const l = G.links.find((x) => x.id === el.dataset.link);
        if (l) openLinkModal(l.type, el.closest("#cr-drawer") ? openProfileKey : null, l);
        break;
      }
      case "link-remove":
        removeLink(el.dataset.link);
        break;
      case "status":
        if (openProfileKey) setStatus(openProfileKey, el.dataset.val);
        break;
      case "extra-remove":
        if (openProfileKey) removeExtra(openProfileKey);
        break;
      default:
        break;
    }
    if (e) e.stopPropagation();
  }

  function bindEvents() {
    document.addEventListener("click", (e) => {
      // Click outside the student panel closes it. Cards (open another
      // student), dialogs, menus and the end of a drag don't count.
      if (
        openProfileKey &&
        Date.now() >= suppressClickUntil &&
        !e.target.closest("#cr-drawer, .cr-card, .cr-modal-backdrop, #cr-menu, #cr-selbar, .dark-mode-toggle")
      ) {
        closeProfile();
      }
      const card = e.target.closest(".cr-card");
      if (card && Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const act = e.target.closest("[data-act]");
      if (act && !act.disabled) {
        handleAct(act, e);
        return;
      }
      if (card && !card.classList.contains("cr-ghost") && card.dataset.key) {
        const key = card.dataset.key;
        if (selectMode || e.ctrlKey || e.metaKey || e.shiftKey) toggleSelect(key);
        else openProfile(key);
      }
    });

    document.querySelectorAll(".cr-lang-btn").forEach((b) =>
      b.addEventListener("click", () => {
        lang = b.dataset.lang === "es" ? "es" : "en";
        writeLS(LANG_KEY, lang);
        applyStaticI18n();
        render();
      }),
    );

    $("cr-year").addEventListener("change", (e) => {
      const year = e.target.value;
      const levels = availableLevels(year);
      if (!levels.length) {
        flushSave();
        sel = { year, level: null, key: null };
        ui.year = year;
        saveUi();
        renderEmpty();
        return;
      }
      selectGrade(year, levels.includes(sel.level) ? sel.level : levels[0]);
    });
    $("cr-level").addEventListener("change", (e) => selectGrade(sel.year, Number(e.target.value)));
    $("cr-plan").addEventListener("change", (e) => {
      G.activePlanId = e.target.value;
      selected.clear();
      saveStore();
      render();
    });
    $("cr-plan-menu").addEventListener("click", (e) => {
      e.stopPropagation();
      planMenu(e.currentTarget);
    });
    $("cr-group-count").addEventListener("change", (e) => setGroupCount(e.target.value));
    $("cr-target").addEventListener("change", (e) => {
      const v = Math.round(Number(e.target.value));
      change(() => {
        plan().target = v > 0 ? v : null;
      });
    });
    $("cr-undo").addEventListener("click", undo);
    $("cr-redo").addEventListener("click", redo);
    $("cr-links-btn").addEventListener("click", openLinksOverview);
    $("cr-balance").addEventListener("click", openBalance);
    $("cr-finalize").addEventListener("click", openFinalize);
    $("cr-export").addEventListener("click", (e) => {
      e.stopPropagation();
      showMenu(e.currentTarget, [
        { icon: "fa-file-excel", label: t("export.excel"), run: exportExcel },
        { icon: "fa-file-pdf", label: t("export.pdf"), run: exportPdf },
      ]);
    });
    $("cr-backup").addEventListener("click", (e) => {
      e.stopPropagation();
      showMenu(e.currentTarget, [
        { icon: "fa-download", label: t("backup.download"), run: downloadBackup },
        { icon: "fa-upload", label: t("backup.load"), run: () => $("cr-backup-file").click() },
      ]);
    });
    $("cr-backup-file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) loadBackup(f);
    });
    $("cr-views").addEventListener("click", (e) => {
      const b = e.target.closest(".cr-view-tab");
      if (!b) return;
      ui.view = b.dataset.view;
      ui.filter = "";
      saveUi();
      render();
    });
    $("cr-filter").addEventListener("change", (e) => {
      ui.filter = e.target.value;
      saveUi();
      render();
    });
    $("cr-select-mode").addEventListener("click", () => {
      selectMode = !selectMode;
      if (!selectMode) selected.clear();
      render();
    });
    $("cr-groups").addEventListener("change", (e) => {
      const input = e.target.closest(".cr-col-name");
      if (input) renameGroup(input.dataset.gid, input.value);
    });
    $("cr-groups").addEventListener("keydown", (e) => {
      if (e.target.classList.contains("cr-col-name") && e.key === "Enter") e.target.blur();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$("cr-menu").hidden) closeMenu();
        else if (modalStack.length) modalStack[modalStack.length - 1].close();
        else if (openProfileKey) closeProfile();
        else if (selected.size || selectMode) {
          selected.clear();
          selectMode = false;
          render();
        }
        return;
      }
      if (modalStack.length || e.target.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    });

    window.addEventListener("pagehide", flushSave);
    window.addEventListener("beforeunload", flushSave);

    // School Setup edited in another tab
    SchoolRoster.onChange(() => {
      if (!sel.key) return init(true);
      if (!SchoolRoster.years().includes(sel.year)) return init(true);
      render();
    });
  }

  // ═══════════════════════════ INIT ═══════════════════════════
  function init(reselect) {
    const years = SchoolRoster.years();
    const year = ui.year && years.includes(ui.year) ? ui.year : SchoolRoster.activeYear();
    const levels = availableLevels(year);
    if (!levels.length) {
      sel = { year: years.includes(year) ? year : null, level: null, key: null };
      renderEmpty();
      return;
    }
    const level = levels.includes(Number(ui.level)) ? Number(ui.level) : levels[0];
    if (reselect && sel.key === year + ":" + level) {
      render();
      return;
    }
    selectGrade(year, level);
  }

  function start() {
    if (!window.SchoolRoster) {
      document.body.innerHTML = "<p style='padding:24px'>School roster (js/school-roster.js) is missing.</p>";
      return;
    }
    applyStaticI18n();
    bindDrag();
    bindTips();
    bindMenu();
    bindEvents();
    init(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
