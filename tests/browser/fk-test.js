const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
if (process.env.NO_PROFILE) m.tables.profiles.splice(0, 1);  // remove laur's profile
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'] });
  await page.goto(url); await page.waitForTimeout(2000);
  if (process.env.NO_PROFILE) {
    assert(await page.evaluate(() => document.getElementById('usernameModal').classList.contains('open')), 'no username: the username window blocks the app first');
    // Backup check: even if that window were bypassed, saving explains what to do.
    await page.evaluate(() => document.getElementById('usernameModal').classList.remove('open'));
  }
  await page.click('[data-filter="all"]');
  await page.click('.game-card[data-id="krillion"] .result-button'); await page.waitForTimeout(200);
  await page.fill('#resultText', 'Krillion #97 🦐\n290');
  const before = m.requests.filter(r => r.method === 'POST' && r.url.includes('daily_scores')).length;
  await page.click('#saveScoreButton'); await page.waitForTimeout(500);
  const sent = m.requests.filter(r => r.method === 'POST' && r.url.includes('daily_scores')).length - before;
  const status = await page.textContent('#scoreStatus');
  const label = process.env.NO_PROFILE ? 'no username' : process.env.FK_FAIL ? 'database rejects' : 'normal';
  if (process.env.NO_PROFILE) assert(status === 'Choose a username in the Account tab first, then save your result.' && sent === 0, label + ': friendly message, nothing sent (' + status + ', sent ' + sent + ')');
  else if (process.env.FK_FAIL) assert(status === 'Choose a username in the Account tab first, then save your result.' && sent === 1, label + ': raw error replaced (' + status + ')');
  else assert(status === 'Result saved.' && sent === 1, label + ': saves as before (' + status + ')');
  const unexpected = errors.filter(e => !(process.env.FK_FAIL && e.includes('409')));
  assert(unexpected.length === 0, label + ': no unexpected console errors ' + unexpected.join('|'));
  await browser.close(); m.server.close();
});
