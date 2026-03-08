import { chromium } from 'playwright';

async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function testMode(modeValue) {
    console.log(`\n--- Testing ${modeValue} Mode ---`);
    const browser = await chromium.launch({ headless: true });
    const contextHost = await browser.newContext();
    const contextPlayer1 = await browser.newContext();

    const pageHost = await contextHost.newPage();
    const pagePlayer1 = await contextPlayer1.newPage();

    // pagePlayer1.on('console', msg => console.log(`[Player1 console] ${msg.text()}`));

    try {
        // 1. Host create game
        await pageHost.goto('http://localhost:8080/quiz-game.html');
        await pageHost.click('#btn-role-host');
        await pageHost.selectOption('#setup-game-mode', modeValue);
        await pageHost.click('#btn-create-game');

        // Wait for lobby to show and get game code
        await pageHost.waitForSelector('#lb-game-code', { state: 'visible' });
        const gameCode = await pageHost.textContent('#lb-game-code');
        console.log(`Host created game, code: ${gameCode}`);

        // 2. Player joins
        await pagePlayer1.goto('http://localhost:8080/quiz-game.html');
        await pagePlayer1.click('#btn-role-player');
        await pagePlayer1.fill('#join-game-code', gameCode);
        await pagePlayer1.fill('#join-player-name', 'Player One');
        await pagePlayer1.click('#btn-join-game');

        // Avatar selection
        await pagePlayer1.waitForSelector('.qg-waiting-avatar-btn', { state: 'visible' });
        const avatars = await pagePlayer1.$$('.qg-waiting-avatar-btn');
        if (avatars.length > 0) {
            await avatars[0].click();
        }
        await pagePlayer1.click('#btn-ready-avatar');

        // Wait for player to be in waiting room
        await pagePlayer1.waitForSelector('#screen-waiting', { state: 'visible' });
        console.log('Player 1 joined waiting room.');

        // Host sees player
        await pageHost.waitForSelector('.qg-lobby-player');

        // Host starts game
        await pageHost.click('#btn-start-game');
        console.log('Host started game. Waiting for questions...');

        // Wait for countdown to finish on both sides
        await pageHost.waitForSelector('#screen-game', { state: 'visible', timeout: 15000 });
        await pagePlayer1.waitForSelector('#screen-game', { state: 'visible', timeout: 15000 });

        // Question 1
        console.log('Playing Q1');
        await pagePlayer1.waitForSelector('#sv-question:not(.qg-hidden)', { timeout: 10000 }).catch(() => console.log('Player Q1 timeout'));
        const q1Text = await pagePlayer1.textContent('#sv-question');
        console.log(`Player sees Q1: ${q1Text.substring(0, 30).trim()}`);

        // Wait 2 seconds, let timer tick, then answer
        await delay(2000);
        const p1FillWidth1 = await pagePlayer1.evaluate(() => document.getElementById('sv-timer-fill').style.width);
        console.log(`Player Q1 Timer Fill Width (Before Answer): ${p1FillWidth1}`);

        // Answer
        const q1Btns = await pagePlayer1.$$('#sv-answers .qg-answer-btn');
        if (q1Btns.length > 0) {
            await q1Btns[0].click();
            console.log('Player 1 answered Q1.');
        } else {
            console.log('No answer buttons found!');
        }

        // Wait and advance depending on mode
        if (modeValue === 'teacher-paced') {
            const nextQBtn = await pageHost.waitForSelector('#btn-next-question:not(.qg-hidden)', { state: 'visible', timeout: 15000 }).catch(() => null);
            if (nextQBtn) {
                console.log('Teacher-paced: Clicking next question');
                await nextQBtn.click();
            } else {
                console.log('Teacher-paced: Missing Next button');
            }
        } else {
            // student-paced or automatic
            await delay(5000);
        }

        await delay(3000); // Give player time to transition

        console.log('Waiting for Q2');
        const q2Text = await pagePlayer1.textContent('#sv-question');
        const p1FillWidth2 = await pagePlayer1.evaluate(() => document.getElementById('sv-timer-fill').style.width);
        console.log(`Player sees Q2: ${q2Text.substring(0, 30).trim()}`);
        console.log(`Player Q2 Timer Fill Width: ${p1FillWidth2}`);

        // Check if player buttons are disabled
        const isBtnDisabled = await pagePlayer1.evaluate(() => document.querySelector('#sv-answers .qg-answer-btn')?.disabled);
        console.log(`Player Q2 Answer button disabled? ${isBtnDisabled}`);

        console.log(`Test for ${modeValue} finished.`);
    } catch (e) {
        console.error(`Error in ${modeValue}:`, e);
    } finally {
        await browser.close();
    }
}

async function runAll() {
    await testMode('automatic');
    await testMode('student-paced');
    await testMode('teacher-paced');
}

runAll();
