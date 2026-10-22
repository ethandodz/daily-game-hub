const { extract } = require('../helpers/extract.js');
eval(extract('function readGuessFraction(', 'let scoreNumberEdited') + '\nglobalThis.readGameScore = readGameScore;');
const cases = [
  ['boxoffice', "boxofficega.me\nMarch 1, 2024\n✅ 120\n✅ 0\n❌ 0\n✅ 120\n✅ 160\n🏆 400", 400, 'points', false],
  ['boxoffice', "boxofficega.me\nMarch 2, 2024\n❌ 0\n❌ 0\n✅ 80\n❌ 0\n❌ 0\n🏆 80", 80, 'points', false],
  ['connections', "Connections\n🟩🟩🟩🟩\n🟪🟪🟪🟪", null, null, null],
  ['connections', "Connections\nPuzzle #1223\n🟦🟦🟦🟦\n🟨🟨🟨🟨\n🟪🟪🟪🟪\n🟩🟩🟩🟩", 0, 'mistakes', false],
  ['connections', "Connections\nPuzzle #1223\n🟦🟨🟦🟦\n🟨🟨🟨🟨\n🟪🟦🟪🟪\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪", 2, 'mistakes', false],
  ['connections', "Connections\nPuzzle #1\n🟦🟨🟦🟦\n🟨🟨🟨🟨\n🟪🟦🟪🟪\n🟪🟦🟩🟪\n🟩🟪🟩🟩", 4, 'mistakes', true],
  ['contexto', "I played contexto.me 10/20/2026 and got it in 115 guesses and 2 hints.\n\n🟩🟩 16\n🟨🟨🟨🟨🟨🟨 47\n🟥🟥🟥🟥🟥🟥🟥 54", 115, 'guesses', false],
  ['framed', "Framed #1685\n🎥 🟥 🟥 🟥 🟥 🟥 🟥\n\nhttps://framed.wtf", 7, 'guesses', true],
  ['framed', "Framed #1684\n🎥 🟥 🟥 🟥 🟩 ⬛ ⬛\n\nhttps://framed.wtf", 4, 'guesses', false],
  ['framed', "Framed #1684\n🎥 🟥 🟩 ⬛ ⬛ ⬛ ⬛", 2, 'guesses', false],
  ['globle', "🌎 Oct 20, 2026 🌍\n🔥 1 | Avg. Guesses: 5\n🟥🟥🟥🟥🟩 = 5", 5, 'guesses', false],
  ['globle', "🌎 Oct 20, 2026 🌍\n🔥 1 | Avg. Guesses: 6.5\n🟧🟨🟥🟥🟥🟩 = 6\n\nhttps://globle-game.com\n#globle", 6, 'guesses', false],
  ['globle', "🌎 Oct 17, 2026 🌍\n🔥 1 | Avg. Guesses: 15\n🟥🟧🟨🟨🟧🟨🟨🟨\n🟥🟥🟧🟥🟥🟥🟩 = 15", 15, 'guesses', false],
  ['guesslist', "GuessList (October 21, 2026)\nScore: 130/490\n\n🟥🟨🟩🟨🟥\n\nBest Guess: #78\n\nPlay at: https://playguesslist.com", 130, 'points', false],
  ['krillion', "Krillion #97 🦐\n290\n\n🫧🦑🦑🦑🐟🫧🦑", 290, 'points', false],
  ['krillion', "Krillion #96 🦐\n385\n\n🦑🐟🏮🦑🐟🦑🦑", 385, 'points', false],
  ['magnitudle', "Size It Up\nOverall Score 330\n\n🟥🟥🟥🟥🟥 96\n🟥🟥🟥🟥⬜ 84\nhttps://magnitudle.com/size-it-up", 330, 'points', false],
  ['maptap', "www.maptap.gg October 17\n95🏅 93🏆 93🏆 88🎉 80✨\nFinal score: 878", 878, 'points', false],
  ['minutecryptic', "Minute Cryptic - 21 October, 2026\n\"Being in Rome, “X” is ten, certainly\" (9)\n⚪️⚪️⚪️🟣🟣🟣🟣🟣🟣🟣🟣🟣\n🏋 3 hints – 2 over the community par (219,515 solvers so far).\nhttps://www.minutecryptic.com/?utm_source=share", 3, 'hints', false],
  ['poeltl', "Poeltl #1699 | X/8 | 00:14:20  | 👤6\n\n⬛⬛⬛🟨⬛⬛🟨", 9, 'guesses', true],
  ['poeltl', "Poeltl #1696 | 1/8 | 00:00:04 \n\n🟩🟩🟩🟩🟩🟩🟩", 1, 'guesses', false],
  ['poople', "Poople #432 6/5\n⬜⬜⬜⬜\n🟫🟫🟫🟫", 6, 'guesses', false],
  ['strands', "Strands #957\n“Just a little bit”\n💡🔵🔵💡\n🔵💡🔵🔵\n🟡🔵", 3, 'hints', false],
  ['weddle', "Weddle Classic 2026-10-20 8/8\n⬛🟨⬛⬛⬛⬛\n🟩🟩🟩🟩🟩🟩", 8, 'guesses', false],
  ['weddle', "Weddle Classic 2026-10-16 2/8\n⬛🟨🟩🟩⬛⬛\n🟩🟩🟩🟩🟩🟩", 2, 'guesses', false],
  ['whentaken', "#WhenTaken #966 (20.10.2026)\n\nI scored 486/1000🎗️\n\n1️⃣📍7.6K km - 🗓️4 yrs - 🥉106/200", 486, 'points', false],
  ['wordle', "Wordle 1,950 5/6\n\n⬜⬜🟨⬜⬜\n🟩🟩🟩🟩🟩", 5, 'guesses', false],
  ['wordle', "Wordle 1,949 6/6\n\n⬜⬜⬜🟨⬜\n🟩🟩🟩🟩🟩", 6, 'guesses', false],
  ['wordle', "Wordle 1,951 X/6\n\n⬜⬜⬜🟨⬜", 7, 'guesses', true],
  ['worldle', "#Worldle #1732 (19.10.2026) 1/6 (100%)\n🔥 Current Win Streak: 1 days\n🟩🟩🟩🟩🟩🎉", 1, 'guesses', false],
  ['worldle', "#Worldle #1729 (16.10.2026) 2/6 (100%)\n🔥 Current Win Streak: 1 days", 2, 'guesses', false],
  ['worldle', "#Worldle #1730 (17.10.2026) X/6 (0%)", 7, 'guesses', true],
];
let bad = 0;
for (const [game, text, score, unit, failed] of cases) {
  const r = readGameScore(game, text);
  const ok = score === null ? r === null : (r && r.score === score && r.unit === unit && r.failed === failed);
  if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + game.padEnd(14) + JSON.stringify(r));
}
for (const [game, text] of [['wordle', 'just played it'], ['krillion', ''], ['unknowngame', 'Wordle 1 3/6'], ['connections', 'no grid here'], ['framed', 'Framed #1']]) {
  const r = readGameScore(game, text); if (r !== null) bad++;
  console.log((r === null ? 'PASS ' : 'FAIL ') + 'unreadable ' + game + ' -> ' + JSON.stringify(r));
}
console.log(bad ? bad + ' FAILED' : 'ALL PASS');
if (bad) process.exitCode = 1;
