// Play tab: Word Race, Trivia Showdown and Higher or Lower, start to finish.
const m = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const FRIEND = '22222222-2222-2222-2222-222222222222';
const ME = m.ME;
const wait = ms => new Promise(r => setTimeout(r, ms));
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: process.env.SCHEME || 'light' });
  page.on('dialog', d => d.accept());
  m.serverState.members.push({ server_id: 'srv-ethan', user_id: ME, role: 'member', joined_at: '2026-10-02' });
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="play"]'); await page.waitForTimeout(700);

  // The real app only shows released games
  const rows = () => page.$$eval('#versusGames .play-game b', bs => bs.map(b => b.firstChild.textContent.trim()));
  assert((await rows()).join(',') === 'Wordle Duel', 'real app: new games stay hidden until released');
  // Act like the test app
  await page.evaluate(() => { playableGames = () => VERSUS_GAMES; renderPlayGames(); });
  assert((await rows()).join(',') === 'Wordle Duel,Word Race,Trivia Showdown,Higher or Lower', 'test app: all four versus games listed');
  assert(await page.$$eval('#versusGames .play-tag.testing', t => t.length) === 3, 'unreleased games are marked TESTING');
  await page.screenshot({ path: out + '-list.png' });

  // ---------- Word Race (from a friend's face) ----------
  await page.click(`.friend-chip[data-friend="${FRIEND}"]`); await page.waitForTimeout(300);
  assert((await page.textContent('#challengeTitle')).includes('@ethan'), 'tapping a friend asks which game');
  assert(await page.$$eval('#challengeList .challenge-row', r => r.length) === 4, 'game picker lists the four games');
  await page.click('#challengeList .challenge-row[data-game="word_race"]'); await page.waitForTimeout(700);
  assert(await page.isVisible('#versusScreen') && (await page.textContent('#versusTitle')) === 'Word Race vs @ethan', 'Word Race screen opens');
  assert((await page.textContent('#versusStartButton')).includes('2:00'), 'rules first, then Start');
  await page.click('#versusStartButton'); await page.waitForTimeout(600);
  assert(await page.$$eval('.race-tile', t => t.map(x => x.textContent).sort().join('')) === 'ADEEGNRRS', 'nine letter tiles');
  assert((await page.textContent('#raceClock')).match(/^[12]:\d\d$/), 'the clock is running');
  await page.keyboard.type('garden'); await page.waitForTimeout(100);
  assert((await page.textContent('#raceWord')) === 'GARDEN', 'typing picks the letters');
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert((await page.textContent('#raceFound')).includes('GARDEN+7') && (await page.textContent('#versusScore')) === '7 pts', 'word scores 7 points');
  for (const letter of 'sgr') await page.keyboard.press(letter);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert((await page.textContent('#raceMessage')).includes("isn't in the word list"), 'made-up words are turned away');
  await page.click('#raceWord');
  await page.keyboard.type('dense'); await page.click('.race-action[data-race="enter"]'); await page.waitForTimeout(400);
  assert((await page.textContent('#versusScore')) === '11 pts', 'tapping Enter works too');
  await page.click('.race-action[data-race="shuffle"]');
  await page.screenshot({ path: out + '-race.png' });
  const race = m.serverState.duels.find(d => d.game === 'word_race');
  race.plays[ME].finished = true;
  await page.evaluate(() => { raceDeadline = Date.now(); }); await page.waitForTimeout(400);
  assert((await page.textContent('#raceMessage')) === "Time's up!", "time's up at 0:00");
  await page.waitForTimeout(3800);
  assert((await page.textContent('#versusBody')).includes('Waiting for @ethan'), 'then waits for the other player');
  race.status = 'active'; race.plays[FRIEND] = { started: 1, finished: true, score: 3, correct: 0, time_ms: 0, moves: [{ word: 'red', points: 1 }, { word: 'sea', points: 1 }, { word: 'ear', points: 1 }] };
  await page.waitForTimeout(4600);
  assert((await page.textContent('#versusResult, .versus-result')).includes('You win!'), 'result shows when they finish');
  await page.waitForTimeout(800);
  const raceText = await page.textContent('.versus-result');
  assert(raceText.includes('GARDENERS') && raceText.includes('RED') && raceText.includes('Words nobody found'), 'results: both word lists and missed words');
  await page.screenshot({ path: out + '-race-result.png' });
  await page.click('#versusCloseButton'); await page.waitForTimeout(500);

  // ---------- Trivia (from the Games list) ----------
  await page.click('#versusGames [data-game="trivia"]'); await page.waitForTimeout(300);
  assert((await page.textContent('#challengeTitle')).includes('Trivia Showdown'), 'Challenge button picks the game');
  await page.click(`#challengeList .challenge-row[data-friend="${FRIEND}"]`); await page.waitForTimeout(700);
  await page.click('#versusStartButton'); await page.waitForTimeout(700);
  assert((await page.textContent('.trivia-question')) === 'Question number 1?' && await page.$$eval('.round-choice', c => c.length) === 4, 'question with four answers');
  await page.screenshot({ path: out + '-trivia.png' });
  await page.click('.round-choice[data-choice="1"]'); await page.waitForTimeout(300);
  assert(await page.$eval('.round-choice[data-choice="1"]', b => b.classList.contains('right')) && (await page.textContent('#roundMessage')).startsWith('Right!'), 'right answer turns green');
  await page.waitForTimeout(1300);
  assert((await page.textContent('.round-top')).includes('Question 2 of 10'), 'next question comes up');
  await page.click('.round-choice[data-choice="0"]'); await page.waitForTimeout(300);
  assert(await page.$eval('.round-choice[data-choice="0"]', b => b.classList.contains('wrong')) && await page.$eval('.round-choice[data-choice="2"]', b => b.classList.contains('right')), 'wrong answer shows the right one');
  for (let n = 3; n <= 10; n += 1) {
    await page.waitForSelector(`.trivia-question:text("Question number ${n}?")`, { timeout: 4000 });
    await page.click(`.round-choice[data-choice="${n % 4}"]`);
  }
  await page.waitForTimeout(1800);
  assert((await page.textContent('#versusBody')).includes('9 right'), 'after 10 questions you wait for them');
  const trivia = m.serverState.duels.find(d => d.game === 'trivia');
  trivia.status = 'active'; trivia.plays[FRIEND] = { started: 1, finished: true, score: 4, correct: 4, time_ms: 0, moves: [{ correct: true }, { correct: true }] };
  await page.waitForTimeout(4600); await page.waitForTimeout(500);
  assert(await page.$$eval('.trivia-result-row', r => r.length) === 10, 'results list all 10 questions');
  assert(await page.$$eval('.trivia-mark.point', r => r.length) >= 9, 'faster right answer gets the point');
  await page.screenshot({ path: out + '-trivia-result.png' });
  await page.click('#versusCloseButton'); await page.waitForTimeout(500);

  // ---------- Higher or Lower ----------
  await page.click(`.friend-chip[data-friend="${FRIEND}"]`); await page.waitForTimeout(300);
  await page.click('#challengeList .challenge-row[data-game="higher_lower"]'); await page.waitForTimeout(700);
  await page.click('#versusStartButton'); await page.waitForTimeout(700);
  assert((await page.textContent('.hl-prompt')).includes('more people') && (await page.$$eval('.hl-card b', b => b.map(x => x.textContent).join(' or '))) === 'United States or India', 'two choices and the question');
  await page.screenshot({ path: out + '-hl.png' });
  await page.click('.hl-card[data-choice="1"]'); await page.waitForTimeout(400);
  assert((await page.textContent('.hl-card[data-choice="1"] .hl-value')) === '1.43 billion people', 'shows the real numbers after a pick');
  await page.screenshot({ path: out + '-hl-answer.png' });
  await page.waitForTimeout(1500);
  assert((await page.textContent('.round-top')).includes('Streak 1'), 'streak goes up');
  await page.click('.hl-card[data-choice="1"]'); await page.waitForTimeout(400);
  assert((await page.textContent('#roundMessage')).includes('streak ends at 1'), 'a miss ends the streak');
  await page.waitForTimeout(1800);
  const hl = m.serverState.duels.find(d => d.game === 'higher_lower');
  hl.status = 'active'; hl.plays[FRIEND] = { started: 1, finished: true, score: 1, correct: 1, time_ms: 9000, moves: [] };
  await page.waitForTimeout(4600);
  assert((await page.textContent('.versus-result')).includes('You win!'), 'same streak: quicker player wins');
  await page.click('#versusCloseButton'); await page.waitForTimeout(500);

  // ---------- Someone challenges me ----------
  m.serverState.duels.push({ id: 'vs-in', game: 'trivia', challenger: FRIEND, opponent: ME, answer: '', status: 'pending', winner: null, created_at: new Date().toISOString(), finished_at: null, guesses: { [FRIEND]: [], [ME]: [] }, plays: {} });
  await page.evaluate(() => loadPlayTab()); await page.waitForTimeout(600);
  const incoming = await page.textContent('#duelList .duel-row[data-duel="vs-in"]');
  assert(incoming.includes('@ethan challenged you') && incoming.includes('Trivia Showdown'), 'incoming challenge names the game');
  assert((await page.textContent('#duelList')).includes('Word Race · you 11 pts · them 3 pts'), 'finished games show both scores');
  await page.click('#duelList .duel-row[data-duel="vs-in"] [data-action="accept"]'); await page.waitForTimeout(700);
  assert(await page.isVisible('#versusStartButton') && (await page.textContent('#versusTitle')).startsWith('Trivia Showdown'), 'accepting opens the game');
  await page.click('#versusCloseButton'); await page.waitForTimeout(300);

  assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); m.server.close();
});
