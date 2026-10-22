const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.tables.profiles.splice(0, 1);
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'] });
  await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(2000);
  await page.click('#welcomeSignOutButton'); await page.waitForTimeout(400);
  assert(!(await page.isVisible('#usernameModal .modal-card')) && await page.isVisible('#signedOutHome'), 'Sign out from the window works');
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
