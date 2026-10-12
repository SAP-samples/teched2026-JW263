#!/usr/bin/env node
// Usage: node analyze-har.js <path-to-file.har>

const fs = require('fs');
const https = require('https');
const path = require('path');

const UI5_VERSION_URL = 'https://ui5.sap.com/resources/sap-ui-version.json';

function isExcluded(url) {
  if (/library-preload/i.test(url)) return true;
  if (/messagebundle/i.test(url)) return true;
  if (/library\.css/i.test(url)) return true;
  if (/manifest\.json/i.test(url)) return true;
  if (/metadata\.json/i.test(url)) return true;
  if (/\.woff2/i.test(url)) return true;
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp)/i.test(url)) return true;
  if (/\/lrep\/flex\//i.test(url)) return true;
  if (/component-preload\.js/i.test(url)) return true;
  if (/\$metadata|\$batch|\/odata\/|\/sap\/opu\//i.test(url)) return true;
  if (/sap-ui-version\.json/i.test(url)) return true;
  if (/cldr\//i.test(url)) return true;
  return false;
}

function getGroup(urlStr) {
  const url = new URL(urlStr);
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'sapui5.hana.ondemand.com') {
    // path: /<version>/resources/sap/<lib>/[<sublib>/...]
    if (parts[2] === 'sap' && parts[3] === 'ui' && parts[4]) return 'sap/ui/' + parts[4];
    if (parts[2] === 'sap' && parts[3]) return 'sap/' + parts[3];
    return parts.slice(1, 3).join('/');
  }
  return url.hostname;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function hr() { console.log('-'.repeat(60)); }

async function main() {
  const harPath = process.argv[2];
  if (!harPath) {
    console.error('Usage: node analyze-har.js <path-to-file.har>');
    process.exit(1);
  }

  const har = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
  const entries = har.log.entries;
  const remaining = entries.filter(e => !isExcluded(e.request.url));

  // Group
  const groups = {};
  remaining.forEach(e => {
    const g = getGroup(e.request.url);
    groups[g] = (groups[g] || 0) + 1;
  });
  const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);

  hr();
  console.log(`File: ${path.basename(harPath)}`);
  hr();
  console.log(`Total requests:            ${entries.length}`);
  console.log(`After filtering:           ${remaining.length}`);
  hr();

  console.log('\nGroups:\n');
  sorted.forEach(([g, n]) => console.log(`  ${String(n).padStart(4)}  ${g}`));

  // Fetch UI5 library list
  let libraries = [];
  try {
    const versionJson = await fetchJson(UI5_VERSION_URL);
    libraries = versionJson.libraries.map(l => l.name);
    console.log(`\nUI5 libraries found: ${libraries.length} (from ${UI5_VERSION_URL})`);
  } catch (e) {
    console.warn('\nWarning: could not fetch UI5 library list:', e.message);
  }

  // Match groups to libraries (dots = slashes)
  const libSet = new Set(libraries.map(l => l.replace(/\./g, '/')));

  hr();
  console.log('\nRecommendations for manifest.json:\n');
  console.log(
    'Group'.padEnd(24) +
    'Library'.padEnd(24) +
    'Requests'.padEnd(12) +
    'Action'
  );
  console.log('-'.repeat(72));

  const suggest = [], consider = [];

  sorted.forEach(([g, n]) => {
    if (n < 2) return;
    const matched = libSet.has(g);
    const lib = matched ? g.replace(/\//g, '.') : '(not a library)';
    let action;
    if (n > 5)         action = matched ? '✔ Add dependency'   : '— not a library';
    else if (n >= 2)   action = matched ? '? Consider adding'  : '— not a library';

    console.log(
      g.padEnd(24) +
      lib.padEnd(24) +
      String(n).padEnd(12) +
      action
    );

    if (matched && n > 5)  suggest.push(lib);
    if (matched && n >= 2 && n <= 5) consider.push(lib);
  });

  if (suggest.length || consider.length) {
    hr();
    console.log('\nSuggested manifest.json libs block:\n');
    const all = [...suggest, ...consider];
    const libsBlock = all.map(l => `      "${l}": {}`).join(',\n');
    console.log('  "libs": {');
    console.log(libsBlock);
    console.log('  }');
  }

  console.log('');
  hr();
}

main().catch(e => { console.error(e); process.exit(1); });
