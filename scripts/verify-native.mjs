/**
 * Guards the mistake that is easy to make and silent to discover: running a
 * bare `cap sync` after `npm run build` copies the WEB bundle into the native
 * projects. That bundle has no absolute API URL, so the app resolves the API
 * to capacitor://localhost - itself - and every screen reports a failure to
 * connect. Nothing about the build fails, so the first sign is a broken app on
 * a device.
 */
import { readdirSync, readFileSync } from 'fs';

const EXPECTED = 'https://turing-test.app';
const targets = [
  'android/app/src/main/assets/public/assets',
  'ios/App/App/public/assets',
];

let failed = false;

for (const dir of targets) {
  let carries = false;
  try {
    carries = readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .some((f) => readFileSync(`${dir}/${f}`, 'utf8').includes(EXPECTED));
  } catch {
    console.error(`  ${dir} is missing. Run: npm run sync`);
    failed = true;
    continue;
  }

  if (!carries) {
    console.error(`\n  ${dir} carries the web bundle, not the native one.`);
    console.error(`  It has no absolute API URL, so the app would talk to itself.`);
    console.error(`  Fix: npm run sync\n`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Native bundles carry the production API URL.');
