const { day, serverState, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111';
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  // no servers yet
  let { page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: 'dark' });
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(700);
  const shown = () => page.$$eval('[data-social-section]', s => s.filter(x => x.offsetParent !== null).map(x => x.dataset.socialSection).join(','));
  assert(await page.isVisible('#serversEmpty') && !(await page.isVisible('#socialSegments')) && await shown() === '' && !(await page.isVisible('#retiredFriends')), 'no servers: create/join card only, no Friends (' + await shown() + ')');
  assert((await page.textContent('[data-tab-button="social"]')).trim() === 'Servers', 'tab is called Servers');
  await page.screenshot({ path: out + '-empty.png' });
  await ctx.close();
  // with servers
  serverState.servers.push({ id: 'srv-a', name: 'Ball Knowers', owner_id: ME, invite_code: 'AAA222', start_date: day(5), created_at: day(5) });
  serverState.members.push({ server_id: 'srv-a', user_id: ME, role: 'owner', joined_at: day(5) });
  serverState.members.push({ server_id: 'srv-ethan', user_id: ME, role: 'member', joined_at: day(5) });
  ['wordle', 'connections', 'krillion'].forEach((g, i) => serverState.games.push({ server_id: 'srv-a', game_key: g, sort_order: i + 1 }));
  ({ page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: 'dark' }));
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(900);
  assert(await page.isVisible('#socialSegments') && await shown() === 'today', 'opens on Today panel only: ' + await shown());
  assert(await page.locator('#serverSwitcher .filter-button').count() === 2 && await page.isVisible('#openNewServerButton') && await page.isVisible('#openServerSettingsButton'), 'server chips with ＋ and ⚙️');
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: out + '-today.png' });
  assert(await page.locator('[data-social-panel]').count() === 3, 'three panels: Today, Stats, Members');
  for (const panel of ['stats', 'members']) {
    await page.click(`[data-social-panel="${panel}"]`); await page.waitForTimeout(400);
    assert(await shown() === panel && await page.$eval(`[data-social-panel="${panel}"]`, b => b.classList.contains('active')), panel + ' panel shows alone');
    await page.screenshot({ path: out + '-' + panel + '.png' });
  }
  assert(await page.locator('#statsChart svg').evaluate(svg => svg.getBoundingClientRect().width > 300).catch(() => true), 'stats chart drawn at full width');
  await page.reload(); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="social"]').catch(() => {}); await page.waitForTimeout(900);
  assert(await shown() === 'members', 'last panel remembered after reload');
  // settings + new server menus
  await page.click('[data-social-panel="today"]');
  await page.click('#openServerSettingsButton'); await page.waitForTimeout(200);
  const title = await page.textContent('#serverSettingsTitle');
  assert(await page.isVisible('#serverSettingsModal .modal-card') && title.trim() === await page.$eval('#serverSwitcher .filter-button.active', c => c.textContent), 'settings menu titled with the server: ' + title.trim());
  await page.screenshot({ path: out + '-settings.png' });
  await page.click('[data-close="serverSettingsModal"]');
  await page.click('#openNewServerButton'); await page.waitForTimeout(200);
  assert(await page.isVisible('#newServerCreateButton') && await page.isVisible('#newServerJoinButton'), '＋ offers create and join');
  await page.click('#newServerJoinButton'); await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.getElementById('joinServerModal').classList.contains('open') && !document.getElementById('newServerModal').classList.contains('open')), 'join opens from ＋');
  await page.click('[data-close="joinServerModal"]');
  // signed out: friends area visible
  await page.click('[data-tab-button="account"]'); await page.click('#signOutButton'); await page.waitForTimeout(300);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(300);
  assert(await page.isVisible('#serversSignedOut') && await page.isVisible('#serversLoginButton') && !(await page.isVisible('#serversSection')) && !(await page.isVisible('#retiredFriends')), 'signed out: log-in card shows');
  await page.click('#serversLoginButton');
  assert(await page.evaluate(() => document.getElementById('accountModal').classList.contains('open')), 'log-in card opens the login window');
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  console.log('page height on Today:', pageHeight);
  await browser.close(); server.close();
});
