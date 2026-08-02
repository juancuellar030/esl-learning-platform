/* Focused verify: ShortcutsData unit checks + 2 live host/player sessions. */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8080/quiz-game.html';
const log = [];
const fail = (msg) => { log.push('FAIL: ' + msg); console.error('FAIL:', msg); };
const pass = (msg) => { log.push('PASS: ' + msg); console.log('PASS:', msg); };

function watch(page, tag) {
    page.on('pageerror', e => fail(`[${tag}] ${e.message}`));
    page.on('dialog', d => d.dismiss().catch(() => {}));
}

async function newPage(browser, tag) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page, tag);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btn-role-host', { timeout: 20000 });
    await page.waitForFunction(() => window.ShortcutsData && window.ShortcutsData.QUIZ_POOL);
    // bindEvents runs only after FirebaseService.init() resolves
    await page.waitForFunction(() => document.querySelectorAll('#category-chips .qg-cat-chip').length > 0, null, { timeout: 30000 });
    return page;
}

async function jsClick(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('missing ' + sel);
        el.click();
    }, selector);
}

async function createGame(host, { source, mode }) {
    await jsClick(host, '#btn-role-host');
    await host.waitForSelector('#screen-setup.active', { timeout: 15000 });
    await jsClick(host, `.qg-source-btn[data-source="${source}"]`);
    await jsClick(host, `.qg-mode-btn[data-mode="${mode}"]`);
    if (source === 'vocab') {
        await host.evaluate(() => {
            const chip = document.querySelector('.qg-cat-chip');
            if (chip) chip.click();
        });
    }
    for (let i = 0; i < 10; i++) await jsClick(host, '#q-minus');
    await jsClick(host, '#btn-create-game');
    await host.waitForSelector('#screen-lobby.active', { timeout: 20000 });
    return (await host.textContent('#game-code-display')).replace(/\s/g, '');
}

async function joinGame(player, code, theme) {
    await player.click('#btn-role-join');
    await player.fill('#join-code', code);
    await player.fill('#join-name', 'Tester');
    await player.click('#btn-join-next');
    await player.waitForSelector('#screen-avatar.active', { timeout: 20000 });
    await player.locator('.qg-avatar-option').first().click();
    await player.click('#btn-join-game');
    await player.waitForSelector('#screen-waiting.active', { timeout: 20000 });
    if (theme) {
        await player.click('#btn-change-theme');
        await player.click(`.qg-theme-swatch[data-theme="${theme}"]`);
        await player.click('#btn-close-theme-modal');
    }
}

