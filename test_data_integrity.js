
const window = {};
global.window = window;

const fs = require('fs');
const path = require('path');

try {
    const dataContent = fs.readFileSync(path.join(__dirname, 'js/data.js'), 'utf8');
    eval(dataContent);
    
    if (!window.vocabularyBank || !Array.isArray(window.vocabularyBank)) {
        console.error("vocabularyBank is not defined or not an array");
        process.exit(1);
    }
    
    console.log(`vocabularyBank loaded successfully with ${window.vocabularyBank.length} items.`);
    
    // Check for the items around the fix
    const wool = window.vocabularyBank.find(w => w.word === 'Wool');
    const costume = window.vocabularyBank.find(w => w.word === 'Costume');
    
    if (!wool) console.error("Wool not found");
    if (!costume) console.error("Costume not found");
    
    if (wool && costume) {
        console.log("Found Wool and Costume, verifying fix.");
    }

} catch (e) {
    console.error("Error loading data.js:", e);
    process.exit(1);
}
