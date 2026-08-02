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
            hostQuestion: (await host.textContent('#tv-question')).trim(),
            hostBars: (await host.textContent('#tv-answers')).replace(/\s+/g, ' ').trim(),
            shortcutVisible: await player.isVisible('#sv-shortcut'),
            tilesVisible: await player.isVisible('#sv-answers')
        };

        if (report.shortcutVisible) {
            report.keyboardClass = await player.getAttribute('#sv-keyboard', 'class');
            report.capCount = await player.$$eval('#sv-keyboard .ks-key', e => e.length);
            step('clicking keys');
            const comboText = report.hostBars.split('Correct — ')[1].replace(/\s*\d+\s*$/, '').trim();
            const map = { ctrl: 'control', win: 'meta', shift: 'shift', alt: 'alt', '+': '=', '−': '-' };
            const caps = comboText.split(' + ').map(t => t.trim()).filter(Boolean)
                .map(t => map[t.toLowerCase()] || map[t] || t.toLowerCase());
            report.expectedCaps = caps;
            for (const cap of caps) {
                await player.click(`#sv-keyboard .ks-key[data-key="${cap.replace(/"/g, '\\"')}"] >> nth=0`);
            }
            report.selection = (await player.textContent('#sv-shortcut-selection')).trim();
            report.selectedCaps = await player.$$eval('#sv-keyboard .ks-key.selected', e => e.map(x => x.dataset.key));
            await player.screenshot({ path: `tmp-shot-player-${MODE}-${SOURCE}-selected.png` });
            await player.click('#btn-shortcut-submit');
        } else {
            report.shapes = await player.$$eval('.qg-answer-btn .qg-tile-shape', e => e.map(x => x.textContent));
            await player.screenshot({ path: `tmp-shot-player-${MODE}-${SOURCE}-tiles.png` });
            await player.click('.qg-answer-btn[data-index="0"]');
        }

        await player.waitForTimeout(3500);
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
