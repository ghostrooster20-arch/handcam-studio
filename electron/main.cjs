const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'dist');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.glb', 'model/gltf-binary'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.task', 'application/wasm'],
  ['.wasm', 'application/wasm'],
]);

function serveFile(req, res) {
  let rawPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (rawPath === '/phone') rawPath = '/index.html';
  let filePath = path.normalize(path.join(distDir, rawPath === '/' ? 'index.html' : rawPath));
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      filePath = path.join(distDir, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    });
  });
}

let server;
let win;

function createWindow(port) {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'HandCam Studio',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL(`http://127.0.0.1:${port}/index.html?view=desktop`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ not found. Run npm run build before npm run electron.');
  }
  server = http.createServer(serveFile).listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    createWindow(port);
  });
});

app.on('before-quit', () => {
  server?.close();
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && server) createWindow(server.address().port);
});