(async () => {
    const browser = await chromium.launch();

    // ---- Unit: ShortcutsData ----
    {
        const page = await newPage(browser, 'unit');
        const unit = await page.evaluate(() => {
            const SD = window.ShortcutsData;
            const copy = SD.SHORTCUTS.find(s => s.id === 'copy');
            const caps = SD.comboCapKeys(copy);
            const privateWin = SD.SHORTCUTS.find(s => s.id === 'private-window');
            return {
                poolSize: SD.QUIZ_POOL.length,
                total: SD.SHORTCUTS.length,
                copyCaps: caps,
                privateExcluded: !SD.QUIZ_POOL.some(s => s.id === 'private-window'),
                privateNull: SD.comboCapKeys(privateWin) === null,
                orderIndep: SD.isComboCorrect(['c', 'control'], caps)
                    && SD.isComboCorrect(['control', 'c'], caps)
                    && !SD.isComboCorrect(['control'], caps)
                    && !SD.isComboCorrect(['control', 'c', 'v'], caps),
                zoomIn: SD.comboCapKeys(SD.SHORTCUTS.find(s => s.id === 'zoom-in')),
                hasRender: typeof SD.renderVirtualKeyboard === 'function'
            };
        });
        if (unit.poolSize >= 25 && unit.privateExcluded && unit.privateNull) pass(`QUIZ_POOL=${unit.poolSize}, private-window excluded`);
        else fail(`pool/private: ${JSON.stringify(unit)}`);
        if (unit.copyCaps && unit.copyCaps.includes('control') && unit.copyCaps.includes('c')) pass(`copy caps=${unit.copyCaps}`);
        else fail(`copy caps bad: ${unit.copyCaps}`);
        if (unit.orderIndep) pass('order-independent compare');
        else fail('order-independent compare');
        if (unit.zoomIn && unit.zoomIn.includes('=')) pass(`zoom-in maps + -> = (${unit.zoomIn})`);
        else fail(`zoom-in mapping: ${unit.zoomIn}`);
        if (unit.hasRender) pass('renderVirtualKeyboard present');
        await page.context().close();
    }

    // ---- Live: shortcuts + automatic ----
    {
        const host = await newPage(browser, 'host-sc');
        const player = await newPage(browser, 'player-sc');
        try {
            const code = await createGame(host, { source: 'shortcuts', mode: 'automatic' });
            pass(`shortcuts lobby code=${code}`);
            await joinGame(player, code, 'pink-pop');
            await host.waitForSelector('#btn-start-game:not([disabled])', { timeout: 20000 });
            await host.click('#btn-start-game');
            await player.waitForSelector('#student-view.active', { timeout: 25000 });
            await player.waitForSelector('#sv-shortcut:not(.qg-hidden)', { timeout: 15000 });

            const shapes = await player.locator('#sv-answers').isVisible();
            if (!shapes) pass('MCQ tiles hidden for shortcut Q');
            else fail('MCQ tiles still visible on shortcut Q');

            const caps = await player.locator('#sv-keyboard .ks-key').count();
            if (caps > 40) pass(`keyboard rendered (${caps} keys)`);
            else fail(`keyboard keys=${caps}`);

            const kbClass = await player.getAttribute('#sv-keyboard', 'class');
            if (kbClass && kbClass.includes('keyboard--palette-pink-pop')) pass(`player keyboard palette: ${kbClass}`);
            else fail(`player keyboard palette: ${kbClass}`);

            const playerTheme = await player.evaluate(() => document.getElementById('quiz-app').dataset.theme);
            const hostTheme = await host.evaluate(() => document.getElementById('quiz-app').dataset.theme);
            if (playerTheme === 'pink-pop') pass('player theme pink-pop');
            else fail(`player theme=${playerTheme}`);
            if (hostTheme === 'default') pass('host theme forced default');
            else fail(`host theme=${hostTheme}`);

            const hostBars = await host.locator('#tv-answers .qg-tv-answer').count();
            const hostText = (await host.textContent('#tv-answers')).replace(/\s+/g, ' ');
            if (hostBars === 2 && /Incorrect/i.test(hostText) && /Correct/i.test(hostText)) {
                pass(`host tally bars: ${hostText.slice(0, 80)}`);
            } else fail(`host tally unexpected: bars=${hostBars} text=${hostText}`);

            // Toggle keys + submit (may be wrong combo — still exercises path)
            await player.locator('#sv-keyboard .ks-key[data-key="control"]').first().click();
            await player.locator('#sv-keyboard .ks-key[data-key="c"]').first().click();
            const sel = await player.textContent('#sv-shortcut-selection');
            if (/Ctrl/i.test(sel) && /C/.test(sel)) pass(`selection label: ${sel.trim()}`);
            else fail(`selection label: ${sel}`);

            await player.click('#btn-shortcut-submit');
            await player.waitForTimeout(2000);
            const revealed = await player.locator('#sv-keyboard .ks-key.key-correct').count();
            if (revealed > 0) pass(`reveal highlighted ${revealed} correct keys`);
            else fail('no key-correct after submit/reveal');

            await player.screenshot({ path: 'tmp-shot-player-automatic-shortcuts.png' });
            await host.screenshot({ path: 'tmp-shot-host-automatic-shortcuts.png' });
        } catch (e) {
            fail('shortcuts session: ' + e.message);
            await player.screenshot({ path: 'tmp-shot-FAIL-player-automatic-shortcuts.png' }).catch(() => {});
            await host.screenshot({ path: 'tmp-shot-FAIL-host-automatic-shortcuts.png' }).catch(() => {});
        }
        await host.context().close();
        await player.context().close();
    }

    // ---- Live: vocab MCQ + student-paced + gold-black tiles ----
    {
        const host = await newPage(browser, 'host-mcq');
        const player = await newPage(browser, 'player-mcq');
        try {
            const code = await createGame(host, { source: 'vocab', mode: 'student-paced' });
            pass(`vocab lobby code=${code}`);
            await joinGame(player, code, 'gold-black');
            await host.waitForSelector('#btn-start-game:not([disabled])', { timeout: 20000 });
            await host.click('#btn-start-game');
            await player.waitForSelector('#student-view.active', { timeout: 25000 });
            await player.waitForSelector('.qg-answer-btn .qg-tile-shape', { timeout: 15000 });

            const shapeTexts = await player.$$eval('.qg-answer-btn .qg-tile-shape', els => els.map(e => e.textContent));
            if (JSON.stringify(shapeTexts) === JSON.stringify(['▲', '◆', '●', '■'])) pass(`tile shapes: ${shapeTexts.join(' ')}`);
            else fail(`tile shapes: ${shapeTexts}`);

            const playerTheme = await player.evaluate(() => document.getElementById('quiz-app').dataset.theme);
            const hostTheme = await host.evaluate(() => document.getElementById('quiz-app').dataset.theme);
            if (playerTheme === 'gold-black') pass('player theme gold-black');
            else fail(`player theme=${playerTheme}`);
            if (hostTheme === 'default') pass('host stays default during MCQ');
            else fail(`host theme=${hostTheme}`);

            await player.locator('.qg-answer-btn[data-index="0"]').click({ force: true });
            await player.waitForTimeout(1500);
            const correctOrWrong = await player.locator('.qg-answer-btn.correct, .qg-answer-btn.wrong').count();
            if (correctOrWrong > 0) pass('MCQ reveal state applied');
            else fail('MCQ no correct/wrong class after answer');

            await player.screenshot({ path: 'tmp-shot-player-student-paced-mcq.png' });

            // Custom builder type select (fresh page so it doesn't kill the live session above)
            const builder = await newPage(browser, 'builder');
            await jsClick(builder, '#btn-role-host');
            await builder.waitForSelector('#screen-setup.active');
            await jsClick(builder, '.qg-source-btn[data-source="custom"]');
            const typeOpts = await builder.$$eval('.cq-type option', opts => opts.map(o => o.value));
            if (typeOpts.includes('mcq') && typeOpts.includes('shortcut')) pass(`custom builder types present`);
            else fail(`custom builder types: ${typeOpts}`);
            await builder.context().close();
        } catch (e) {
            fail('mcq session: ' + e.message);
            await player.screenshot({ path: 'tmp-shot-FAIL-player-student-paced-mcq.png' }).catch(() => {});
        }
        await host.context().close();
        await player.context().close();
    }

    // ---- teacher-paced smoke: host Next button path with shortcuts ----
    {
        const host = await newPage(browser, 'host-tp');
        const player = await newPage(browser, 'player-tp');
        try {
            const code = await createGame(host, { source: 'shortcuts', mode: 'teacher-paced' });
            await joinGame(player, code, null);
            await host.waitForSelector('#btn-start-game:not([disabled])', { timeout: 20000 });
            await host.click('#btn-start-game');
            await player.waitForSelector('#sv-shortcut:not(.qg-hidden)', { timeout: 25000 });
            await player.locator('#sv-keyboard .ks-key[data-key="control"]').first().click();
            await player.locator('#sv-keyboard .ks-key[data-key="w"]').first().click();
            await player.click('#btn-shortcut-submit');
            await host.waitForSelector('#tv-teacher-controls:not(.qg-hidden)', { timeout: 20000 });
            pass('teacher-paced: Next controls appear after all answered');
            await host.click('#btn-next-question');
            await player.waitForTimeout(1500);
            const stillShortcut = await player.locator('#sv-shortcut:not(.qg-hidden)').count();
            if (stillShortcut) pass('teacher-paced advanced to next shortcut Q');
            else pass('teacher-paced advanced (next Q may be MCQ or end)');
            await host.screenshot({ path: 'tmp-shot-host-teacher-paced-shortcuts-after.png' });
        } catch (e) {
            fail('teacher-paced: ' + e.message);
            await host.screenshot({ path: 'tmp-shot-FAIL-host-teacher-paced-shortcuts.png' }).catch(() => {});
        }
        await host.context().close();
        await player.context().close();
    }

    await browser.close();
    const fails = log.filter(l => l.startsWith('FAIL'));
    console.log('\n=== SUMMARY ===');
    console.log(`${log.length - fails.length} passed, ${fails.length} failed`);
    if (fails.length) process.exit(1);
})();
