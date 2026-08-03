/* Quick check: layout width + shortcut format rotation */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8080/quiz-game.html';

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const host = await ctx.newPage();
    const player = await ctx.newPage();
    host.on('dialog', d => d.dismiss().catch(() => {}));
    player.on('dialog', d => d.dismiss().catch(() => {}));

    await host.goto(BASE);
    await player.goto(BASE);
    await host.waitForFunction(() => document.querySelectorAll('#category-chips .qg-cat-chip').length > 0);

    const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);

    await click(host, '#btn-role-host');
    await click(host, '.qg-source-btn[data-source="shortcuts"]');
    await click(host, '.qg-mode-btn[data-mode="student-paced"]');
    for (let i = 0; i < 10; i++) await click(host, '#q-minus');
    for (let i = 0; i < 8; i++) await click(host, '#q-plus'); // 12 questions -> 4 of each format
    await click(host, '#btn-create-game');
    await host.waitForSelector('#screen-lobby.active');

    const code = (await host.textContent('#game-code-display')).replace(/\s/g, '');
    await click(player, '#btn-role-join');
    await player.fill('#join-code', code);
    await player.fill('#join-name', 'Tester');
    await click(player, '#btn-join-next');
    await player.locator('.qg-avatar-option').first().click();
    await click(player, '#btn-join-game');
    await host.waitForSelector('#btn-start-game:not([disabled])');
    await click(host, '#btn-start-game');
    await player.waitForSelector('#student-view.active');

    const layout = await player.evaluate(() => {
        const sv = document.getElementById('student-view');
        const screen = document.getElementById('screen-game');
        return {
            studentWidth: sv?.offsetWidth,
            screenWidth: screen?.offsetWidth,
            viewport: window.innerWidth
        };
    });
    console.log('layout', layout);

    const formats = [];
    for (let i = 0; i < 6; i++) {
        await player.waitForTimeout(800);
        const state = await player.evaluate(() => {
            const q = document.getElementById('sv-question')?.textContent || '';
            return {
                click: !document.getElementById('sv-shortcut')?.classList.contains('qg-hidden'),
                live: !document.getElementById('sv-shortcut-live')?.classList.contains('qg-hidden'),
                mcq: !document.getElementById('sv-answers')?.classList.contains('qg-hidden'),
                q: q.slice(0, 60)
            };
        });
        const fmt = state.click ? 'click' : state.live ? 'live' : state.mcq ? 'mcq' : 'unknown';
        formats.push(fmt);
        console.log(`Q${i + 1}: ${fmt} — ${state.q}`);

        if (fmt === 'click') {
            await player.locator('#sv-keyboard .ks-key[data-key="control"]').first().click();
            await player.locator('#sv-keyboard .ks-key[data-key="c"]').first().click();
            await click(player, '#btn-shortcut-submit');
        } else if (fmt === 'live') {
            await player.keyboard.press('Control+c');
        } else if (fmt === 'mcq') {
            await player.locator('.qg-answer-btn[data-index="0"]').click({ force: true });
        }
        await player.waitForTimeout(2200);
    }

    const themes = await player.evaluate(() =>
        [...document.querySelectorAll('.qg-theme-swatch')].map((b) => b.dataset.theme)
    );
    console.log('themes', themes);
    console.log('formats seen', [...new Set(formats)]);
    await browser.close();
})();
