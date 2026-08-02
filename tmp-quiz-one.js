/* Temporary single-scenario check with step logging. */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8080/quiz-game.html';
const MODE = process.argv[2] || 'automatic';
const SOURCE = process.argv[3] || 'shortcuts';
const errors = [];
const step = m => console.log(`[${Date.now() % 100000}] ${m}`);

function watch(page, tag) {
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    page.on('dialog', d => d.dismiss().catch(() => { }));
}

(async () => {
    const browser = await chromium.launch();
    const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const playerCtx = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const host = await hostCtx.newPage();
    const player = await playerCtx.newPage();
    watch(host, 'host');
    watch(player, 'player');

    try {
        step('loading pages');
        await host.goto(BASE);
        await player.goto(BASE);
        await host.waitForTimeout(2500);

        step('host setup');
        await host.click('#btn-role-host');
        await host.click(`.qg-source-btn[data-source="${SOURCE}"]`);
        await host.click(`.qg-mode-btn[data-mode="${MODE}"]`);
        if (SOURCE === 'vocab') await host.click('.qg-cat-chip');
        for (let i = 0; i < 10; i++) await host.click('#q-minus');
        for (let i = 0; i < 10; i++) await host.click('#t-plus');
        await host.click('#btn-create-game');
        await host.waitForSelector('#screen-lobby.active', { timeout: 20000 });
        const code = (await host.textContent('#game-code-display')).replace(/\s/g, '');
        step('game code ' + code);

        step('player join');
        await player.click('#btn-role-join');
        await player.fill('#join-code', code);
        await player.fill('#join-name', 'Tester');
        await player.click('#btn-join-next');
        await player.waitForSelector('#screen-avatar.active', { timeout: 20000 });
        await player.click('.qg-avatar-option');
        await player.click('#btn-join-game');
        await player.waitForSelector('#screen-waiting.active', { timeout: 20000 });

        step('player theme pick');
        await player.click('#btn-change-theme');
        await player.click('.qg-theme-swatch[data-theme="pink-pop"]');
        await player.click('#btn-close-theme-modal');

        step('host start');
        await host.waitForSelector('#btn-start-game:not([disabled])', { timeout: 20000 });
        await host.click('#btn-start-game');
        await player.waitForSelector('#screen-game.active', { timeout: 30000 });
        await player.waitForTimeout(5000);

        const report = {
            mode: MODE,
            source: SOURCE,
            hostTheme: await host.evaluate(() => document.getElementById('quiz-app').dataset.theme),
            playerTheme: await player.evaluate(() => document.getElementById('quiz-app').dataset.theme),
            playerQuestion: (await player.textContent('#sv-question')).trim(),
            hostQuestion: (await host.textContent('#tv-question').catch(() => '')).trim(),
            hostBars: ((await host.textContent('#tv-answers').catch(() => '')) || '').replace(/\s+/g, ' ').trim(),
            shortcutVisible: await player.isVisible('#sv-shortcut'),
            tilesVisible: await player.isVisible('#sv-answers')
        };

        if (report.shortcutVisible) {
            report.keyboardClass = await player.getAttribute('#sv-keyboard', 'class');
            report.capCount = await player.$$eval('#sv-keyboard .ks-key', e => e.length);
            step('clicking keys');
            // Resolve the expected caps from the page's own shared shortcut module.
            const caps = await player.evaluate(text => {
                const match = window.ShortcutsData.SHORTCUTS
                    .filter(s => text.includes(`"${s.label}"`))
                    .sort((a, b) => b.label.length - a.label.length)[0];
                return match ? window.ShortcutsData.comboCapKeys(match) : null;
            }, report.playerQuestion);
            report.expectedCaps = caps;
            if (!caps) throw new Error('could not resolve expected caps for ' + report.playerQuestion);
            for (const cap of caps) {
                await player.click(`#sv-keyboard .ks-key[data-key="${cap.replace(/"/g, '\\"')}"] >> nth=0`);
            }
            report.selection = (await player.textContent('#sv-shortcut-selection')).trim();
            report.selectedCaps = await player.$$eval('#sv-keyboard .ks-key.selected', e => e.map(x => x.dataset.key));
            report.selectedVsPlain = await player.evaluate(() => {
                const sel = document.querySelector('#sv-keyboard .ks-key.selected');
                const plain = document.querySelector('#sv-keyboard .ks-key:not(.selected)');
                const bg = el => getComputedStyle(el).backgroundColor;
                const matched = [];
                for (const sheet of document.styleSheets) {
                    let rules; try { rules = sheet.cssRules; } catch { continue; }
                    for (const r of rules) {
                        if (!r.selectorText) continue;
                        try {
                            if (sel.matches(r.selectorText) && (r.style.background || r.style.backgroundColor)) {
                                matched.push(`${(sheet.href || 'inline').split('/').pop()} :: ${r.cssText}`);
                            }
                        } catch { }
                    }
                }
                return {
                    selectedKey: sel.dataset.key,
                    selected: bg(sel),
                    plain: bg(plain),
                    differs: bg(sel) !== bg(plain),
                    ancestorHasClass: !!sel.closest('.qg-sv-shortcut'),
                    kbClass: document.getElementById('sv-keyboard').className,
                    varOnKey: getComputedStyle(sel).getPropertyValue('--palette-highlight-bg'),
                    varOnKb: getComputedStyle(document.getElementById('sv-keyboard')).getPropertyValue('--palette-highlight-bg'),
                    amber: getComputedStyle(document.documentElement).getPropertyValue('--amber-flame'),
                    matched
                };
            });
            await player.screenshot({ path: `tmp-shot-player-${MODE}-${SOURCE}-selected.png` });
            await player.click('#btn-shortcut-submit');
        } else {
            report.shapes = await player.$$eval('.qg-answer-btn .qg-tile-shape', e => e.map(x => x.textContent));
            await player.screenshot({ path: `tmp-shot-player-${MODE}-${SOURCE}-tiles.png` });
            await player.click('.qg-answer-btn[data-index="0"]');
        }

        await player.waitForTimeout(1200);
        await player.screenshot({ path: `tmp-shot-player-${MODE}-${SOURCE}-reveal.png` });
        await host.screenshot({ path: `tmp-shot-host-${MODE}-${SOURCE}-reveal.png` });
        report.atReveal = {
            keysRevealed: await player.$$eval('#sv-keyboard .ks-key.key-correct', e => e.length).catch(() => 0),
            keysWrong: await player.$$eval('#sv-keyboard .ks-key.key-wrong', e => e.length).catch(() => 0),
            correctTiles: await player.$$eval('.qg-answer-btn.correct', e => e.length),
            hostBars: (await host.textContent('#tv-answers')).replace(/\s+/g, ' ').trim(),
            hostAnswered: await host.textContent('#tv-answered'),
            score: await player.textContent('#sv-score')
        };

        await player.waitForTimeout(3000);
        report.afterSubmit = {
            keysRevealed: await player.$$eval('#sv-keyboard .ks-key.key-correct', e => e.length).catch(() => 0),
            correctTiles: await player.$$eval('.qg-answer-btn.correct', e => e.length),
            hostBars: (await host.textContent('#tv-answers')).replace(/\s+/g, ' ').trim(),
            hostAnswered: await host.textContent('#tv-answered')
        };

        await player.screenshot({ path: `tmp-shot-player-${MODE}-${SOURCE}-after.png` });
        await host.screenshot({ path: `tmp-shot-host-${MODE}-${SOURCE}-after.png` });
        console.log(JSON.stringify(report, null, 2));
    } catch (e) {
        console.log('FAILED: ' + e.message);
        await player.screenshot({ path: `tmp-shot-FAIL-player-${MODE}-${SOURCE}.png` }).catch(() => { });
        await host.screenshot({ path: `tmp-shot-FAIL-host-${MODE}-${SOURCE}.png` }).catch(() => { });
    }

    console.log('--- ERRORS ---');
    console.log(errors.length ? errors.join('\n') : 'none');
    await browser.close();
    process.exit(0);
})();
