// Regenerates public/THIRD_PARTY_NOTICES.txt from the dependencies that ship inside the app.
//   npm run notices
// The file is copied into dist/ (web) and packaged inside the desktop installers.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../node_modules/${p}/package.json`, import.meta.url), 'utf8'));
const FONTS = ['jetbrains-mono', 'fira-code', 'ibm-plex-mono', 'space-mono', 'space-grotesk', 'source-code-pro', 'roboto-mono', 'inconsolata'];

const out = [];
out.push('THIRD-PARTY NOTICES');
out.push('===================');
out.push('zapped is proprietary software (see LICENSE). It includes the third-party');
out.push('components below, which remain under their own licenses.');
out.push('');
out.push('FONTS (SIL Open Font License 1.1, via @fontsource)');
out.push('-------------------------------------------------');

// Fontsource ships only "Google Inc." for this one; the upstream notice is Adobe's.
const COPYRIGHT_OVERRIDES = {
  'source-code-pro': 'Copyright 2010, 2012, 2014 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name "Source".',
};

let oflText = '';
for (const name of FONTS) {
  const pkg = read(`@fontsource/${name}`);
  const license = readFileSync(new URL(`../node_modules/@fontsource/${name}/LICENSE`, import.meta.url), 'utf8').trim();
  const [first = '', ...rest] = license.split(/\n\s*\n/);
  const copyright = COPYRIGHT_OVERRIDES[name] ?? first.split(/\s+\S+\.ttf:\s+/)[0]?.replace(/\s+/g, ' ').trim() ?? first;
  out.push(`* ${pkg.name}@${pkg.version}`);
  out.push(`  ${copyright}`);
  if (!oflText) oflText = rest.join('\n\n').trim();
}
out.push('');
out.push('These fonts are used unmodified, as distributed by the Fontsource project.');
out.push('"Reserved Font Names" declared by the authors are respected.');
out.push('');
out.push(oflText);
out.push('');

out.push('RUNTIME LIBRARIES (desktop app)');
out.push('-------------------------------');
const updater = read('electron-updater');
const libs = [updater, ...Object.keys(updater.dependencies ?? {}).map((d) => read(d))];
for (const p of libs) {
  const repo = typeof p.repository === 'string' ? p.repository : p.repository?.url ?? '';
  out.push(`* ${p.name}@${p.version} — ${p.license}${repo ? ` — ${repo.replace(/^git\+/, '')}` : ''}`);
}
out.push('');
out.push('ELECTRON AND CHROMIUM (desktop app)');
out.push('-----------------------------------');
out.push('The desktop app is built on Electron (MIT License, Copyright (c) Electron contributors,');
out.push('Copyright (c) 2013-2020 GitHub Inc.) and Chromium. The full list of Chromium and Electron');
out.push('licenses is installed with the app in LICENSES.chromium.html and LICENSE.electron.txt.');
out.push('');
out.push('The MIT License permits use, copying and distribution of these libraries provided that');
out.push('their copyright and permission notice are included; the notice texts are available in each');
out.push('package at the repository URLs listed above.');
out.push('');

writeFileSync(new URL('../public/THIRD_PARTY_NOTICES.txt', import.meta.url), out.join('\n'));
console.log('Wrote public/THIRD_PARTY_NOTICES.txt');
