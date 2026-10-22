// The app version must match in version.json, the app-version meta tag
// and the ?v= on styles.css / app.js (tools/bump-version.py keeps them in step).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const json = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).version;
const meta = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
const assets = [...html.matchAll(/(styles\.css|app\.js)\?v=([0-9.]+)/g)].map(m => m[2]);
let bad = 0;
const ok = (c, m) => { if (!c) bad++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
ok(meta === json, `app-version meta (${meta}) matches version.json (${json})`);
ok(assets.length === 2 && assets.every(v => v === json), `styles.css and app.js ?v= match (${assets.join(', ')})`);
console.log(bad ? bad + ' FAILED' : 'ALL PASS');
if (bad) process.exitCode = 1;
