const { serverState, requests, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111';
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const { page, errors } = await setup(browser, { ...devices['iPhone 13'], colorScheme: 'dark' });
  page.on('dialog', d => d.accept());
  await page.goto(url); await page.waitForTimeout(1800);
  await page.click('[data-tab-button="account"]'); await page.waitForTimeout(700);
  const text = sel => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
  const tile = id => page.locator(`#shopGrid [data-item="${id}"] .shop-action`);
  const mine = () => serverState.cards.find(c => c.user_id === ME) || {};
  assert(await page.isVisible('#shopSection') && await text('#shopBalance') === '1,240', 'shop shows balance');
  assert(await page.locator('#myCoinsButton .coin-icon').count() === 1 && await page.evaluate(async () => (await fetch('icons/coin.svg')).ok), 'tiles coin icon shown');
  await page.click('#shopSection summary'); await page.waitForTimeout(200);
  assert(await text('#shopKinds .active') === 'Icons', 'icons first');
  assert(await tile('icon_crown').textContent() === '300', 'price shown');
  assert(await tile('icon_trophy').isDisabled() && (await tile('icon_trophy').textContent()) === '🔒 On Fire Silver', 'badge item locked: ' + await tile('icon_trophy').textContent());
  await page.screenshot({ path: out + '-icons.png' });
  // Buy and use an icon
  await tile('icon_crown').click(); await page.waitForTimeout(700);
  assert(serverState.purchases.includes('icon_crown'), 'bought through buy_item');
  assert(await text('#shopBalance') === '940' && await text('#myCoinsButton') === '940', 'balance goes down');
  assert((await text('#shopStatus')).includes('You bought Crown'), 'bought message');
  assert(await tile('icon_crown').textContent() === 'Use', 'bought item can be used');
  await tile('icon_crown').click(); await page.waitForTimeout(500);
  assert(mine().icon === '👑' && await text('#myCardIcon') === '👑', 'icon in use on card');
  assert(await tile('icon_crown').textContent() === 'In use', 'shows in use');
  // Frames: badge unlock, buying, too expensive, removing
  await page.click('[data-shop-kind="frame"]'); await page.waitForTimeout(150);
  assert(await tile('frame_crown').textContent() === 'Use', 'badge-unlocked frame is free to use');
  await tile('frame_crown').click(); await page.waitForTimeout(500);
  assert(mine().frame === 'frame_crown' && await page.getAttribute('#myCardIcon', 'data-frame') === 'crown', 'frame on card');
  await tile('frame_rainbow').click(); await page.waitForTimeout(300);
  assert((await text('#shopStatus')) === 'You need 60 more coins for Rainbow frame.' && !serverState.purchases.includes('frame_rainbow'), 'too expensive: ' + await text('#shopStatus'));
  await tile('frame_crown').click(); await page.waitForTimeout(500);
  assert(mine().frame === null && !(await page.getAttribute('#myCardIcon', 'data-frame')), 'tap In use to take a frame off');
  // Title and name color
  await page.click('[data-shop-kind="title"]'); await tile('title_champ').click(); await page.waitForTimeout(500);
  assert(await text('#myCardTitle') === 'Champion' && mine().title === 'title_champ', 'title on card');
  await page.click('[data-shop-kind="name_color"]'); await tile('name_mint').click(); await page.waitForTimeout(700);
  await tile('name_mint').click(); await page.waitForTimeout(500);
  assert(await page.getAttribute('#accountName', 'data-name-color') === 'mint' && await text('#shopBalance') === '740', 'name color bought and used');
  await page.screenshot({ path: out + '-card.png', fullPage: true });
  // Bought icons appear when editing the card; saving keeps shop items
  await page.click('#editCardButton'); await page.waitForTimeout(200);
  assert(await page.locator('#iconChoices .shop-icon[data-icon="👑"]').count() === 1, 'bought icon in edit window');
  await page.fill('#cardBioInput', 'shopping spree'); await page.click('#saveCardButton'); await page.waitForTimeout(500);
  assert(mine().icon === '👑' && mine().title === 'title_champ' && mine().name_color === 'name_mint' && mine().bio === 'shopping spree', 'editing keeps shop items ' + JSON.stringify(mine()));
  // Someone else's items
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(400);
  await page.click('#openJoinServerButton'); await page.fill('#joinCodeInput', 'JOIN42'); await page.click('#joinServerButton'); await page.waitForTimeout(1200);
  await page.click('[data-social-panel="members"]'); await page.waitForTimeout(200);
  const ethan = page.locator('#serverMembers .player-link', { hasText: '@ethan' });
  assert(await ethan.getAttribute('data-name-color') === 'mint' && await ethan.locator('.avatar').getAttribute('data-frame') === 'gold', 'their name color and frame in lists');
  await ethan.click(); await page.waitForTimeout(600);
  assert(await text('#playerCardBody .card-title') === 'Wordle Wizard' && await page.getAttribute('#playerCardBody .avatar-xl', 'data-frame') === 'gold', 'their title and frame on card');
  await page.screenshot({ path: out + '-player.png' });
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); server.close();
});
