const m = require('../helpers/mock.js');
const label = process.argv[4];
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, ctx, errors } = await m.setup(browser, { viewport: { width: 1366, height: 860 } });
  await page.goto(url); await page.waitForTimeout(2000);
  const shown = () => page.$$eval('.game-card', cs => cs.filter(c => c.getBoundingClientRect().height > 0).length);
  for (const scenario of ['clean', 'autofill']) {
    if (scenario === 'autofill') await page.$eval('#searchInput', i => { i.value = 'laur@example.com'; });
    // come back to the window, then click Play
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const play = page.locator('.game-card[data-id="wordle"] .play-button');
    const box = await play.boundingBox();
    const popup = ctx.waitForEvent('page', { timeout: 2500 }).catch(() => null);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
    const opened = await popup;
    if (opened) await opened.close();
    await page.waitForTimeout(400);
    const count = await shown();
    console.log(label, scenario.padEnd(9), '| new tab opened:', Boolean(opened), '| games still shown:', count);
    if (label === 'FIXED') assert(Boolean(opened) && count === 4, scenario + ': Play opens the game and the list stays');
  }
  if (label === 'FIXED') assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
