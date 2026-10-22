const { extract } = require('../helpers/extract.js');
eval(extract('const PERCEPTLE_KEY', 'const SCORE_READERS') + extract('const GAME_SIGNATURES', 'function libraryCard(') + '\nglobalThis.d = detectGameFromText; globalThis.SIG = GAME_SIGNATURES;');
const samples = {
  boxoffice: "boxofficega.me\nMarch 1, 2024\n✅ 120\n✅ 0\n❌ 0\n✅ 120\n✅ 160\n🏆 400",
  duotrigordle: "Daily Duotrigordle #1695\nGuesses: 36/37\n0️⃣8️⃣ 2️⃣4️⃣ 2️⃣3️⃣ 0️⃣9️⃣\n1️⃣0️⃣ 3️⃣5️⃣ 2️⃣5️⃣ 1️⃣1️⃣\n1️⃣4️⃣ 1️⃣5️⃣ 1️⃣7️⃣ 0️⃣7️⃣\nhttps://duotrigordle.com/",
  immaculate: "🏈 Immaculate Grid 1191 6/9:\nRarity: 430\n🟩🟩⬜️\n🟩🟩🟩\n⬜️⬜️🟩\nPlay at:\nhttps://www.sports-reference.com/immaculate-grid/play/football",
  ['custom-d624eb38-1792591388191-perceptle']: "Perceptle #97 - B (78)\n🔢 83  🎯 99  📐 89  🥁 24  ✂️ 96\nhttps://perceptle.com",
  connections: "Connections\nPuzzle #1223\n🟦🟦🟦🟦\n🟨🟨🟨🟨\n🟪🟪🟪🟪\n🟩🟩🟩🟩",
  contexto: "I played contexto.me 10/20/2026 and got it in 115 guesses and 2 hints.\n\n🟩🟩 16",
  framed: "Framed #1685\n🎥 🟥 🟥 🟥 🟥 🟥 🟥\n\nhttps://framed.wtf",
  globle: "🌎 Oct 20, 2026 🌍\n🔥 1 | Avg. Guesses: 5\n🟥🟥🟥🟥🟩 = 5",
  guesslist: "GuessList (October 21, 2026)\nScore: 130/490\n\n🟥🟨🟩🟨🟥\n\nBest Guess: #78",
  krillion: "Krillion #97 🦐\n290\n\n🫧🦑🦑🦑🐟🫧🦑",
  magnitudle: "Size It Up\nOverall Score 330\n\n🟥🟥🟥🟥🟥 96\nhttps://magnitudle.com/size-it-up",
  maptap: "www.maptap.gg October 17\n95🏅 93🏆 93🏆 88🎉 80✨\nFinal score: 878",
  minutecryptic: "Minute Cryptic - 21 October, 2026\n\"Being in Rome\" (9)\n⚪️🟣\n🏋 3 hints – 2 over the community par\nhttps://www.minutecryptic.com/",
  poeltl: "Poeltl #1699 | X/8 | 00:14:20  | 👤6\n\n⬛⬛⬛🟨⬛⬛🟨",
  poople: "Poople #432 6/5\n⬜⬜⬜⬜\n🟫🟫🟫🟫",
  strands: "Strands #957\n“Just a little bit”\n💡🔵🔵💡",
  weddle: "Weddle Classic 2026-10-20 8/8\n⬛🟨⬛⬛⬛⬛",
  whentaken: "#WhenTaken #966 (20.10.2026)\n\nI scored 486/1000🎗️",
  wordle: "Wordle 1,950 5/6\n\n⬜⬜🟨⬜⬜\n🟩🟩🟩🟩🟩",
  worldle: "#Worldle #1732 (19.10.2026) 1/6 (100%)\n🔥 Current Win Streak: 1 days\n🟩🟩🟩🟩🟩🎉\n\nhttps://worldle.teuteuf.fr/share"
};
let bad = 0;
for (const [game, text] of Object.entries(samples)) {
  const all = Object.keys(SIG).filter(k => SIG[k].test(text));
  const ok = d(text) === game && all.length === 1;
  if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + game.padEnd(14) + ' matched: ' + all.join(','));
}
for (const t of ['nice game today', 'I got 3/6!', '']) { const r = d(t); if (r) bad++; console.log((r ? 'FAIL ' : 'PASS ') + 'not a share text -> ' + r); }
console.log(bad ? bad + ' FAILED' : 'ALL PASS');
if (bad) process.exitCode = 1;
