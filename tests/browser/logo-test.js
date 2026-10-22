const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  for (const [scheme, signedIn] of [['dark', true], ['light', true], ['dark', false]]) {
    const { page, errors, ctx } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: scheme }, signedIn);
    await page.goto(url); await page.waitForTimeout(1500);
    const logo = await page.$eval('.logo', h => ({ text: h.textContent.trim(), icon: h.querySelector('img').naturalWidth, iconH: h.querySelector('img').getBoundingClientRect().height }));
    assert(logo.text === 'Daily Game Hub' && logo.icon > 0 && Math.round(logo.iconH) === 30, `${scheme}${signedIn ? '' : ' signed out'}: header logo loads, no diamond (${JSON.stringify(logo)})`);
    if (!signedIn) assert(await page.$eval('.signed-out-home-icon img', i => i.naturalWidth > 0), 'welcome card shows the tiles logo');
    const head = await page.evaluate(async () => ({
      touch: document.querySelector('link[rel="apple-touch-icon"]').href,
      title: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
      manifest: await (await fetch(document.querySelector('link[rel="manifest"]').href)).json()
    }));
    const touchOk = await page.evaluate(async u => (await fetch(u)).ok, head.touch);
    assert(touchOk && head.title === 'Game Hub' && head.manifest.short_name === 'Game Hub' && head.manifest.icons.length === 2, 'home screen icon, name and manifest load');
    const pad = await page.$eval('.container', c => getComputedStyle(c).paddingTop);
    assert(pad === '22px', 'top spacing: 22px plus the status bar height on iPhone (' + pad + ' here, no status bar in test)');
    await page.screenshot({ path: process.argv[3] + `-${scheme}${signedIn ? '' : '-out'}.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
    assert(errors.length === 0, 'no console errors ' + errors.join('|'));
    await ctx.close();
  }
  await browser.close(); m.server.close();
});
