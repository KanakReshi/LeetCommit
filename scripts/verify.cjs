#!/usr/bin/env node
const {execSync} = require('child_process');

console.log('=== LeetCommit Build Verification ===\n');

const steps = [
  { name: 'TypeScript Check', cmd: 'npx tsc --noEmit' },
  { name: 'Build', cmd: 'npx vite build && node scripts/build.mjs' },
];

for (const step of steps) {
  try {
    console.log(`▶ ${step.name}...`);
    execSync(step.cmd, { cwd: __dirname + '/..', stdio: 'inherit', timeout: 60000 });
    console.log(`  ✓ ${step.name} passed\n`);
  } catch (e) {
    console.log(`  ✗ ${step.name} failed (exit ${e.status})\n`);
  }
}
