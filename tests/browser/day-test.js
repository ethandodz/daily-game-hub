const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'] });
  await page.clock.install({ time: new Date('2026-10-21T23:58:00') });
  await page.goto(url); await page.waitForTimeout(1500);
  const day1 = await page.textContent('#currentDate');
  let loads = 0; page.on('load', () => loads++);
  // same day: coming back does not reload
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(500);
  assert(loads === 0, 'same day: no reload');
  await page.clock.fastForward('00:05:00'); await page.waitForTimeout(1500);
  // The live refresh may already have reloaded; otherwise coming back does.
  if (loads === 0) { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {}); await page.waitForTimeout(1500); }
  const day2 = await page.textContent('#currentDate');
  assert(loads >= 1 && day1.includes('21') && day2.includes('22'), 'after midnight: reloads onto the new day (' + day1.trim() + ' -> ' + day2.trim() + ', reloads ' + loads + ')');
  // Requests cancelled by the reload itself log "Failed to fetch"; anything else is a real error.
  const unexpected = errors.filter(e => !e.includes('Failed to fetch'));
  assert(unexpected.length === 0, 'no console errors besides requests cancelled by the reload ' + unexpected.join('|'));
  await browser.close(); m.server.close();
});
