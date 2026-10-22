const { extract } = require('../helpers/extract.js');
eval(extract('function rankGameResults(', 'let serverBoardDay') + extract('function addDays(', 'let statsPeriod') + '\nObject.assign(globalThis, { computeServerStats, periodStartDate, compareResults });');
let bad = 0;
const ok = (label, cond, detail = '') => { if (!cond) bad++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  ' + detail)); };
// periods
ok('week starts Monday (Thu Oct 22 -> Mon Oct 19)', periodStartDate('week', '2026-10-22') === '2026-10-19');
ok('week on a Monday is that day', periodStartDate('week', '2026-10-19') === '2026-10-19');
ok('week on a Sunday goes back 6 days', periodStartDate('week', '2026-10-25') === '2026-10-19');
ok('month', periodStartDate('month', '2026-10-22') === '2026-10-01');
ok('year', periodStartDate('year', '2026-10-22') === '2026-01-01');
ok('all time has no start', periodStartDate('all', '2026-10-22') === null);
// head to head compare
ok('lower: 3 beats 4', compareResults({ numeric_score: 3 }, { numeric_score: 4 }, 'lower') === 1);
ok('higher: 290 loses to 385', compareResults({ numeric_score: 290 }, { numeric_score: 385 }, 'higher') === -1);
ok('solved beats failed', compareResults({ numeric_score: 6 }, { numeric_score: 7, completed: false }, 'lower') === 1);
ok('both failed tie', compareResults({ numeric_score: 7, completed: false }, { numeric_score: 7, completed: false }, 'lower') === 0);
ok('no number: not compared', compareResults({ numeric_score: null }, { numeric_score: 3 }, 'lower') === null);
ok('no-winner game: not compared', compareResults({ numeric_score: 3 }, { numeric_score: 4 }, 'none') === null);
// a 3-day server: A=me, B, C
const R = (u, g, d, n, completed = true) => ({ user_id: u, game_id: g, play_date: d, numeric_score: n, completed });
const rows = [
  R('A', 'wordle', '2026-10-19', 3), R('B', 'wordle', '2026-10-19', 4), R('C', 'wordle', '2026-10-19', 3),
  R('A', 'wordle', '2026-10-20', 7, false), R('B', 'wordle', '2026-10-20', 5),
  R('A', 'wordle', '2026-10-21', 2), R('B', 'wordle', '2026-10-21', 2),
  R('A', 'krillion', '2026-10-19', 300), R('B', 'krillion', '2026-10-19', 385),
  R('A', 'krillion', '2026-10-21', 400),
  R('A', 'wordle', '2026-10-22', 1),                 // today: outside range
  R('A', 'framed', '2026-10-20', 2),                 // not a server game
  R('Z', 'wordle', '2026-10-20', 1)                  // not a member
];
const games = [{ game_key: 'wordle', direction: 'lower' }, { game_key: 'krillion', direction: 'higher' }];
const all = computeServerStats({ rows, memberIds: ['A', 'B', 'C'], games, gameKey: null, fromDate: '2026-10-19', toDate: '2026-10-21', me: 'A' });
const L = id => all.leaderboard.find(x => x.userId === id);
ok('3 finished days', all.dayCount === 3);
ok('A: wins = 19 wordle(tie) + 21 wordle(tie) + 21 krillion = 3', L('A').wins === 3, JSON.stringify(L('A')));
ok('B: wins = 20 wordle + 21 wordle(tie) + 19 krillion = 3', L('B').wins === 3, JSON.stringify(L('B')));
ok('C: wins = 19 wordle(tie) = 1', L('C').wins === 1);
ok('A played 5 (today, non-server game, outsiders excluded)', L('A').played === 5, L('A').played);
ok('A played % = 5 / (3 days x 2 games)', Math.abs(L('A').playedRate - 5 / 6) < 1e-9);
ok('A win rate = 3/5', Math.abs(L('A').winRate - 0.6) < 1e-9);
ok('all-games mode: no average/best/worst', L('A').average === null && L('A').best === null);
ok('A win streak: won 19, lost 20, won 21 -> current 1, best 1', L('A').currentWinStreak === 1 && L('A').bestWinStreak === 1);
ok('B win streak: 19,20,21 -> 3', L('B').currentWinStreak === 3 && L('B').bestWinStreak === 3);
ok('ordering: wins, then win rate', all.leaderboard.map(x => x.userId).join() === 'B,A,C', all.leaderboard.map(x => x.userId + x.wins + ':' + x.winRate.toFixed(2)).join());
const hB = all.headToHead.get('B'), hC = all.headToHead.get('C');
ok('A vs B: 19 W, 20 L(fail), 21 T, krillion 19 L -> 1-2-1', hB.wins === 1 && hB.losses === 2 && hB.ties === 1, JSON.stringify(hB));
ok('A vs C: 19 T -> 0-0-1', hC.wins === 0 && hC.losses === 0 && hC.ties === 1, JSON.stringify(hC));
ok('no head-to-head with yourself', !all.headToHead.has('A'));
const w = computeServerStats({ rows, memberIds: ['A', 'B', 'C'], games, gameKey: 'wordle', fromDate: '2026-10-19', toDate: '2026-10-21', me: 'A' });
const WA = w.leaderboard.find(x => x.userId === 'A');
ok('wordle A average includes fail as 7: (3+7+2)/3 = 4', Math.abs(WA.average - 4) < 1e-9, WA.average);
ok('wordle A best 2, worst 7 (fail)', WA.best === 2 && WA.worst === 7, WA.best + ' ' + WA.worst);
const k = computeServerStats({ rows, memberIds: ['A', 'B', 'C'], games, gameKey: 'krillion', fromDate: '2026-10-19', toDate: '2026-10-21', me: 'A' });
const KA = k.leaderboard.find(x => x.userId === 'A');
ok('krillion (higher) A best 400, worst 300', KA.best === 400 && KA.worst === 300, KA.best + ' ' + KA.worst);
ok('C never played krillion: no average', k.leaderboard.find(x => x.userId === 'C').average === null);
const empty = computeServerStats({ rows, memberIds: ['A'], games, gameKey: null, fromDate: '2026-10-22', toDate: '2026-10-21', me: 'A' });
ok('server created today: no finished days, nothing counted', empty.dayCount === 0 && empty.leaderboard[0].played === 0 && empty.leaderboard[0].playedRate === 0);
console.log(bad ? bad + ' FAILED' : 'ALL PASS');
if (bad) process.exitCode = 1;
