const fs = require('fs');
const lines = fs.readFileSync('js/take-test.js', 'utf8').split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
    let l = lines[i].replace(/\/\/.*/, '');
    // Ignore template literal content naively for now
    if (l.includes('`')) continue;
    let open = (l.match(/\{/g) || []).length;
    let close = (l.match(/\}/g) || []).length;
    depth += open - close;
    if (depth < 0) {
        console.log('Negative depth reached at line ' + (i + 1));
        break;
    }
}
console.log('Final depth: ' + depth);
