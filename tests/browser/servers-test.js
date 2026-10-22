const { serverState, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const { page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: 'dark' });
  let dialogAnswer = null;
  page.on('dialog', d => d.type() === 'prompt' ? d.accept(dialogAnswer) : d.accept());
  await page.goto(url); await page.waitForTimeout(2000);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(600);
  const vis = sel => page.isVisible(sel);
  const activeChip = () => page.$eval('#serverSwitcher .filter-button.active', c => c.textContent);
  const settings = async id => { await page.click('#openServerSettingsButton'); await page.waitForTimeout(150); if (id) await page.click(id); };
  const closeSettings = () => page.click('[data-close="serverSettingsModal"]');
  const openJoin = async () => { await page.click('#openNewServerButton'); await page.click('#newServerJoinButton'); };
  assert(await vis('#serversEmpty') && !(await vis('#serverDetail')), 'no servers: empty message shown');
  // create
  await page.click('#openCreateServerButton'); await page.waitForTimeout(300);
  const pre = await page.$$eval('#createServerGames input:checked', c => c.map(x => x.value));
  assert(pre.join() === 'wordle,connections,worldle,framed', 'create: favorites pre-checked: ' + pre.join());
  await page.click('#createServerButton');
  assert((await page.textContent('#createServerStatus')).includes('name'), 'create: name required');
  await page.fill('#serverNameInput', 'Ball Knowers');
  await page.screenshot({ path: out + '-create.png' });
  await page.click('#createServerButton'); await page.waitForTimeout(800);
  assert(!(await page.evaluate(() => document.getElementById('createServerModal').classList.contains('open'))), 'create: window closes');
  assert(await activeChip() === 'Ball Knowers', 'create: server chip shown and selected');
  assert(/^[A-Z0-9]{6}$/.test((await page.textContent('#serverInviteCode')).trim()), 'create: invite code shown');
  const members = await page.$$eval('#serverMembers .friend-row', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert(members.length === 1 && members[0].includes('@laur (you)') && members[0].includes('Owner'), 'create: you are owner: ' + members.join('|'));
  const games = await page.$$eval('#serverGames .server-game-row', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert(games.length === 4 && games[0].includes('Wordle') && games[0].includes('lower wins'), 'create: games listed with rule: ' + games.join('|'));
  await settings();
  assert(await vis('#deleteServerButton') && await vis('#renameServerButton') && !(await vis('#leaveServerButton')), 'owner settings: owner actions, not Leave');
  await closeSettings();
  assert(await page.locator('#serverSwitcher .filter-button').count() === 1, 'one server: one chip');
  await page.screenshot({ path: out + '-owner.png', fullPage: true });
  // join wrong / right
  await openJoin(); await page.fill('#joinCodeInput', 'NOPE99'); await page.click('#joinServerButton'); await page.waitForTimeout(400);
  assert((await page.textContent('#joinServerStatus')) === 'No server has that invite code.', 'join: wrong code message');
  await page.fill('#joinCodeInput', 'abc'); await page.click('#joinServerButton');
  assert((await page.textContent('#joinServerStatus')).includes('6 letters'), 'join: short code message');
  await page.fill('#joinCodeInput', 'join42'); await page.click('#joinServerButton'); await page.waitForTimeout(900);
  assert(!(await page.evaluate(() => document.getElementById('joinServerModal').classList.contains('open'))), 'join: window closes');
  assert((await page.textContent('#serverStatus')) === 'You joined Work Crew.', 'join: confirmation');
  const chips = await page.$$eval('#serverSwitcher .filter-button', c => c.map(x => x.textContent + (x.classList.contains('active') ? '*' : '')));
  assert(chips.join() === 'Work Crew*,Ball Knowers' || chips.join() === 'Ball Knowers,Work Crew*', 'switcher shows both, joined one selected: ' + chips.join());
  await settings();
  assert(!(await vis('#deleteServerButton')) && !(await vis('#editServerGamesButton')) && await vis('#leaveServerButton') && !(await page.locator('#serverMembers .small-button').count()), 'member settings: Leave only, no Remove buttons');
  await closeSettings();
  const m2 = await page.$$eval('#serverMembers .friend-row', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert(m2.length === 2 && m2[0].includes('@ethan') && m2[0].includes('Owner'), 'joined server members: ' + m2.join('|'));
  await page.screenshot({ path: out + '-member.png', fullPage: true });
  // owner edits games
  await page.click('#serverSwitcher .filter-button:has-text("Ball Knowers")'); await page.waitForTimeout(500);
  await settings('#editServerGamesButton'); await page.waitForTimeout(300);
  await page.uncheck('#serverGamesPicker input[value="framed"]'); await page.check('#serverGamesPicker input[value="krillion"]');
  await page.click('#saveServerGamesButton'); await page.waitForTimeout(700);
  const g2 = await page.$$eval('#serverGames .server-game-row', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert(g2.length === 4 && !g2.some(x => x.includes('Framed')) && g2[3].includes('Krillion') && g2[3].includes('higher wins'), 'edit games: ' + g2.join('|'));
  // rename + reset
  dialogAnswer = 'Ball Knowers FC'; await settings('#renameServerButton'); await page.waitForTimeout(600);
  assert(await activeChip() === 'Ball Knowers FC', 'rename works');
  const oldCode = (await page.textContent('#serverInviteCode')).trim();
  await settings('#resetInviteButton'); await page.waitForTimeout(600);
  assert((await page.textContent('#serverInviteCode')).trim() !== oldCode, 'new invite code shown');
  // leave Work Crew
  await page.click('#serverSwitcher .filter-button:has-text("Work Crew")'); await page.waitForTimeout(500);
  await settings('#leaveServerButton'); await page.waitForTimeout(700);
  assert((await page.textContent('#serverStatus')) === 'You left Work Crew.' && await page.locator('#serverSwitcher .filter-button').count() === 1 && await activeChip() === 'Ball Knowers FC', 'leave: back to remaining server');
  // invite link while signed in
  await page.goto(url + '?join=JOIN42'); await page.waitForTimeout(2500);
  assert(await page.evaluate(() => location.search === ''), 'invite link: code removed from address');
  assert(await page.isVisible('#socialView') && (await page.textContent('#serverStatus')) === 'You joined Work Crew.', 'invite link: joined and on Social');
  // delete own server
  await page.click('#serverSwitcher .filter-button:has-text("Ball Knowers FC")'); await page.waitForTimeout(500);
  await settings('#deleteServerButton'); await page.waitForTimeout(700);
  assert(!serverState.servers.some(x => x.name.startsWith('Ball')) && await activeChip() === 'Work Crew', 'delete: server gone');
  const unexpected = errors.filter(e => !e.includes('status of 400')); assert(unexpected.length === 0 && errors.length <= 1, 'no console errors besides the wrong-code 400: ' + errors.join(' | '));
  await ctx.close();
  // invite link while signed out
  const so = await setup(browser, { ...devices['iPhone 13'] }, false);
  await so.page.goto(url + '?join=JOIN42'); await so.page.waitForTimeout(1500);
  assert(await so.page.evaluate(() => document.getElementById('accountModal').classList.contains('open') && localStorage.getItem('dailyGameHubPendingJoin') === 'JOIN42'), 'signed out: login prompt, invite saved');
  assert((await so.page.textContent('#authStatus')).includes('join the server'), 'signed out: explains why');
  assert(so.errors.length === 0, 'signed out: no console errors ' + so.errors.join(' | '));
  await browser.close(); server.close();
});
