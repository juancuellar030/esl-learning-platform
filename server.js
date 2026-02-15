const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;
const baseDir = __dirname;

http.createServer((req, res) => {
  let filePath = path.join(baseDir, req.url === '/' ? 'index.html' : req.url);
  // Remove query string
  filePath = filePath.split('?')[0];

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js': contentType = 'text/javascript'; break;
    case '.css': contentType = 'text/css'; break;
    case '.json': contentType = 'application/json'; break;
    case '.png': contentType = 'image/png'; break;
    case '.jpg': contentType = 'image/jpg'; break;
    case '.svg': contentType = 'image/svg+xml'; break;
    case '.wav': contentType = 'audio/wav'; break;
    case '.mp3': contentType = 'audio/mpeg'; break;
    case '.woff': contentType = 'application/font-woff'; break;
    case '.woff2': contentType = 'application/font-woff2'; break;
    case '.ttf': contentType = 'application/font-ttf'; break;
    case '.eot': contentType = 'application/vnd.ms-fontobject'; break;
    case '.otf': contentType = 'application/font-otf'; break;
    case '.wasm': contentType = 'application/wasm'; break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        // Check if this is a missing JS file in the excalidraw directory
        if (filePath.includes('excalidraw') && extname === '.js') {
          console.log(`Serving dummy module for missing file: ${filePath}`);
          res.writeHead(200, { 'Content-Type': 'text/javascript' });
          res.end('export default function() {}; export const Workbox = class { register() {} };', 'utf-8');
          return;
        }

        // try to see if it is a directory and has index.html
        if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.writeHead(404);
              res.end('404 File Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(data, 'utf-8');
            }
          });
        } else {
          res.writeHead(404);
          res.end('404 File Not Found');
        }
      } else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}).listen(port);
console.log(`Server running at http://127.0.0.1:${port}/`);
