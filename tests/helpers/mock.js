// Shared fake Supabase + static server for the browser tests.
// Usage from a test: node tests/browser/<test>.js <repoRoot> <outputPrefix> [label]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [dir, out] = process.argv.slice(2);
const ME = '11111111-1111-1111-1111-111111111111', FRIEND = '22222222-2222-2222-2222-222222222222';
const today = new Date().toLocaleDateString('en-CA');
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
const games = [
  ['wordle','Wordle','Word','Guess the five-letter word in six tries.','W','#16a34a'],
  ['connections','Connections','Word','Group sixteen words into four sets.','C','#7c3aed'],
  ['worldle','Worldle','Geography','Name the country from its outline.','🌍','#0ea5e9'],
  ['framed','Framed','Movies','Guess the movie from one frame.','🎬','#e11d48'],
  ['immaculate','Immaculate Grid','Sports','Fill the baseball grid.','⚾','#f59e0b'],
  ['krillion','Krillion','Trivia','Daily trivia ladder.','🦐','#14b8a6'],
].map(([game_key,name,category,description,icon,color]) => ({game_key,name,url:'https://example.com',category,description,icon,color,is_official:true,created_by:null}));
const userGames = games.map((g,i)=>({user_id:ME,game_key:g.game_key,is_visible:true,is_favorite:i<4,sort_order:i,added_at:'2026-01-01'}));
const scores = [
  {user_id:ME,game_id:'wordle',play_date:today,result_text:'Wordle 1,585 3/6\n⬜🟨⬜⬜⬜\n🟩🟩⬜🟩⬜\n🟩🟩🟩🟩🟩',numeric_score:3,score_unit:'guesses',completed:true},
  {user_id:FRIEND,game_id:'wordle',play_date:today,result_text:'Wordle 1,585 4/6\n⬜⬜⬜⬜⬜\n🟨⬜🟨⬜⬜\n🟩🟩⬜🟩🟩\n🟩🟩🟩🟩🟩',numeric_score:4,score_unit:'guesses',completed:true},
  {user_id:FRIEND,game_id:'connections',play_date:today,result_text:'🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',completed:true},
  ...[1,2,3,4].map(n=>({user_id:ME,game_id:'wordle',play_date:day(n),result_text:'Wordle 4/6\n⬜🟨⬜⬜⬜\n🟩🟩🟩🟩🟩',numeric_score:4,completed:true})),
  ...[1,2,10,11,12,13,14,15,16].map(n=>({user_id:ME,game_id:'connections',play_date:day(n),result_text:'Connections\n🟩🟩🟩🟩\n🟪🟪🟪🟪',completed:true})),
  {user_id:ME,game_id:'framed',play_date:day(3),result_text:'🎥 🟥 🟩 ⬛ ⬛ ⬛ ⬛',completed:true},
  ...[1,2,3].map(n=>({user_id:FRIEND,game_id:'connections',play_date:day(n),result_text:'🟩🟩🟩🟩',completed:true})),
];
const F2='33333333-3333-3333-3333-333333333333', F3='44444444-4444-4444-4444-444444444444';
scores.forEach((r, i) => { if (r.id == null) r.id = i + 1; if (r.numeric_score === undefined) r.numeric_score = r.result_text && r.result_text.includes('Wordle') ? 4 : null; });
const profiles = [{user_id:ME,username:'laur',display_name:null},{user_id:FRIEND,username:'ethan',display_name:null},{user_id:F2,username:'maya',display_name:null},{user_id:F3,username:'sam',display_name:null}];
if (process.env.MORE_FRIENDS) scores.push(...[F2,F3].flatMap(f=>[{user_id:f,game_id:'wordle',play_date:today,result_text:'Wordle 5/6',completed:true},{user_id:f,game_id:'connections',play_date:today,result_text:'🟩🟩🟩🟩',completed:true}]));
const tables = {
  games, user_games: userGames, daily_scores: scores, daily_game_status: [{user_id:ME,game_key:'worldle',play_date:today,completed:true}],
  friendships: [{id:1,requester_id:ME,addressee_id:FRIEND,status:'accepted'}], profiles, feedback: [],
};
const server = http.createServer((req,res)=>{ const f = path.join(dir, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);return res.end();} const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'}; res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); res.end(b); }); });

const requests = [];
const serverState = { servers: [{ id: 'srv-ethan', name: 'Work Crew', owner_id: FRIEND, invite_code: 'JOIN42', start_date: today, created_at: '2026-10-01' }],
  members: [{ server_id: 'srv-ethan', user_id: FRIEND, role: 'owner', joined_at: '2026-10-01' }],
  games: [{ server_id: 'srv-ethan', game_key: 'wordle', sort_order: 1, score_direction: null }],
  cards: [{ user_id: FRIEND, icon: '🐸', color: 'teal', bio: 'purple group first, always', favorite_game: 'connections', showcase: ['krillionaire', 'on_fire', 'sharpshooter'], frame: 'frame_gold', name_color: 'name_mint', title: 'title_wordle' }],
  purchases: [],
  shopItems: [
    { id: 'icon_crown', kind: 'icon', name: 'Crown', value: '👑', price: 300, unlock_id: null, unlock_tier: null, sort_order: 1 },
    { id: 'icon_trophy', kind: 'icon', name: 'Trophy', value: '🏆', price: null, unlock_id: 'on_fire', unlock_tier: 2, sort_order: 2 },
    { id: 'frame_gold', kind: 'frame', name: 'Gold frame', value: 'gold', price: 500, unlock_id: null, unlock_tier: null, sort_order: 10 },
    { id: 'frame_rainbow', kind: 'frame', name: 'Rainbow frame', value: 'rainbow', price: 1000, unlock_id: null, unlock_tier: null, sort_order: 11 },
    { id: 'frame_crown', kind: 'frame', name: 'Crown frame', value: 'crown', price: null, unlock_id: 'winner', unlock_tier: 2, sort_order: 12 },
    { id: 'name_mint', kind: 'name_color', name: 'Mint name', value: 'mint', price: 200, unlock_id: null, unlock_tier: null, sort_order: 20 },
    { id: 'title_wordle', kind: 'title', name: 'Wordle Wizard', value: 'Wordle Wizard', price: 250, unlock_id: null, unlock_tier: null, sort_order: 30 },
    { id: 'title_champ', kind: 'title', name: 'Champion', value: 'Champion', price: null, unlock_id: 'founder', unlock_tier: 1, sort_order: 31 }],
  achievementList: [['winner', 'Winner', '👑', 'Days won in your servers', [1, 10, 50, 100]], ['on_fire', 'On Fire', '🔥', 'Days in a row with a result', [7, 30, 100, 365]],
    ['sharpshooter', 'Sharpshooter', '🎯', 'Wordle in 2 guesses or fewer', [1, 5, 25]], ['krillionaire', 'Krillionaire', '💎', 'Krillion answer (💎) in Krillion', [1, 5, 20]], ['founder', 'Founder', '🏰', 'Create a server', [1]]],
  achievementProgress: { [ME]: { winner: 31, on_fire: 12, sharpshooter: 3, krillionaire: 0, founder: 1 }, [FRIEND]: { winner: 24, on_fire: 40, krillionaire: 6 } },
  friends: [{ user_id: FRIEND, username: 'ethan', last_seen: new Date().toISOString() }, { user_id: F2, username: 'maya', last_seen: new Date(Date.now() - 3 * 3600e3).toISOString() }],
  duels: [], arcade: [{ user_id: FRIEND, score: 4200 }, { user_id: F2, score: 900 }],
  cardStats: { [ME]: { played: 214, wins: 31, best_streak: 12, member_since: '2026-06-01T00:00:00Z', my_wins: 0, their_wins: 0 },
    [FRIEND]: { played: 188, wins: 24, best_streak: 40, member_since: '2026-07-01T00:00:00Z', my_wins: 31, their_wins: 24 } } };
const directions = { wordle: 'lower', connections: 'lower', worldle: 'lower', framed: 'lower', krillion: 'higher', immaculate: 'none' };
function duelPattern(guess, answer) {
  const out = Array(5).fill('B'), left = {};
  [...answer].forEach((c, i) => { if (guess[i] === c) out[i] = 'G'; else left[c] = (left[c] || 0) + 1; });
  [...guess].forEach((c, i) => { if (out[i] !== 'G' && left[c]) { out[i] = 'Y'; left[c] -= 1; } });
  return out.join('');
}
// Same rules as duel_guess: fewest guesses wins, finish once it can't change.
function duelSettle(d) {
  const [a, b] = [d.challenger, d.opponent].map(u => d.guesses[u]);
  const solvedIn = g => { const i = g.indexOf(d.answer); return i < 0 ? null : i + 1; };
  const done = g => solvedIn(g) || g.length >= 6;
  const sa = solvedIn(a), sb = solvedIn(b);
  const finish = winner => { d.status = 'finished'; d.winner = winner; d.finished_at = new Date().toISOString(); };
  if (done(a) && done(b)) return finish(sa && (!sb || sa < sb) ? d.challenger : sb && (!sa || sb < sa) ? d.opponent : null);
  if (sa && !done(b) && b.length >= sa) return finish(d.challenger);
  if (sb && !done(a) && a.length >= sb) return finish(d.opponent);
}
function serverRoute(method, u, body) {
  if (u.pathname.startsWith('/auth/v1/')) {
    const a = u.pathname.slice('/auth/v1/'.length);
    if (a === 'signup') {
      const mode = process.env.SIGNUP_MODE || 'new';
      if (mode === 'existing-confirm') return { status: 200, body: { id: 'x', email: body.email, identities: [] } };
      if (mode === 'existing-noconfirm') return { status: 422, body: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } };
      return { status: 200, body: { id: 'new-user', email: body.email, identities: [{ id: 'i1' }] } };
    }
    if (a === 'recover') return process.env.RECOVER_LIMIT ? { status: 429, body: { msg: 'For security purposes, you can only request this after 37 seconds.' } } : { status: 200, body: {} };
    if (a === 'user') return { status: 200, body: { id: ME, email: 'laur@example.com' } };
  }
  const t = u.pathname.replace('/rest/v1/', ''); const p = u.searchParams; const eq = k => (p.get(k) || '').replace(/^eq\./, '');
  const mine = id => serverState.members.some(m => m.server_id === id && m.user_id === ME);
  const err = msg => ({ status: 400, body: { message: msg } });
  const code = () => Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01ILO]/g, 'Q').padEnd(6, 'Q');
  if (t === 'rpc/create_server') { const id = 'srv-' + Math.random().toString(36).slice(2, 8); const name = String(body.p_name || '').trim();
    if (!name) return err('Server name must be 1 to 40 characters.');
    serverState.servers.push({ id, name, owner_id: ME, invite_code: code(), start_date: body.p_start_date, created_at: new Date().toISOString() });
    serverState.members.push({ server_id: id, user_id: ME, role: 'owner', joined_at: new Date().toISOString() });
    body.p_game_keys.forEach((k, i) => serverState.games.push({ server_id: id, game_key: k, sort_order: i + 1, score_direction: null }));
    return { status: 200, body: id }; }
  if (t === 'rpc/join_server') { const sv = serverState.servers.find(x => x.invite_code === String(body.p_invite_code).trim().toUpperCase());
    if (!sv) return err('No server has that invite code.');
    if (!mine(sv.id)) serverState.members.push({ server_id: sv.id, user_id: ME, role: 'member', joined_at: new Date().toISOString() });
    return { status: 200, body: sv.id }; }
  if (t === 'rpc/reset_invite_code') { const sv = serverState.servers.find(x => x.id === body.p_server_id);
    if (!sv || sv.owner_id !== ME) return err('Only the server owner can do that.'); sv.invite_code = code(); return { status: 200, body: sv.invite_code }; }
  if (t === 'servers') {
    if (method === 'GET') return { status: 200, body: serverState.servers.filter(x => mine(x.id)) };
    const sv = serverState.servers.find(x => x.id === eq('id'));
    if (method === 'PATCH' && sv && sv.owner_id === ME) sv.name = body.name;
    if (method === 'DELETE' && sv && sv.owner_id === ME) { serverState.servers = serverState.servers.filter(x => x !== sv); serverState.members = serverState.members.filter(m => m.server_id !== sv.id); serverState.games = serverState.games.filter(g => g.server_id !== sv.id); }
    return { status: 204, body: null }; }
  const sidIn = (p.get('server_id') || '').startsWith('in.(') ? p.get('server_id').slice(4, -1).split(',') : null;
  if (sidIn && method === 'GET' && (t === 'server_members' || t === 'server_games')) {
    const list = t === 'server_members' ? serverState.members : serverState.games;
    return { status: 200, body: list.filter(x => sidIn.includes(x.server_id) && mine(x.server_id)) };
  }
  if (t === 'server_members') { const sid = eq('server_id');
    if (method === 'GET') return { status: 200, body: mine(sid) ? serverState.members.filter(m => m.server_id === sid) : [] };
    if (method === 'DELETE') { const uid = eq('user_id'); const sv = serverState.servers.find(x => x.id === sid);
      serverState.members = serverState.members.filter(m => !(m.server_id === sid && m.user_id === uid && ((uid === ME && m.role !== 'owner') || (sv && sv.owner_id === ME && uid !== ME)))); }
    return { status: 204, body: null }; }
  if (t === 'server_games') { const sid = eq('server_id');
    if (method === 'GET') return { status: 200, body: mine(sid) ? serverState.games.filter(g => g.server_id === sid).sort((a, b) => a.sort_order - b.sort_order) : [] };
    if (method === 'DELETE') { const keys = (p.get('game_key') || '').replace(/^in\.\(|\)$/g, '').split(','); serverState.games = serverState.games.filter(g => !(g.server_id === sid && keys.includes(g.game_key))); }
    if (method === 'POST') body.forEach(r => serverState.games.push({ ...r, score_direction: null }));
    return { status: 201, body: null }; }
  if (t === 'games' && (p.get('select') || '').includes('score_direction')) return { status: 200, body: games.map(g => ({ game_key: g.game_key, score_direction: directions[g.game_key] || 'none' })) };
  if (t === 'player_cards') {
    if (method === 'POST') { if (body.user_id !== ME) return { status: 403, body: { message: 'new row violates row-level security policy' } };
      const i = serverState.cards.findIndex(c => c.user_id === ME); if (i >= 0) serverState.cards[i] = body; else serverState.cards.push(body); return { status: 201, body: null }; }
    const ids = (p.get('user_id') || '').replace(/^in\.\(|\)$/g, '').replace(/^eq\./, '').split(',');
    return { status: 200, body: serverState.cards.filter(c => ids.includes(c.user_id)) }; }
  if (t === 'shop_items') return process.env.NO_ACHIEVEMENTS ? { status: 404, body: { message: 'relation "public.shop_items" does not exist' } } : { status: 200, body: serverState.shopItems };
  if (t === 'purchases') return { status: 200, body: serverState.purchases.map(item_id => ({ item_id })) };
  if (t === 'rpc/buy_item') { const item = serverState.shopItems.find(i => i.id === body.p_item_id);
    const spent = serverState.purchases.reduce((sum, id) => sum + serverState.shopItems.find(i => i.id === id).price, 0);
    if (!item || !item.price) return err('This item can\'t be bought. Unlock it with a badge.');
    if (1240 - spent < item.price) return err('Not enough coins.');
    serverState.purchases.push(item.id); return { status: 200, body: { balance: 1240 - spent - item.price } }; }
  if (t === 'rpc/player_achievements') { if (process.env.NO_ACHIEVEMENTS) return { status: 404, body: { message: 'Could not find the function' } };
    const progress = serverState.achievementProgress[body.p_user_id] || {};
    return { status: 200, body: serverState.achievementList.flatMap(([id, name, icon, description, thresholds], i) => thresholds.map((threshold, t) => ({ id, tier: t + 1, name, icon, description, threshold, coins: [25, 50, 100, 200][t], progress: progress[id] || 0 }))) }; }
  if (t === 'rpc/player_coins') { if (process.env.NO_ACHIEVEMENTS) return { status: 404, body: { message: 'Could not find the function' } };
    const spent = serverState.purchases.reduce((sum, id) => sum + serverState.shopItems.find(i => i.id === id).price, 0);
    return { status: 200, body: body.p_user_id === ME ? { balance: 1240 - spent, history: [{ day: null, label: 'Badge: Winner Silver', amount: 50 }, { day: day(1), label: 'Won Wordle', amount: 15 }, { day: day(1), label: 'Played 3 games', amount: 11 }] } : { balance: 980, history: null } }; }
  if (t === 'rpc/player_card_stats') return { status: 200, body: serverState.cardStats[body.p_user_id] || { played: 0, wins: 0, best_streak: 0, member_since: '2026-06-01T00:00:00Z', my_wins: 0, their_wins: 0 } };
  if (t === 'profiles' && method === 'POST') { // POST_PROFILE
    if (profiles.some(x => x.username === body.username && x.user_id !== body.user_id)) return { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_unique"' } };
    const existing = profiles.find(x => x.user_id === body.user_id);
    if (existing) existing.username = body.username; else profiles.push({ user_id: body.user_id, username: body.username, display_name: null });
    return { status: 201, body: null };
  }
  if (t === 'profiles' && (p.get('user_id') || '').startsWith('in.')) { const ids = p.get('user_id').slice(4, -1).split(','); return { status: 200, body: profiles.filter(x => ids.includes(x.user_id)) }; }
  // Play tab: Wordle Duel (answer is always "crane" here) and Tile Drop scores.
  if (t === 'rpc/heartbeat') return { status: 204, body: null };
  if (t === 'rpc/server_friends') return { status: 200, body: serverState.friends };
  const duelView = d => { const me = d.challenger === ME; const other = me ? d.opponent : d.challenger;
    return { id: d.id, game: 'wordle_duel', status: d.status, is_challenger: me, opponent: other, winner: d.winner, created_at: d.created_at, finished_at: d.finished_at,
      my_guesses: d.guesses[ME].map(guess => ({ guess, pattern: duelPattern(guess, d.answer) })), their_patterns: d.guesses[other].map(g => duelPattern(g, d.answer)),
      last_move_at: d.created_at, answer: d.status === 'finished' ? d.answer : null }; };
  const findDuel = id => serverState.duels.find(d => d.id === id);
  if (t === 'rpc/create_duel') { if (!serverState.friends.some(f => f.user_id === body.p_opponent)) return err('You can only challenge people in your servers.');
    const d = { id: 'duel-' + (serverState.duels.length + 1), challenger: ME, opponent: body.p_opponent, answer: 'crane', status: 'pending', winner: null, created_at: new Date().toISOString(), finished_at: null, guesses: { [ME]: [], [body.p_opponent]: [] } };
    serverState.duels.push(d); return { status: 200, body: d.id }; }
  if (t === 'rpc/my_duels') return { status: 200, body: serverState.duels.map(duelView).reverse() };
  if (t === 'rpc/duel_state') { const d = findDuel(body.p_duel); return d ? { status: 200, body: duelView(d) } : err('Duel not found.'); }
  if (t === 'rpc/respond_duel') { const d = findDuel(body.p_duel); d.status = body.p_accept ? 'active' : 'declined'; return { status: 200, body: duelView(d) }; }
  if (t === 'rpc/cancel_duel') { const d = findDuel(body.p_duel); const other = d.challenger === ME ? d.opponent : d.challenger;
    if (d.status === 'pending') d.status = d.challenger === ME ? 'cancelled' : 'declined'; else { d.status = 'finished'; d.winner = other; }
    return { status: 200, body: duelView(d) }; }
  if (t === 'rpc/duel_guess') { const d = findDuel(body.p_duel); d.guesses[ME].push(body.p_guess); duelSettle(d); return { status: 200, body: duelView(d) }; }
  if (t === 'rpc/submit_arcade_score') { serverState.arcade.push({ user_id: ME, score: body.p_score });
    return { status: 200, body: { best_today: Math.max(...serverState.arcade.filter(r => r.user_id === ME).map(r => r.score)) } }; }
  if (t === 'rpc/arcade_leaderboard') { const best = new Map(); serverState.arcade.forEach(r => best.set(r.user_id, Math.max(best.get(r.user_id) || 0, r.score)));
    const rows = [...best].sort((a, b) => b[1] - a[1]).map(([user_id, score], i) => ({ rank: i + 1, user_id, username: (profiles.find(x => x.user_id === user_id) || {}).username, score, is_me: user_id === ME }));
    const me = rows.find(r => r.is_me); return { status: 200, body: { rows, me: me ? { rank: me.rank, score: me.score } : null } }; }
  return null;
}
async function setup(browser, opts, signedIn=true) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('https://ibffwmegxjymmulfgoqu.supabase.co/**', async route => {
    if (process.env.SLOW_CATALOG && /\/(games|user_games)\b/.test(route.request().url())) await new Promise(r => setTimeout(r, 700));
    const u = new URL(route.request().url()); const t = u.pathname.split('/').pop();
    requests.push({ method: route.request().method(), url: route.request().url(), body: route.request().postData() });
    if (process.env.FK_FAIL && route.request().method() === 'POST' && t === 'daily_scores') return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23503', message: 'insert or update on table "daily_scores" violates foreign key constraint "daily_scores_user_id_fkey"' }) });
    const handled = serverRoute(route.request().method(), u, route.request().postData() ? JSON.parse(route.request().postData()) : null);
    if (handled) return route.fulfill({ status: handled.status, contentType: 'application/json', body: handled.body === null ? '' : JSON.stringify(handled.body) });
    let rows = tables[t] || [];
    const uid = u.searchParams.get('user_id'); if (t==='profiles' && uid && uid.startsWith('eq.')) rows = rows.filter(r=>r.user_id===uid.slice(3));
    const pd = u.searchParams.get('play_date');
    for (const cond of (t==='daily_scores' ? u.searchParams.getAll('play_date') : [])) {
      if (cond.startsWith('eq.')) rows = rows.filter(r=>r.play_date===cond.slice(3));
      if (cond.startsWith('gte.')) rows = rows.filter(r=>r.play_date>=cond.slice(4));
      if (cond.startsWith('lte.')) rows = rows.filter(r=>r.play_date<=cond.slice(4));
    }
    if (t==='daily_scores' && uid && uid.startsWith('eq.')) rows = rows.filter(r=>r.user_id===uid.slice(3));
    if (t==='daily_scores' && u.searchParams.get('numeric_score')==='is.null') rows = rows.filter(r=>r.numeric_score==null);
    const inList = v => v && v.startsWith('in.(') ? v.slice(4, -1).split(',').map(decodeURIComponent) : null;
    const gIn = inList(u.searchParams.get('game_id')); if (t==='daily_scores' && gIn) rows = rows.filter(r=>gIn.includes(r.game_id));
    const uIn = inList(uid); if (t==='daily_scores' && uIn) rows = rows.filter(r=>uIn.includes(r.user_id));
    const gid = u.searchParams.get('game_id'); if (t==='daily_scores' && gid && gid.startsWith('eq.')) rows = rows.filter(r=>r.game_id===gid.slice(3));
    if ((u.searchParams.get('order')||'').startsWith('play_date.desc')) rows = [...rows].sort((a,b)=>b.play_date.localeCompare(a.play_date));
    if ((u.searchParams.get('order')||'').startsWith('play_date.asc')) rows = [...rows].sort((a,b)=>a.play_date.localeCompare(b.play_date) || a.id - b.id);
    if (t==='daily_scores' && u.searchParams.get('limit')) { const off = Number(u.searchParams.get('offset')||0); rows = rows.slice(off, off + Number(u.searchParams.get('limit'))); }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method()==='GET'?rows:[]) });
  });
  if (signedIn) await ctx.addInitScript(([me]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded','1'); localStorage.setItem('dailyGameHubSession', JSON.stringify({access_token:'x',refresh_token:'y',user:{id:me,email:'test@example.com'}})); } }, [ME]);
  return { ctx, page, errors };
}
// Games show as app icons; tap one to pop its card open (closing any other first).
async function openCard(page, id) {
  await page.evaluate(() => closePoppedCard(true));
  await page.click(`.game-card[data-id="${id}"]`);
  await page.waitForFunction(id => { const c = document.querySelector(`.game-card[data-id="${id}"]`); return c && c.classList.contains('popped') && !c.getAnimations().length; }, id);
}
module.exports = { openCard, day, today, serverState, requests, setup, server, devices, chromium, tables, ME };
