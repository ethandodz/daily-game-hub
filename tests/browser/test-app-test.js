// The test copy of the app (dgh-test.pages.dev) uses the test database and
// shows a TEST label; everywhere else uses the real database.
const fs = require('fs'), path = require('path');
const { server, chromium } = require('../helpers/mock.js');
const root = process.argv[2], out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
server.listen(0, async () => {
  const browser = await chromium.launch();
  for (const host of ['https://dgh-test.ethandodz.workers.dev', 'https://claude-app-shell-redesign-dgh-test.ethandodz.workers.dev', 'https://claude-app-shell-redesign.dgh-test.pages.dev', 'https://dgh-test.pages.dev', 'https://ethandodz.github.io', 'https://not-dgh-test.example.com']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const hits = [];
    await page.route(host + '/**', route => {
      let p = new URL(route.request().url()).pathname.replace(/^\/daily-game-hub/, '');
      if (p === '/' || p === '') p = '/index.html';
      const file = path.join(root, decodeURIComponent(p));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    await page.route('https://*.supabase.co/**', route => { hits.push(new URL(route.request().url()).hostname); route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
    await page.goto(host + (host.includes('github') ? '/daily-game-hub/' : '/')); await page.waitForTimeout(800);
    const versusRows = await page.$$eval('#versusGames .play-game', rows => rows.length);
    const r = await page.evaluate(() => ({ url: SUPABASE_URL, key: SUPABASE_KEY, badge: document.querySelector('.test-badge')?.textContent || '', title: document.title, homeName: document.querySelector('meta[name="apple-mobile-web-app-title"]').content }));
    const isTest = /dgh-test\.(\w+\.workers|pages)\.dev/.test(host);
    if (isTest) {
      assert(r.url === 'https://npjppwydmhwympqsyfrl.supabase.co' && r.key.startsWith('sb_publishable_nhPC'), host + ': uses the test database');
      assert(r.badge === 'TEST' && r.title.startsWith('TEST') && r.homeName === 'DGH Test', host + ': TEST label, title and Home Screen name ' + JSON.stringify(r));
      assert(hits.every(h => h === 'npjppwydmhwympqsyfrl.supabase.co'), host + ': never contacts the real database ' + JSON.stringify(hits));
      assert(versusRows === 6, host + ': shows the games still being tested');
      if (host.includes('workers.dev')) await page.screenshot({ path: out + '-test.png' });
    } else {
      assert(versusRows === 1, host + ': only released games (Wordle Duel) ' + versusRows);
      assert(r.url === 'https://ibffwmegxjymmulfgoqu.supabase.co' && !r.badge && r.title === 'Daily Game Hub' && r.homeName === 'Game Hub', host + ': real app unchanged ' + JSON.stringify(r));
    }
    await page.close();
  }
  await browser.close(); server.close();
});
