const fs = require('fs');
const https = require('https');
const getUrl = (family) => {
    return new Promise(resolve => {
        https.get({
            hostname: 'fonts.googleapis.com',
            path: '/css?family=' + family.replace(/ /g, '+'),
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; U; Android 2.2)' }
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => {
                const m = d.match(/url\(([^)]+\.ttf)\)/);
                resolve('"' + family + '": "' + (m ? m[1] : 'not found') + '"');
            });
        });
    });
};
Promise.all([
    getUrl('Fredoka One'),
    getUrl('Baloo 2'),
    getUrl('Bangers'),
    getUrl('Comic Neue'),
    getUrl('Bubblegum Sans'),
    getUrl('Patrick Hand')
]).then(res => {
    fs.writeFileSync('fonts.json', '{' + res.join(',') + '}');
});
