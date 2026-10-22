const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, ctx, errors } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: 'dark' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.slice(0, -1) });
  await page.goto(url); await page.waitForTimeout(2000);
  const clip = t => page.evaluate(x => navigator.clipboard.writeText(x), t);
  const isOpen = id => page.evaluate(i => document.getElementById(i).classList.contains('open'), id);
  const close = () => page.evaluate(() => document.querySelectorAll('.modal.open').forEach(x => x.classList.remove('open')));
  // 1. Wordle share text
  await clip('Wordle 1,951 4/6\n\n⬜🟨⬜⬜⬜\n🟩🟩🟩🟩🟩');
  await page.click('#pasteResultButton'); await page.waitForTimeout(400);
  assert(await isOpen('scoreModal') && (await page.textContent('#scoreTitle')).includes('Wordle'), 'Wordle text opens the Wordle result window');
  assert((await page.inputValue('#resultText')).startsWith('Wordle 1,951 4/6') && await page.textContent('#scoreDetected') === 'Read as: 4 guesses' && await page.inputValue('#numericScore') === '4', 'filled in and score read');
  assert((await page.textContent('#scoreStatus')).startsWith('Pasted as Wordle'), 'says which game it was pasted as');
  await page.screenshot({ path: process.argv[3] + '-wordle.png' });
  await page.click('#saveScoreButton'); await page.waitForTimeout(500);
  const post = JSON.parse(m.requests.filter(r => r.method === 'POST' && r.url.includes('daily_scores')).pop().body);
  assert(post.game_id === 'wordle' && post.numeric_score === 4, 'one tap saves it');
  await close();
  // 2. not a share text
  await clip('had fun today');
  await page.click('#pasteResultButton'); await page.waitForTimeout(300);
  assert(await isOpen('pasteModal') && (await page.textContent('#pasteStatus')).startsWith('Couldn’t tell which game') && await page.isVisible('#pasteGameSelect'), 'unknown text asks which game');
  await page.selectOption('#pasteGameSelect', 'krillion'); await page.click('#pasteContinueButton'); await page.waitForTimeout(300);
  assert(await isOpen('scoreModal') && (await page.textContent('#scoreTitle')).includes('Krillion') && await page.inputValue('#resultText') === 'had fun today', 'picked game opens with the text');
  await close();
  // 3. a game not in the library
  await clip('Size It Up\nOverall Score 330\nhttps://magnitudle.com');
  await page.click('#pasteResultButton'); await page.waitForTimeout(300);
  assert((await page.textContent('#pasteStatus')).includes('isn’t in your games'), 'game not in library explained');
  await close();
  // 4. clipboard blocked: paste box instead
  await page.evaluate(() => { navigator.clipboard.readText = () => Promise.reject(new Error('denied')); });
  await page.click('#pasteResultButton'); await page.waitForTimeout(300);
  assert(await isOpen('pasteModal') && (await page.inputValue('#pasteText')) === '' && !(await page.isVisible('#pasteGameSelect')), 'blocked clipboard: paste box opens');
  await page.fill('#pasteText', 'Krillion #98 🦐\n410'); await page.click('#pasteContinueButton'); await page.waitForTimeout(300);
  assert(await isOpen('scoreModal') && await page.inputValue('#numericScore') === '410', 'pasting into the box detects the game');
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await page.screenshot({ path: process.argv[3] + '-games.png' });
  await close();
  await page.screenshot({ path: process.argv[3] + '-button.png' });
  await browser.close(); m.server.close();
});
