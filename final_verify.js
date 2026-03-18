const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });

    // 1. Teacher Dashboard
    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto('http://127.0.0.1:8081/test-builder.html');

    // Clear state
    await teacherPage.evaluate(() => localStorage.clear());
    await teacherPage.reload();

    // Create a simple test
    await teacherPage.fill('#test-title', 'Final Verification Test');
    await teacherPage.click('#btn-add-question');
    await teacherPage.selectOption('.question-type-select', 'multiple-choice');
    await teacherPage.fill('.question-prompt-input', 'Is this working?');
    await teacherPage.fill('.mc-option-input[data-index="0"]', 'Yes');
    await teacherPage.fill('.mc-option-input[data-index="1"]', 'No');

    // Share the test
    await teacherPage.click('#btn-share');
    await teacherPage.waitForSelector('#share-code-display:not(:has-text("......"))', { timeout: 10000 });
    const shareCode = (await teacherPage.textContent('#share-code-display')).trim();
    console.log('Share Code:', shareCode);

    // Close share modal
    await teacherPage.click('#btn-close-share');

    // 2. Student Player
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await studentPage.goto(`http://127.0.0.1:8081/take-test.html?code=${shareCode}`);

    // Identify
    await studentPage.fill('#student-name', 'Verification Student');
    await studentPage.selectOption('#student-group', '3A');
    await studentPage.click('#btn-start-test');

    // Answer
    await studentPage.click('.tt-mc-option[data-idx="0"]');
    await studentPage.click('#btn-next');

    // Submit
    await studentPage.click('#btn-submit-test');
    await studentPage.waitForSelector('.tt-results-screen', { timeout: 10000 });
    console.log('Student submitted successfully');

    // 3. Verify Teacher Badge and Responses
    await teacherPage.bringToFront();
    // Wait for badge to update (fix ensures it starts automatically)
    await teacherPage.waitForFunction(() => {
        const badge = document.getElementById('response-count-badge');
        return badge && badge.textContent === '1';
    }, { timeout: 10000 });
    console.log('Teacher badge updated to 1!');

    // Open responses and take screenshot
    await teacherPage.click('#btn-responses');
    await teacherPage.waitForSelector('#responses-table', { timeout: 5000 });
    await teacherPage.screenshot({ path: 'final_proof_teacher.png' });

    await browser.close();
    console.log('Final verification complete!');
})();
