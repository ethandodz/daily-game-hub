#!/usr/bin/env node
// Runs every unit and browser test and exits non-zero if any check fails.
// Usage (from the repo): cd tests && npm install && npx playwright install chromium && npm test
//   node run-all.js [name-filter]
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'output');
fs.mkdirSync(output, { recursive: true });

const filter = process.argv[2] || '';

const runs = [
  ...fs.readdirSync(path.join(__dirname, 'unit')).map(file => ({ file: 'unit/' + file })),
  ...fs.readdirSync(path.join(__dirname, 'browser')).map(file => ({ file: 'browser/' + file })),
  // Variants driven by environment variables
  { file: 'browser/auth-test.js', env: { SIGNUP_MODE: 'existing-confirm' } },
  { file: 'browser/auth-test.js', env: { SIGNUP_MODE: 'existing-noconfirm' } },
  { file: 'browser/fk-test.js', env: { NO_PROFILE: '1' } },
  { file: 'browser/fk-test.js', env: { FK_FAIL: '1' } },
  { file: 'browser/achievements-test.js', env: { NO_ACHIEVEMENTS: '1' } }
].filter(run => run.file.endsWith('.js') && run.file.includes(filter));

let failed = 0;
let checks = 0;

for (const run of runs) {
  const name = path.basename(run.file, '.js');
  const label = run.file.startsWith('browser/') && /autofill|play/.test(name) ? ['FIXED'] : [];
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, run.file), root, path.join(output, name), ...label],
    { env: { ...process.env, ...(run.env || {}) }, encoding: 'utf8', timeout: 10 * 60 * 1000 }
  );

  const text = (result.stdout || '') + (result.stderr || '');
  const passes = (text.match(/^PASS /gm) || []).length;
  const fails = (text.match(/^FAIL /gm) || []).length;
  const crashed = result.status !== 0 && fails === 0;
  checks += passes + fails;

  const tag = run.env ? ' [' + Object.entries(run.env).map(([k, v]) => k + '=' + v).join(' ') + ']' : '';
  console.log((fails || crashed ? '✗ ' : '✓ ') + run.file + tag + '  ' + passes + ' passed' + (fails ? ', ' + fails + ' failed' : '') + (crashed ? ', crashed' : ''));

  if (fails || crashed) {
    failed += 1;
    console.log(text.split('\n').filter(line => /^FAIL |Error|at /.test(line)).slice(0, 12).map(line => '    ' + line).join('\n'));
  }
}

console.log('\n' + checks + ' checks in ' + runs.length + ' runs; ' + (failed ? failed + ' run(s) failed' : 'all passed'));
process.exitCode = failed ? 1 : 0;
