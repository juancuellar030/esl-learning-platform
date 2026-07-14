/**
 * PC Assignment Viewer
 * Shared sorting + three view modes + cross-group search
 */
const PcAssignmentViewer = (function () {
    const GROUPS = ['3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C', '5D'];

    let state = {
        term: 'term3',
        group: '3A',
        view: 'single',
        search: ''
    };

    function getGroupData(termKey, group) {
        const termData = PC_ASSIGNMENTS[termKey];
        if (!termData || !termData[group]) return null;
        return termData[group];
    }

    /** Returns { assigned: [...sorted by pc], unassigned: [...sorted by name] } */
    function partitionAssignments(students) {
        if (!students) return { assigned: [], unassigned: [] };
        const assigned = students
            .filter((s) => s.pc !== null && s.pc !== undefined)
            .slice()
            .sort((a, b) => a.pc - b.pc || a.name.localeCompare(b.name));
        const unassigned = students
            .filter((s) => s.pc === null || s.pc === undefined)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
        return { assigned, unassigned };
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderUnassignedSection(unassigned) {
        if (!unassigned.length) return '';
        const items = unassigned
            .map((s) => `<li>${escapeHtml(s.name)}</li>`)
            .join('');
        return `
            <div class="pc-unassigned">
                <h3>PC not yet assigned</h3>
                <ul class="pc-unassigned-list">${items}</ul>
            </div>`;
    }

    function tableRows(assigned) {
        return assigned
            .map(
                (s) =>
                    `<tr><td class="pc-num">${s.pc}</td><td>${escapeHtml(s.name)}</td></tr>`
            )
            .join('');
    }

    function renderSingleTable(partition) {
        const { assigned, unassigned } = partition;
        return `
            <table class="pc-table">
                <thead><tr><th>PC</th><th>Student's Name</th></tr></thead>
                <tbody>${tableRows(assigned) || '<tr><td colspan="2">No assigned PCs</td></tr>'}</tbody>
            </table>
            ${renderUnassignedSection(unassigned)}`;
    }

    function renderSplitTable(partition) {
        const { assigned, unassigned } = partition;
        const chunks = [
            assigned.filter((s) => s.pc >= 1 && s.pc <= 10),
            assigned.filter((s) => s.pc >= 11 && s.pc <= 20),
            assigned.filter((s) => s.pc >= 21 && s.pc <= 30)
        ];
        // Also catch any PC outside 1-30 into last chunk
        const extras = assigned.filter((s) => s.pc < 1 || s.pc > 30);
        if (extras.length) chunks[2] = chunks[2].concat(extras);

        const tables = chunks
            .filter((chunk) => chunk.length > 0)
            .map(
                (chunk) => `
                <table class="pc-table">
                    <thead><tr><th>PC</th><th>Student's Name</th></tr></thead>
                    <tbody>${tableRows(chunk)}</tbody>
                </table>`
            )
            .join('');

        return `
            <div class="pc-split-wrap">${tables || '<p>No assigned PCs</p>'}</div>
            ${renderUnassignedSection(unassigned)}`;
    }

    function studentsByPc(assigned) {
        const map = {};
        for (const s of assigned) {
            if (!map[s.pc]) map[s.pc] = [];
            map[s.pc].push(s.name);
        }
        return map;
    }

    /**
     * Room-diagram short name: first names + first last name + 2nd last initial.
     * Source lists are APELLIDO1 APELLIDO2 NOMBRE(S).
     */
    function formatRoomName(fullName) {
        const parts = String(fullName || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
        const last1 = parts[0];
        const last2 = parts[1];
        const firstNames = parts.slice(2).join(' ');
        const initial = last2.charAt(0);
        return `${firstNames} ${last1} ${initial}.`;
    }

    function deskHtml(pc, byPc) {
        const names = byPc[pc];
        const empty = !names || !names.length;
        const nameHtml = empty
            ? ''
            : names
                  .map((n) => `<span class="desk-name">${escapeHtml(formatRoomName(n))}</span>`)
                  .join('');
        return `<div class="pc-desk${empty ? ' empty' : ''}" data-pc="${pc}">
            <span class="desk-num">${pc}</span>${nameHtml}
        </div>`;
    }

    function renderRoomDiagram(partition) {
        const byPc = studentsByPc(partition.assigned);
        // Topology: top 18→6; right wall 5→1 (5 is outer corner above 4); left 19→23
        const top = [18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6]
            .map((pc) => deskHtml(pc, byPc))
            .join('');
        const left = [19, 20, 21, 22, 23].map((pc) => deskHtml(pc, byPc)).join('');
        const right = [5, 4, 3, 2, 1].map((pc) => deskHtml(pc, byPc)).join('');
        const bottom = [24, 25, 26, 27, 28, 29, 30].map((pc) => deskHtml(pc, byPc)).join('');

        return `
            <div class="pc-room">
                <div class="pc-room-left">${left}</div>
                <div class="pc-room-top">${top}</div>
                <div class="pc-room-right">${right}</div>
                <div class="pc-room-center">
                    <div class="pc-bags">school bags area</div>
                </div>
                <div class="pc-room-bottom">${bottom}</div>
                <div class="pc-teacher-row">
                    <div class="pc-teacher">Teacher's Desk</div>
                </div>
                <div class="pc-board"><span>Board</span><span>Board</span></div>
                <div class="pc-exit">Exit</div>
            </div>
            ${renderUnassignedSection(partition.unassigned)}`;
    }

    function searchTerm(termKey, query) {
        const termData = PC_ASSIGNMENTS[termKey];
        if (!termData || !query.trim()) return [];
        const q = query.trim().toLowerCase();
        const results = [];
        for (const group of GROUPS) {
            const students = termData[group] || [];
            for (const s of students) {
                if (s.name.toLowerCase().includes(q)) {
                    results.push({ name: s.name, group, pc: s.pc });
                }
            }
        }
        results.sort((a, b) => a.name.localeCompare(b.name) || a.group.localeCompare(b.group));
        return results;
    }

    function renderSearchResults(results, query) {
        const el = document.getElementById('pc-search-results');
        if (!query.trim()) {
            el.hidden = true;
            el.innerHTML = '';
            return;
        }
        el.hidden = false;
        if (!results.length) {
            el.innerHTML = `<h3>Search results</h3><p class="pc-search-empty">No students matching "${escapeHtml(query)}" in this term.</p>`;
            return;
        }
        const items = results
            .map((r) => {
                const pcLabel =
                    r.pc === null || r.pc === undefined
                        ? '<span class="pc-badge pc-badge-unassigned">Not assigned</span>'
                        : `<span class="pc-badge pc-badge-pc">PC ${r.pc}</span>`;
                return `<li>
                    <span>${escapeHtml(r.name)}</span>
                    <span class="pc-badge pc-badge-group">${escapeHtml(r.group)}</span>
                    ${pcLabel}
                </li>`;
            })
            .join('');
        el.innerHTML = `<h3>Search results (${results.length})</h3><ul class="pc-search-list">${items}</ul>`;
    }

    function render() {
        const area = document.getElementById('pc-view-area');
        const title = document.getElementById('pc-view-title');
        const termData = PC_ASSIGNMENTS[state.term];

        renderSearchResults(searchTerm(state.term, state.search), state.search);

        if (!termData) {
            title.textContent = '';
            area.innerHTML = `<div class="pc-empty-term">No PC assignment data available for this term yet</div>`;
            return;
        }

        const students = getGroupData(state.term, state.group) || [];
        const partition = partitionAssignments(students);
        const termLabel = state.term.replace('term', 'Term ');
        title.textContent = `${state.group} — ${termLabel} (${partition.assigned.length} assigned, ${partition.unassigned.length} unassigned)`;

        if (state.view === 'single') {
            area.innerHTML = renderSingleTable(partition);
        } else if (state.view === 'split') {
            area.innerHTML = renderSplitTable(partition);
        } else {
            area.innerHTML = renderRoomDiagram(partition);
        }
    }

    function init() {
        const termSelect = document.getElementById('pc-term');
        const groupSelect = document.getElementById('pc-group');
        const viewSelect = document.getElementById('pc-view');
        const searchInput = document.getElementById('pc-search');
        const searchBtn = document.getElementById('pc-search-btn');

        GROUPS.forEach((g) => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            if (g === '3A') opt.selected = true;
            groupSelect.appendChild(opt);
        });

        termSelect.value = 'term3';
        viewSelect.value = 'single';

        termSelect.addEventListener('change', () => {
            state.term = termSelect.value;
            render();
        });
        groupSelect.addEventListener('change', () => {
            state.group = groupSelect.value;
            render();
        });
        viewSelect.addEventListener('change', () => {
            state.view = viewSelect.value;
            render();
        });

        const runSearch = () => {
            state.search = searchInput.value;
            render();
        };
        searchInput.addEventListener('input', runSearch);
        searchBtn.addEventListener('click', runSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSearch();
        });

        render();
    }

    return { init, partitionAssignments };
})();

document.addEventListener('DOMContentLoaded', () => PcAssignmentViewer.init());
