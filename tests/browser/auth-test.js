const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const fresh = async () => { const x = await m.setup(browser, { ...m.devices['iPhone 13'] }, false); return x; };
  const mode = process.env.SIGNUP_MODE || 'new';
  // sign up
  let { page, errors, ctx } = await fresh();
  await page.goto(url); await page.waitForTimeout(800);
  await page.click('#homeLoginButton'); await page.fill('#authEmail', 'friend@example.com'); await page.fill('#authPassword', 'secret123');
  await page.click('#signUpButton'); await page.waitForTimeout(500);
  const status = await page.textContent('#authStatus');
  if (mode === 'new') assert(status === 'Account created. Check your email to confirm it.', 'new email: asks to confirm (' + status + ')');
  else assert(status.startsWith('This email already has an account.'), mode + ': clear existing-account message (' + status + ')');
  if (mode !== 'new') { await ctx.close(); await browser.close(); m.server.close(); return; }
  // forgot password
  await page.fill('#authEmail', '');
  await page.click('#forgotPasswordButton'); await page.waitForTimeout(200);
  assert((await page.textContent('#authStatus')).startsWith('Enter your email above'), 'forgot password: asks for email first');
  await page.fill('#authEmail', 'friend@example.com');
  await page.click('#forgotPasswordButton'); await page.waitForTimeout(500);
  const rec = m.requests.filter(r => r.url.includes('/auth/v1/recover')).pop();
  assert(rec && JSON.parse(rec.body).email === 'friend@example.com' && decodeURIComponent(rec.url).includes('redirect_to=' + url), 'forgot password: sends reset with link back to the app');
  assert((await page.textContent('#authStatus')).startsWith('If that email has an account, a reset link is on its way'), 'forgot password: neutral confirmation');
  await ctx.close();
  // reset link
  ({ page, errors, ctx } = await fresh());
  await page.goto(url + '#access_token=tok123&refresh_token=ref456&expires_in=3600&token_type=bearer&type=recovery'); await page.waitForTimeout(1500);
  assert(await page.evaluate(() => location.hash === '' && JSON.parse(localStorage.getItem('dailyGameHubSession')).access_token === 'tok123'), 'reset link: signed in, token removed from address');
  assert(await page.evaluate(() => document.getElementById('newPasswordModal').classList.contains('open')), 'reset link: asks for a new password');
  await page.fill('#newPasswordInput', 'newpass1'); await page.fill('#confirmPasswordInput', 'newpass2'); await page.click('#saveNewPasswordButton');
  assert((await page.textContent('#newPasswordStatus')).includes('don’t match'), 'new password: must match');
  await page.fill('#confirmPasswordInput', 'newpass1'); await page.click('#saveNewPasswordButton'); await page.waitForTimeout(500);
  const put = m.requests.filter(r => r.method === 'PUT' && r.url.includes('/auth/v1/user')).pop();
  assert(put && JSON.parse(put.body).password === 'newpass1', 'new password: saved to Supabase');
  assert((await page.textContent('#newPasswordStatus')).startsWith('Password updated'), 'new password: confirmation shown');
  await page.screenshot({ path: process.argv[3] + '-newpass.png' });
  assert(errors.length === 0, 'reset flow: no console errors ' + errors.join('|'));
  await ctx.close();
  // expired link
  ({ page, errors, ctx } = await fresh());
  await page.goto(url + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'); await page.waitForTimeout(800);
  assert(await page.evaluate(() => document.getElementById('accountModal').classList.contains('open') && location.hash === '') && (await page.textContent('#authStatus')).startsWith('That email link has expired'), 'expired link: clear message');
  await ctx.close();
  // confirmation link
  ({ page, errors, ctx } = await fresh());
  await page.goto(url + '#access_token=tokC&refresh_token=refC&expires_in=3600&token_type=bearer&type=signup'); await page.waitForTimeout(1500);
  assert(await page.evaluate(() => !!JSON.parse(localStorage.getItem('dailyGameHubSession') || 'null') && !document.getElementById('newPasswordModal').classList.contains('open')) && await page.isVisible('#gameGrid'), 'confirmation link: signed in, no password prompt');
  assert(errors.length === 0, 'confirmation link: no console errors ' + errors.join('|'));
  await ctx.close();
  await browser.close(); m.server.close();
});
