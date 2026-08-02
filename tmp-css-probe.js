/* Probe which rules apply to a selected keycap. */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto('http://127.0.0.1:8080/quiz-game.html');
    await page.waitForTimeout(1500);

    const out = await page.evaluate(() => {
        const wrap = document.getElementById('sv-shortcut');
        wrap.classList.remove('qg-hidden');
        const kb = document.getElementById('sv-keyboard');
        window.ShortcutsData.renderVirtualKeyboard(kb, {
            paletteClass: 'keyboard--palette-pink-pop', includeNumpad: false
        });
        const key = kb.querySelector('.ks-key[data-key="x"]');
        key.classList.add('selected');

        const cs = getComputedStyle(key);
        const matched = [];
        for (const sheet of document.styleSheets) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            for (const rule of rules) {
                if (!rule.selectorText) continue;
                try { if (key.matches(rule.selectorText)) matched.push({ href: (sheet.href || '').split('/').pop(), sel: rule.selectorText, bg: rule.style.background || rule.style.backgroundColor }); } catch { }
            }
        }
        return {
            computedBg: cs.backgroundColor,
            highlightVar: getComputedStyle(kb).getPropertyValue('--palette-highlight-bg'),
            wrapClasses: wrap.className,
            matched: matched.filter(m => m.bg)
        };
    });

    console.log(JSON.stringify(out, null, 2));
    await browser.close();
})();
