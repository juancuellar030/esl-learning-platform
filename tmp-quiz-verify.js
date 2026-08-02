/* Temporary end-to-end check for the quiz reskin / shortcut / palette work. */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8080/quiz-game.html';
const errors = [];

function watch(page, tag) {
    page.on('console', m => {
        if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`);
    });
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    page.on('dialog', d => d.dismiss().catch(() => { }));
}

async function newPage(browser, tag) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page, tag);
    await page.goto(BASE);
    await page.waitForTimeout(1500);
    return page;
}

async function createGame(host, { source, mode, questions }) {
    await host.click('#btn-role-host');
    await host.click(`.qg-source-btn[data-source="${source}"]`);
    await host.click(`.qg-mode-btn[data-mode="${mode}"]`);
    if (source === 'vocab') {
        await host.click('.qg-cat-chip');
    }
    // Reduce question count to the minimum (5)
    for (let i = 0; i < 10; i++) await host.click('#q-minus');
    if (questions) for (let i = 5; i < questions; i++) await host.click('#q-plus');
    await host.click('#btn-create-game');
    await host.waitForSelector('#screen-lobby.active', { timeout: 15000 });
    const code = (await host.textContent('#game-code-display')).replace(/\s/g, '');
    return code;
}

async function joinGame(player, code, name, theme) {
    await player.click('#btn-role-join');
    await player.fill('#join-code', code);
    await player.fill('#join-name', name);
    await player.click('#btn-join-next');
    await player.waitForSelector('#screen-avatar.active', { timeout: 15000 });
    await player.click('.qg-avatar-option');
    await player.click('#btn-join-game');
    await player.waitForSelector('#screen-waiting.active', { timeout: 15000 });
    if (theme) {
        await player.click('#btn-change-theme');
        await player.click(`.qg-theme-swatch[data-theme="${theme}"]`);
        await player.click('#btn-close-theme-modal');
    }
}

async function answerCurrent(player, tag) {
    await player.waitForTimeout(1200);
    const isShortcut = await player.isVisible('#sv-shortcut');
    if (isShortcut) {
        const keys = await player.evaluate(() => window.__qgExpectedKeys || null);
        const caps = await player.$$eval('#sv-keyboard .ks-key', els => els.length);
        if (!caps) throw new Error(`${tag}: keyboard did not render`);
        // Click the keys named in the on-screen prompt via the host's stored combo is
        // not available client-side, so click the first modifier + a letter and submit.
        const label = await player.textContent('#sv-question');
        return { type: 'shortcut', caps, label: label.trim(), keys };
    }
    const tiles = await player.$$eval('.qg-sv-answers .qg-answer-btn:visible', els => els.length).catch(() => null);
    const shapes = await player.$$eval('.qg-answer-btn .qg-tile-shape', els => els.map(e => e.textContent));
    return { type: 'mcq', shapes };
}

(async () => {
    const browser = await chromium.launch();
    const results = {};

    for (const mode of ['automatic', 'student-paced', 'teacher-paced']) {
        for (const source of ['shortcuts', 'vocab']) {
            const tag = `${mode}/${source}`;
            const host = await newPage(browser, `host ${tag}`);
            const player = await newPage(browser, `player ${tag}`);

            try {
                const code = await createGame(host, { source, mode });
                await joinGame(player, code, 'Tester', source === 'shortcuts' ? 'pink-pop' : 'gold-black');
                await host.waitForSelector('#btn-start-game:not([disabled])', { timeout: 15000 });
                await host.click('#btn-start-game');
                await player.waitForSelector('#screen-game.active', { timeout: 25000 });
                await player.waitForTimeout(4000);

                const state = await answerCurrent(player, tag);

                if (state.type === 'shortcut') {
                    // Click every cap the question needs by reading the host's combo text.
                    const combo = await host.textContent('#tv-ans-1');
                    const capKeys = await player.evaluate(() => {
                        const app = document.getElementById('quiz-app');
                        return app ? app.dataset.theme : null;
                    });
                    state.hostCombo = combo.replace(/\s+/g, ' ').trim();
                    state.playerTheme = capKeys;
                    state.keyboardPalette = await player.getAttribute('#sv-keyboard', 'class');
                    state.hostTheme = await host.evaluate(() => document.getElementById('quiz-app').dataset.theme);

                    // Select two keys and submit to exercise the submit path.
                    await player.click('#sv-keyboard .ks-key[data-key="control"]');
                    await player.click('#sv-keyboard .ks-key[data-key="c"]');
                    state.selectionLabel = await player.textContent('#sv-shortcut-selection');
                    await player.click('#btn-shortcut-submit');
                    await player.waitForTimeout(2500);
                    state.hostTally = (await host.textContent('#tv-answers')).replace(/\s+/g, ' ').trim();
                    state.revealed = await player.$$eval('#sv-keyboard .ks-key.key-correct', e => e.length);
                } else {
                    state.hostTheme = await host.evaluate(() => document.getElementById('quiz-app').dataset.theme);
                    state.playerTheme = await player.evaluate(() => document.getElementById('quiz-app').dataset.theme);
                    await player.click('.qg-answer-btn[data-index="0"]');
                    await player.waitForTimeout(2500);
                    state.revealedCorrect = await player.$$eval('.qg-answer-btn.correct', e => e.length);
                }

                await player.screenshot({ path: `tmp-shot-player-${mode}-${source}.png` });
                await host.screenshot({ path: `tmp-shot-host-${mode}-${source}.png` });
                results[tag] = state;
            } catch (e) {
                results[tag] = { error: e.message };
                await player.screenshot({ path: `tmp-shot-FAIL-player-${mode}-${source}.png` }).catch(() => { });
                await host.screenshot({ path: `tmp-shot-FAIL-host-${mode}-${source}.png` }).catch(() => { });
            }

            await host.context().close();
            await player.context().close();
        }
    }

    await browser.close();
    console.log(JSON.stringify(results, null, 2));
    console.log('--- ERRORS ---');
    console.log(errors.length ? errors.join('\n') : 'none');
})();
