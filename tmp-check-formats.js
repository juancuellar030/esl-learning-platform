const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch();
    const host = await b.newPage();
    const player = await b.newPage();
    host.on('dialog', d => d.dismiss().catch(() => {}));
    player.on('dialog', d => d.dismiss().catch(() => {}));
    await host.goto('http://127.0.0.1:8080/quiz-game.html');
    await player.goto('http://127.0.0.1:8080/quiz-game.html');
    await host.waitForFunction(() => document.querySelectorAll('#category-chips .qg-cat-chip').length > 0);
    const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
    await click(host, '#btn-role-host');
    await click(host, '.qg-source-btn[data-source="shortcuts"]');
    for (let i = 0; i < 10; i++) await click(host, '#q-minus');
    for (let i = 0; i < 8; i++) await click(host, '#q-plus');
    await click(host, '#btn-create-game');
    await host.waitForSelector('#screen-lobby.active');
    const code = (await host.textContent('#game-code-display')).replace(/\s/g, '');
    const sessionFormats = await player.evaluate(async (c) => {
        const s = await FirebaseService.getSession(c);
        return s.questions.map((q, i) => `${i}:${q.shortcutFormat}`);
    }, code);
    console.log('session formats:', sessionFormats.join(', '));
    await b.close();
})();
