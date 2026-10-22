// Pull a block of code out of app.js (between two markers) so unit
// tests exercise the real functions without a browser.
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8').replace(/\r\n/g, '\n');

function extract(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  if (start === -1) throw new Error('start marker not found in app.js: ' + startMarker);
  const end = appSource.indexOf(endMarker, start);
  if (end === -1) throw new Error('end marker not found in app.js: ' + endMarker);
  return appSource.slice(start, end);
}

module.exports = { extract };
