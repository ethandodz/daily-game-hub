// Links appended by games are removed so every result looks the same.
const { extract } = require('../helpers/extract.js');
const gameCatalog = new Map([['maptap', { name: 'MapTap' }]]);
eval(extract('function cleanResultText(', 'function readGuessFraction(') + '\nglobalThis.clean = cleanResultText;');
let bad = 0;
const t = (label, input, expected) => {
  const got = clean(input);
  const ok = got === expected; if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n   got:      ' + JSON.stringify(got) + '\n   expected: ' + JSON.stringify(expected)));
};
t('Framed: link line removed', 'Framed #1685\n🎥 🟥 🟥 🟥 🟥 🟥 🟥\n\nhttps://framed.wtf', 'Framed #1685\n🎥 🟥 🟥 🟥 🟥 🟥 🟥');
t('GuessList: "Play at:" line removed', 'GuessList (October 21, 2026)\nScore: 130/490\n\n🟥🟨🟩🟨🟥\n\nBest Guess: #78\n\nPlay at: https://playguesslist.com', 'GuessList (October 21, 2026)\nScore: 130/490\n\n🟥🟨🟩🟨🟥\n\nBest Guess: #78');
t('Globle: link and hashtag lines removed', '🌎 Oct 20, 2026 🌍\n🔥 1 | Avg. Guesses: 6.5\n🟧🟨🟥🟥🟥🟩 = 6\n\nhttps://globle-game.com\n#globle', '🌎 Oct 20, 2026 🌍\n🔥 1 | Avg. Guesses: 6.5\n🟧🟨🟥🟥🟥🟩 = 6');
t('MapTap: www link becomes the game name', 'www.maptap.gg October 17\n95🏅 93🏆 93🏆 88🎉 80✨\nFinal score: 878', 'MapTap October 17\n95🏅 93🏆 93🏆 88🎉 80✨\nFinal score: 878');
t('Magnitudle: link with a path removed', 'Size It Up\nOverall Score 330\n\n🟥🟥🟥🟥🟥 96\n🟥🟥⬜⬜⬜ 30\nhttps://magnitudle.com/size-it-up', 'Size It Up\nOverall Score 330\n\n🟥🟥🟥🟥🟥 96\n🟥🟥⬜⬜⬜ 30');
t('Minute Cryptic: tracking link removed', 'Minute Cryptic - 21 October, 2026\n🏋 3 hints – 2 over the community par.\nhttps://www.minutecryptic.com/?utm_source=share', 'Minute Cryptic - 21 October, 2026\n🏋 3 hints – 2 over the community par.');
t('Worldle: share link removed, emoji line kept', '#Worldle #1732 (19.10.2026) 1/6 (100%)\n🔥 Current Win Streak: 1 days\n🟩🟩🟩🟩🟩🎉\n\nhttps://worldle.teuteuf.fr/share', '#Worldle #1732 (19.10.2026) 1/6 (100%)\n🔥 Current Win Streak: 1 days\n🟩🟩🟩🟩🟩🎉');
t('Wordle: nothing to remove, unchanged', 'Wordle 1,950 5/6\n\n⬜⬜🟨⬜⬜\n🟩🟩🟩🟩🟩', 'Wordle 1,950 5/6\n\n⬜⬜🟨⬜⬜\n🟩🟩🟩🟩🟩');
t('Contexto: name in a sentence is kept', 'I played contexto.me 10/20/2026 and got it in 115 guesses and 2 hints.\n\n🟩🟩 16', 'I played contexto.me 10/20/2026 and got it in 115 guesses and 2 hints.\n\n🟩🟩 16');
t('WhenTaken: #WhenTaken #966 line kept (not only hashtags)', '#WhenTaken #966 (20.10.2026)\n\nI scored 486/1000🎗️', '#WhenTaken #966 (20.10.2026)\n\nI scored 486/1000🎗️');
t('Score line with a value kept', 'Score: 120/490', 'Score: 120/490');
t('link in the middle of a line', 'Great game! https://example.com/x today', 'Great game! today');
t('Windows line endings and extra blank lines tidied', 'Wordle 1 3/6\r\n\r\n\r\n\r\n🟩🟩🟩🟩🟩\r\n', 'Wordle 1 3/6\n\n🟩🟩🟩🟩🟩');
t('Box Office: web address line removed', 'boxofficega.me\nMarch 1, 2024\n✅ 120\n✅ 0\n❌ 0\n✅ 120\n✅ 160\n🏆 400', 'March 1, 2024\n✅ 120\n✅ 0\n❌ 0\n✅ 120\n✅ 160\n🏆 400');
t('empty / missing', '', '');
t('only a link', 'https://framed.wtf', '');
// Editing a saved result shows the cleaned text, so the score and the
// game must read the same from cleaned text as from the original.
eval(extract('function readGuessFraction(', 'let scoreNumberEdited') + extract('const GAME_SIGNATURES', 'function libraryCard(') + '\nglobalThis.read = readGameScore; globalThis.detect = detectGameFromText;');
const samples = {
  boxoffice: "boxofficega.me\nMarch 1, 2024\n✅ 120\n✅ 0\n❌ 0\n✅ 120\n✅ 160\n🏆 400",
  connections: "Connections\nPuzzle #1223\n🟦🟦🟦🟦\n🟨🟨🟨🟨\n🟪🟪🟪🟪\n🟩🟩🟩🟩",
  contexto: "I played contexto.me 10/20/2026 and got it in 115 guesses and 2 hints.\n\n🟩🟩 16",
  framed: "Framed #1684\n🎥 🟥 🟥 🟥 🟩 ⬛ ⬛\n\nhttps://framed.wtf",
  globle: "🌎 Oct 20, 2026 🌍\n🔥 1 | Avg. Guesses: 6.5\n🟧🟨🟥🟥🟥🟩 = 6\n\nhttps://globle-game.com\n#globle",
  guesslist: "GuessList (October 21, 2026)\nScore: 130/490\n\n🟥🟨🟩🟨🟥\n\nBest Guess: #78\n\nPlay at: https://playguesslist.com",
  krillion: "Krillion #97 🦐\n290\n\n🫧🦑🦑🦑🐟🫧🦑",
  magnitudle: "Size It Up\nOverall Score 330\n\n🟥🟥🟥🟥🟥 96\nhttps://magnitudle.com/size-it-up",
  maptap: "www.maptap.gg October 17\n95🏅 93🏆 93🏆 88🎉 80✨\nFinal score: 878",
  minutecryptic: "Minute Cryptic - 21 October, 2026\n🏋 3 hints – 2 over the community par.\nhttps://www.minutecryptic.com/?utm_source=share",
  poeltl: "Poeltl #1699 | X/8 | 00:14:20  | 👤6\n\n⬛⬛⬛🟨⬛⬛🟨",
  poople: "Poople #432 6/5\n⬜⬜⬜⬜\n🟫🟫🟫🟫",
  strands: "Strands #957\n“Just a little bit”\n💡🔵🔵💡\n🔵💡🔵🔵\n🟡🔵",
  weddle: "Weddle Classic 2026-10-20 8/8\n⬛🟨⬛⬛⬛⬛\n🟩🟩🟩🟩🟩🟩",
  whentaken: "#WhenTaken #966 (20.10.2026)\n\nI scored 486/1000🎗️",
  wordle: "Wordle 1,950 5/6\n\n⬜⬜🟨⬜⬜\n🟩🟩🟩🟩🟩",
  worldle: "#Worldle #1732 (19.10.2026) 1/6 (100%)\n🔥 Current Win Streak: 1 days\n🟩🟩🟩🟩🟩🎉\n\nhttps://worldle.teuteuf.fr/share"
};
for (const [game, text] of Object.entries(samples)) {
  const same = JSON.stringify(read(game, clean(text))) === JSON.stringify(read(game, text)) && read(game, text) !== null;
  const found = detect(clean(text)) === game;
  if (!same || !found) bad++;
  console.log((same && found ? 'PASS ' : 'FAIL ') + game + ': same score and game after cleaning' + (same && found ? '' : ' (score same: ' + same + ', detected: ' + detect(clean(text)) + ')'));
}
console.log(bad ? bad + ' FAILED' : 'ALL PASS');
if (bad) process.exitCode = 1;
