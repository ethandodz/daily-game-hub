const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.tables.profiles.splice(0, 1);   // laur has no profile yet
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'] });
  await page.goto(url); await page.waitForTimeout(2000);
  const open = id => page.evaluate(i => document.getElementById(i).classList.contains('open'), id);
  assert(await open('usernameModal'), 'no username: window opens');
  assert(await page.locator('#usernameModal .close-button').count() === 0, 'it has no close button (required)');
  const top = await page.evaluate(() => { const c = document.querySelector('#usernameModal .modal-card').getBoundingClientRect(); return !!document.elementFromPoint(c.left + c.width / 2, c.top + 20).closest('#usernameModal'); });
  assert(top, 'it sits above the Choose Your Games window');
  await page.screenshot({ path: process.argv[3] + '-username.png' });
  await page.fill('#welcomeUsernameInput', 'No!'); await page.click('#welcomeUsernameSaveButton'); await page.waitForTimeout(200);
  assert((await page.textContent('#welcomeUsernameStatus')).startsWith('Use 3–24'), 'invalid name explained');
  await page.fill('#welcomeUsernameInput', 'ethan'); await page.click('#welcomeUsernameSaveButton'); await page.waitForTimeout(500);
  assert(await page.textContent('#welcomeUsernameStatus') === 'That username is already taken.' && await open('usernameModal'), 'taken name explained, window stays');
  await page.fill('#welcomeUsernameInput', 'Laur_22'); await page.press('#welcomeUsernameInput', 'Enter'); await page.waitForTimeout(800);
  assert(!(await open('usernameModal')) && m.tables.profiles.some(x => x.username === 'laur_22'), 'saved (lowercased), window closes');
  assert(!(await page.$eval('[data-tab-button="account"]', b => b.classList.contains('needs-attention'))), 'account dot cleared');
  // saving a result now works
  await page.evaluate(() => document.querySelectorAll('.modal.open').forEach(x => x.classList.remove('open')));
  await page.click('[data-filter="all"]');
  await m.openCard(page, 'krillion'); await page.click('.game-card[data-id="krillion"] .result-button'); await page.fill('#resultText', 'Krillion #97 🦐\n290'); await page.click('#saveScoreButton'); await page.waitForTimeout(500);
  assert(await page.textContent('#scoreStatus') === 'Result saved.', 'can save a result afterwards');
  // Account tab button still works
  await page.evaluate(() => document.querySelectorAll('.modal.open').forEach(x => x.classList.remove('open')));
  await page.click('[data-tab-button="account"]'); await page.click('#openSettingsButton'); await page.fill('#usernameInput', 'laur_23'); await page.click('#saveProfileButton'); await page.waitForTimeout(500);
  assert(await page.textContent('#profileStatus') === 'Username saved.' && m.tables.profiles.some(x => x.username === 'laur_23'), 'Account tab username change still works');
  assert(errors.filter(e => !e.includes('409')).length === 0, 'no unexpected console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
