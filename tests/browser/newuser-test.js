const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
// A brand-new account: no profile, no games yet.
m.tables.profiles.length = 0; m.tables.user_games.length = 0; m.tables.daily_scores.length = 0;
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: 'light' });
  await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(2500);
  const open = await page.evaluate(() => [...document.querySelectorAll('.modal.open')].map(x => x.id));
  assert(open.includes('onboardingModal'), 'new account sees Choose Your Games');
  assert(open.includes('usernameModal'), 'new account is asked for a username');
  assert(await page.$eval('[data-tab-button="account"]', b => b.classList.contains('needs-attention')), 'Account tab shows the attention dot');
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
