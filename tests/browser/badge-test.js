const { setup, server, devices, chromium, openCard } = require('../helpers/mock.js');
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const browser = await chromium.launch();
  for (const dev of ['iPhone 13', 'iPhone SE', 'iPhone 15 Pro Max']) {
    const { page, ctx, errors } = await setup(browser, { ...devices[dev], colorScheme: 'dark' });
    await page.goto(`http://localhost:${server.address().port}/`); await page.waitForTimeout(2500);
    await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
    // 🔥 bubble on the icon's top-right corner, like an app notification
    const spot = () => page.$eval('.game-card[data-id="wordle"]', c => {
      const r = e => c.querySelector(e).getBoundingClientRect();
      const next = c.nextElementSibling.querySelector('.game-icon').getBoundingClientRect();
      const i = r('.game-icon'), b = r('.streak-badge');
      return { badge: c.querySelector('.streak-badge').textContent, onCorner: b.right > i.right && b.left > i.left + 8 && b.top < i.top + 4 && b.bottom > i.top,
        clearOfNext: b.right <= next.left + 1, nameVisible: r('h3').height > 0 };
    });
    const edges = await page.evaluate(() => { const i = [...document.querySelectorAll('.game-card .game-icon')].slice(0, 4).map(x => x.getBoundingClientRect()); const s = document.querySelector('.search-row').getBoundingClientRect(); return { left: i[0].left - s.left, right: s.right - i[3].right, gaps: [1, 2, 3].map(k => Math.round(i[k].left - i[k - 1].right)) }; });
    assert(Math.abs(edges.left) <= 1 && Math.abs(edges.right) <= 1 && Math.max(...edges.gaps) - Math.min(...edges.gaps) <= 1, dev + ' outer icons line up with the search bar, even spacing ' + JSON.stringify(edges));
    const m = await spot();
    assert(m.badge === '🔥 5' && m.onCorner && m.clearOfNext && m.nameVisible, dev + ' streak bubble on the icon ' + JSON.stringify(m));
    assert(!(await page.$eval('.game-card[data-id="krillion"] .streak-badge', b => b.getBoundingClientRect().width)), dev + ' no bubble when no streak');
    // worst case: 3-digit streak still clear of the next icon
    await page.$eval('.game-card[data-id="wordle"] .streak-badge', b => b.textContent = '🔥 128');
    const wide = await spot();
    assert(wide.onCorner && wide.clearOfNext, dev + ' 3-digit streak fits ' + JSON.stringify(wide));
    await page.$eval('.game-card[data-id="wordle"] .streak-badge', b => b.textContent = '🔥 5');
    await page.screenshot({ path: `${process.argv[3]}-${dev.replace(/ /g, '')}.png` });
    if (dev === 'iPhone 13') {
      await openCard(page, 'wordle');
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
