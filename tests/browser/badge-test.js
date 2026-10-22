const { setup, server, devices, chromium } = require('../helpers/mock.js');
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const browser = await chromium.launch();
  for (const dev of ['iPhone 13', 'iPhone SE', 'iPhone 15 Pro Max']) {
    const { page, ctx, errors } = await setup(browser, { ...devices[dev], colorScheme: 'dark' });
    await page.goto(`http://localhost:${server.address().port}/`); await page.waitForTimeout(2500);
    await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
    const m = await page.$eval('.game-card[data-id="wordle"]', c => {
      const r = e => c.querySelector(e).getBoundingClientRect();
      return { badge: c.querySelector('.streak-badge').textContent, badgeVisible: r('.streak-badge').width > 0, lineHidden: r('.streak').height === 0,
        nameSize: getComputedStyle(c.querySelector('h3')).fontSize, nameH: Math.round(r('h3').height),
        sameRow: Math.abs(r('.streak-badge').top - r('.favorite-button').top) < 12, card: [Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)] };
    });
    assert(m.badge === '🔥 5' && m.badgeVisible && m.lineHidden && m.sameRow && m.nameSize === '17px' && m.nameH >= 18, dev + ' ' + JSON.stringify(m));
    assert(!(await page.$eval('.game-card[data-id="krillion"] .streak-badge', b => b.getBoundingClientRect().width)), dev + ' no badge when no streak');
    // worst case: 3-digit streak still fits inside the card
    const fit = await page.$eval('.game-card[data-id="wordle"]', c => { c.querySelector('.streak-badge').textContent = '🔥 128'; const cr = c.getBoundingClientRect(), e = c.querySelector('.expand-button').getBoundingClientRect(), i = c.querySelector('.game-icon').getBoundingClientRect(), b = c.querySelector('.streak-badge').getBoundingClientRect(); return { inside: e.right <= cr.right + 1, noOverlap: b.left >= i.right }; });
    assert(fit.inside && fit.noOverlap, dev + ' 3-digit streak fits ' + JSON.stringify(fit));
    await page.$eval('.game-card[data-id="wordle"] .streak-badge', b => b.textContent = '🔥 5');
    await page.screenshot({ path: `${process.argv[3]}-${dev.replace(/ /g, '')}.png` });
    if (dev === 'iPhone 13') {
      await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(300);
      const ex = await page.$eval('.game-card[data-id="wordle"]', c => ({ line: c.querySelector('.streak').textContent, lineVisible: c.querySelector('.streak').getBoundingClientRect().height > 0, badgeHidden: c.querySelector('.streak-badge').getBoundingClientRect().width === 0 }));
      assert(ex.line === '🔥 5 days' && ex.lineVisible && ex.badgeHidden, 'expanded shows full streak line ' + JSON.stringify(ex));
      await page.screenshot({ path: `${process.argv[3]}-expanded.png` });
    }
    assert(errors.length === 0, dev + ' no console errors');
    await ctx.close();
  }
  await browser.close(); server.close();
});
