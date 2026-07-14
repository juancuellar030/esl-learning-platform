# Cursor Prompt: PC Assignment Viewer tool

Paste everything below into Cursor with the repo open (the one deployed at
`https://juancuellar030.github.io/esl-learning-platform/`).

---

## Context

This is a static GitHub Pages site (plain HTML/CSS/JS, no build step). Every
tool is a standalone `.html` file linked from `tools.html`, sharing a common
header ("ESL Learning Platform" title, tool subtitle, "Back to Tools" link)
and footer ("ESL Learning Platform © 2025 | Made for Teachers, by Teachers").

Before writing any code, open 2–3 existing tool files (e.g.
`classroom-distribution.html`, `student-material-tracker.html`) and copy
their exact header/footer markup, CSS variable names, color palette, and
overall file structure so the new tool is visually indistinguishable from
the rest of the site. Do not invent a new visual style.

## Goal

Build a new tool, **"PC Assignment Viewer"**, that shows which computer
(PC) each student is assigned to in the IT room, for a given class group and
term. It needs three interchangeable view modes and a cross-group search.

Create it as `pc-assignment-viewer.html` and add a card for it on
`tools.html` in the same style as the other tool cards, with a short
description like "View and search student PC assignments by term, group,
and layout."

## Step 1 — Build the data file first

There is an uploaded file `students_pc_list_third_term.md` containing one
markdown table per class group (3A, 3B, 3C, 4A, 4B, 4C, 5A, 5B, 5C, 5D),
each with `STUDENT'S NAME` and `PC` columns.

Parse that file and generate a static data file, e.g. `pc-data.js`, shaped
like this:

```js
const PC_ASSIGNMENTS = {
  term1: null, // no data yet
  term2: null, // no data yet
  term3: {
    "3A": [
      { name: "ANDRADE RODRIGUEZ SILVANA", pc: 4 },
      { name: "BUITRAGO MÉNDEZ JUAN ANDRÉS", pc: 14 },
      // ...
    ],
    "3B": [ /* ... */ ],
    "3C": [ /* ... */ ],
    "4A": [ /* ... */ ],
    "4B": [ /* ... */ ],
    "4C": [ /* ... */ ],
    "5A": [ /* ... */ ],
    "5B": [ /* ... */ ],
    "5C": [ /* ... */ ],
    "5D": [ /* ... */ ],
  },
  term4: null, // to be added later
};
```

Parsing rules:
- Strip all `**` markdown bold markers from names. No student should render
  in bold, ever — the source file bolds some names but that is not
  meaningful and must not carry through to the UI.
- Preserve accented characters and names exactly as written.
- If the PC cell is empty (this happens for one student in 3C and for
  **every** student in 5C and 5D), set `pc: null`. Do not invent a number,
  do not drop the student, do not default to 0.
- Keep the room's total capacity in mind: this school's IT room has 30
  physical desks (see Step 4). Some groups only use up to PC 26, 28, or 29
  — that's expected, not a bug.

## Step 2 — Header controls

Add three dropdowns and a search input in the tool's header/control bar:

1. **Term** — options: Term 1, Term 2, Term 3, Term 4.
   - Term 3 is selected by default and is the only one with data right now.
   - Term 1, Term 2, and Term 4 should appear in the dropdown but show a
     clear inline message ("No PC assignment data available for this term
     yet") instead of a table/diagram when selected. Do not disable them in
     the dropdown — a teacher should be able to see they exist and will be
     populated later.

2. **Group** — options: 3A, 3B, 3C, 4A, 4B, 4C, 5A, 5B, 5C, 5D.
   - Default to 3A.
   - If the selected group/term has students but zero PC assignments
     (5C, 5D in term 3), still render the view but show every student as
     unassigned rather than showing an empty page — see Step 3.

3. **View mode** — options: "Single Table", "Split Table (3 columns)",
   "Room Diagram".

4. **Search** — a text input (with a button or live-filter as the user
   types, your choice) that searches **by student name across the entire
   selected term, across all groups** — not just the currently selected
   group. On match, show the student's full name, their group, and their
   assigned PC (or "Not assigned" if `pc` is null). This is intentionally
   global-by-term so a teacher can find a student without already knowing
   their class.

## Step 3 — View 1: Single Table

A two-column table, header row `PC | Student's Name`, matching the visual
style of the reference screenshots (dark header row, bordered cells).

- Sort ascending by PC number.
- Students with `pc: null` go in a separate section below the main table,
  under a subheading like "PC not yet assigned", listed alphabetically.
  Do not merge them into the numeric sort (there is no PC to sort them by).

## Step 4 — View 2: Split Table (3 columns)

Same data as View 1, same sort order, but split into three side-by-side
tables of up to 10 rows each (rows 1–10, 11–20, 21–30), matching the second
reference screenshot's layout exactly. If a group has fewer than 30
assigned students, later sub-tables simply have fewer rows or are omitted
if empty. Unassigned students still get their own section below all three
tables, same as View 1.

## Step 5 — View 3: Room Diagram

This must replicate the real IT room layout from the reference diagram
image, not a generic grid. The room layout (fixed regardless of which
group/term is selected — always render all 30 desk positions):

- **Top wall**, single horizontal row, left to right: desks 18, 17, 16, 15,
  14, 13, 12, 11, 10, 9, 8, 7, 6, 5.
- **Right wall**, vertical column, top to bottom: desk 4, then desk 3,
  then desk 2, then desk 1 (desk 1 is bottom-most, right next to the Exit).
- **Left wall**, vertical column, top to bottom: desk 19, 20, 21, 22, 23.
- **Bottom wall**, horizontal row, left to right: desk 24, 25, 26, 27, 28,
  29, 30.
- **Center**: a large dashed-border rectangle labeled "school bags area" —
  no desk, purely decorative/informational.
- **Teacher's desk**: a labeled box positioned bottom-right-of-center,
  between the school bags area and the bottom-right desks — not part of
  the numbered desks.
- **Board**: two "Board" labels spanning the bottom edge of the room,
  below the bottom row of desks.
- **Exit**: a vertical label on the far right edge, at the bottom
  (below desk 1).

Build this with CSS Grid or absolute positioning that mirrors these
relative positions — don't try to pixel-match the screenshot's exact
coordinates, match the *topology* (which wall each desk row is on, the
order along that wall, and what's adjacent to what). That's what makes it
recognizable as "the real room" versus an arbitrary layout, and it's far
easier to maintain if the room ever gets re-arranged.

Each desk box should show the PC number and, if a student is assigned to
it for the selected group/term, their name underneath (small text, wraps
if needed, like the "Arthur Pendelton" / "Eleanor Vance" boxes in the
reference image). If no student from the selected group has that PC
number, show the desk as empty/greyed out with just the number — don't
leave it blank with no indication, a teacher should be able to tell "no
one is assigned here" from "I forgot to load the data."

## Step 6 — Cross-cutting requirements

- All three views pull from the same `PC_ASSIGNMENTS[term][group]` data —
  don't duplicate sorting/filtering logic three times, write one function
  that returns `{ assigned: [...sorted by pc], unassigned: [...sorted by
  name] }` and have each view consume it.
- No student name is ever rendered in bold, regardless of source
  formatting.
- Switching Term, Group, or View mode should update instantly without a
  page reload (this is a single static HTML page — keep all state in JS,
  no backend).
- Match the site's existing responsive behavior — test at mobile width,
  since the split-table and room-diagram views are the ones most likely to
  break on a narrow screen.

## Step 7 — Wire it into the site

Add the new tool card to `tools.html`, in the same grid/list as the
existing 17 tools, with a short one-line description in the same tone as
the others.
