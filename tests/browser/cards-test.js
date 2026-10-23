const { serverState, requests, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const { page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(1800);
    await page.click('[data-tab-button="account"]'); await page.waitForTimeout(600);
    const text = sel => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
    if (scheme === 'dark') {
      // My card
      assert(await text('#accountName') === '@laur', 'card shows username');
      assert(await text('#myCardIcon') === 'L', 'no card yet: first letter as icon');
      assert(await text('#myCardStats') === '214played👑 31wins🔥 12best streak', 'card stats: ' + await text('#myCardStats'));
      assert((await text('#myCardMeta')).includes('Since Jun 2026'), 'member since: ' + await text('#myCardMeta'));
      assert(!(await page.isVisible('#usernameInput')) && !(await page.isVisible('#signOutButton')), 'settings tucked away');
      // Settings sheet
      await page.click('#openSettingsButton'); await page.waitForTimeout(200);
      assert(await page.isVisible('#usernameInput') && await page.isVisible('#signOutButton') && (await text('#accountEmail')) === 'test@example.com', 'settings sheet: email, username, sign out');
      assert(!(await page.isVisible('#feedbackForm')), 'feedback starts folded');
      await page.click('#feedbackSection summary'); await page.waitForTimeout(150);
      assert(await page.isVisible('#feedbackForm'), 'feedback opens in settings');
      await page.screenshot({ path: out + '-settings.png' });
      await page.click('[data-close="settingsModal"]');
      // Edit card
      await page.click('#editCardButton'); await page.waitForTimeout(200);
      assert(await page.locator('#iconChoices .selected').textContent() === '🦊', 'edit: default icon picked');
      await page.click('#iconChoices [data-icon="🐙"]'); await page.click('#colorChoices [data-color="pink"]');
      await page.fill('#cardBioInput', 'Krillion or bust 🦐');
      assert(await text('#cardBioCount') === '19/60', 'bio counter: ' + await text('#cardBioCount'));
      await page.selectOption('#cardFavoriteInput', 'krillion');
      await page.screenshot({ path: out + '-edit.png' });
      await page.click('#saveCardButton'); await page.waitForTimeout(500);
      const saved = serverState.cards.find(c => c.user_id === '11111111-1111-1111-1111-111111111111');
      assert(saved && saved.icon === '🐙' && saved.color === 'pink' && saved.bio === 'Krillion or bust 🦐' && saved.favorite_game === 'krillion', 'edit: saved ' + JSON.stringify(saved));
      assert(!(await page.evaluate(() => document.getElementById('editCardModal').classList.contains('open'))), 'edit: window closes');
      assert(await text('#myCardIcon') === '🐙' && await page.getAttribute('#accountSection', 'data-color') === 'pink', 'card shows new icon and color');
      assert(await text('#myCardBio') === 'Krillion or bust 🦐' && (await text('#myCardMeta')).startsWith('Fav: Krillion'), 'card shows bio and favorite');
    }
    await page.screenshot({ path: out + '-' + scheme + '-account.png' });
    // Tap a player in a server
    if (scheme === 'dark') {
      await page.click('[data-tab-button="social"]'); await page.waitForTimeout(400);
      await page.click('#openJoinServerButton');
      await page.fill('#joinCodeInput', 'JOIN42'); await page.click('#joinServerButton'); await page.waitForTimeout(1200);
    } else {
      await page.click('[data-tab-button="social"]'); await page.waitForTimeout(1200);
    }
    await page.click('[data-social-panel="members"]'); await page.waitForTimeout(200);
    const ethan = page.locator('#serverMembers .player-link', { hasText: '@ethan' });
    assert(await ethan.locator('.avatar').textContent() === '🐸', 'member list shows icon');
    const me = page.locator('#serverMembers .player-link', { hasText: '@laur' });
    assert(await me.locator('.avatar').textContent() === '🐙', 'my icon in member list');
    await ethan.click(); await page.waitForTimeout(500);
    assert(await page.isVisible('#playerCardModal'), 'tap a member opens their card');
    const card = await text('#playerCardBody');
    assert(card.includes('@ethan') && card.includes('purple group first, always') && card.includes('Fav: Connections') && card.includes('188played'), 'their card: ' + card);
    assert(card.includes('Head to head in your servers: you 31 · ethan 24'), 'head to head shown');
    await page.screenshot({ path: out + '-' + scheme + '-player.png' });
    await page.waitForTimeout(350);
    const fit = await page.evaluate(() => { const c = document.querySelector('#playerCardModal .modal-card').getBoundingClientRect(), a = document.querySelector('#playerCardBody .avatar').getBoundingClientRect(), n = document.querySelector('#playerCardBody .card-name').getBoundingClientRect(); return { inside: c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight && c.right <= innerWidth, iconBesideName: a.right <= n.left && Math.abs(a.top - n.top) < 40, round: getComputedStyle(document.querySelector('#playerCardModal .modal-card')).borderBottomLeftRadius, coinsUnderName: Math.abs(document.querySelector('#playerCardBody .coins-pill').getBoundingClientRect().left - n.left) <= 1 }; });
    assert(fit.inside && fit.iconBesideName && fit.round === '22px' && fit.coinsUnderName, 'their whole card fits on screen, laid out like yours ' + JSON.stringify(fit));
    await page.mouse.click(8, 8); await page.waitForTimeout(200);
    assert(!(await page.isVisible('#playerCardModal')), 'tapping outside closes their card');
    // board row: tapping a name opens the card without opening the row
    await page.click('[data-social-panel="today"]'); await page.waitForTimeout(300);
    if (!(await page.locator('#serverBoard .board-row:visible').count())) { await page.click('#serverBoard .board-game-header'); await page.waitForTimeout(200); }
    await page.screenshot({ path: out + '-' + scheme + '-board.png' });
    const row = page.locator('#serverBoard .board-row:visible').first();
    assert(await row.count() === 1, 'board has a visible row');
    if (await row.count()) {
      await row.locator('.player-link').click(); await page.waitForTimeout(300);
      assert(await page.isVisible('#playerCardModal') && !(await row.evaluate(r => r.open)), 'board name opens card, row stays closed');
      await page.click('[data-close="playerCardModal"]');
    }
    assert(errors.length === 0, 'no console errors ' + errors.join('|'));
    await ctx.close();
  }
  await browser.close(); server.close();
});
