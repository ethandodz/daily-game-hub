// Tile Drop rules: same pieces for the same day, moves, line clears, scoring.
const path = require('path');
const T = require(path.join(__dirname, '..', '..', 'tiledrop.js'));
const R = T.rules;
let bad = 0;
const t = (label, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '  ' + detail)); if (!ok) bad++; };

const seq = seed => { const next = R.pieceSequence(seed); return Array.from({ length: 21 }, next); };
const a = seq('2026-10-23'), b = seq('2026-10-23'), c = seq('2026-10-24');
t('same day, same pieces in the same order', a.join() === b.join());
t('a different day gives different pieces', a.join() !== c.join());
t('every bag of 7 has each piece once', [0, 7, 14].every(i => a.slice(i, i + 7).sort().join() === '0,1,2,3,4,5,6'), a.join());

const board = R.emptyBoard();
t('board is 10 wide, 20 tall', board.length === 20 && board[0].length === 10);
const tPiece = R.newPiece(2);
t('new piece starts centered at the top', tPiece.x === 3 && tPiece.y === 0 && R.fits(board, tPiece));
t('can\'t move through the left wall', !R.fits(board, { ...tPiece, x: 0 }, -1, 0));
t('can\'t move through the floor', R.dropDistance(board, tPiece) === 18, R.dropDistance(board, tPiece));
const rotated = R.rotate([[0, 1, 0], [1, 1, 1], [0, 0, 0]]);
t('rotate turns the piece clockwise', JSON.stringify(rotated) === JSON.stringify([[0, 1, 0], [0, 1, 1], [0, 1, 0]]), JSON.stringify(rotated));
const iPiece = { ...R.newPiece(0), x: -1, y: 5 };
iPiece.shape = R.rotate(iPiece.shape);
const kicked = R.tryRotate(board, iPiece);
t('rotating next to a wall nudges the piece back in', R.fits(board, kicked) && kicked.shape !== iPiece.shape);

// line clears
const full = R.emptyBoard();
for (let y = 16; y < 20; y++) for (let x = 0; x < 10; x++) full[y][x] = 1;
full[15][4] = 2;
t('four full rows clear at once', R.clearLines(full) === 4);
t('rows above fall down after a clear', full[19][4] === 2 && full[18].every(v => !v));
t('scoring: 100 / 300 / 500 / 800 times the level', [1, 2, 3, 4].map(n => R.pointsFor(n, 2)).join() === '200,600,1000,1600');
t('level goes up every 10 lines', R.levelFor(0) === 1 && R.levelFor(9) === 1 && R.levelFor(10) === 2 && R.levelFor(25) === 3);
t('gets about 15% faster each level, never below 80 ms', R.gravityFor(1) === 700 && R.gravityFor(2) === 595 && R.gravityFor(5) === 365 && R.gravityFor(50) === 80);

// a game: dropping pieces straight down ends the game and adds drop points
let result = null;
const game = T.createGame({ seed: 'test', onGameOver: r => { result = r; } });
game.stop();
for (let i = 0; i < 200 && !game.state.over; i++) game.act('drop');
t('stacking to the top ends the game', game.state.over && result !== null);
t('hard drops add 2 points per row', result && result.score > 0 && result.lines === 0, JSON.stringify(result));
t('no moves after the game ends', (() => { const s = game.state.score; game.act('drop'); return game.state.score === s; })());
// stop the timer started by createGame
game.stop();

console.log(bad ? bad + ' FAILED' : 'ALL PASS');
if (bad) process.exitCode = 1;
