// Tile Drop music: the Neon Stack loop lines up and speeds up with levels.
const path = require('path');
require(path.join(process.argv[2] || path.join(__dirname, '..', '..'), 'tilesound.js'));
const S = globalThis.TileSound;
const t = (msg, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) process.exitCode = 1; };

t('lead, bass and drums are all one 4-bar loop (64 steps)', S.parts.leadEvents.length === 64 && S.parts.bassEvents.length === 64 && S.parts.DRUMS.length === 16);
t('every note in the tune is a real pitch', [...S.parts.leadEvents, ...S.parts.bassEvents].filter(Boolean).every(e => e.f > 40 && e.f < 2000));
t('first note is E5 held for 2 steps', Math.round(S.parts.leadEvents[0].f) === 659 && S.parts.leadEvents[0].steps === 2);
t('music speeds up a little each level and caps at 35%', S.speedFor(1) === 1 && S.speedFor(2) > 1 && S.speedFor(5) < S.speedFor(10) && S.speedFor(50) === 1.35);
t('sound is on unless switched off (no storage here)', S.isOn() === true);
