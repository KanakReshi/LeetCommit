/**
 * Post-build script for LeetCommit Firefox Extension.
 *
 * Orchestrates the multi-entry build:
 * 1. Build popup (with emptyOutDir to start clean)
 * 2. Build content script (IIFE)
 * 3. Build background script (IIFE)
 * 4. Copy manifest.json and icons to dist
 * 5. Validate dist structure
 */

import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

function log(msg) {
  console.log(`  ${msg}`);
}

function copyFile(src, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
  log(`✓ ${src.replace(ROOT + '/', '')} → ${dest.replace(ROOT + '/', '')}`);
}

function copyDir(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    console.warn(`  ⚠ Source directory not found: ${srcDir}`);
    return;
  }

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  for (const file of readdirSync(srcDir)) {
    const srcFile = join(srcDir, file);
    if (statSync(srcFile).isFile()) {
      copyFile(srcFile, join(destDir, file));
    }
  }
}

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    log(`✓ ${label} complete`);
  } catch {
    console.error(`  ✗ ${label} failed`);
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────

console.log('\n📦 LeetCommit Build\n');

// Step 1: Build popup (cleans dist)
run('npx vite build', 'Building popup');

// Step 2: Build content script (IIFE)
run('ENTRY=content npx vite build', 'Building content script');

// Step 3: Build background script (IIFE)
run('ENTRY=background npx vite build', 'Building background script');

// Step 4: Copy static assets
console.log('\n▶ Copying static assets');
copyFile(join(ROOT, 'manifest.json'), join(DIST, 'manifest.json'));
copyDir(join(ROOT, 'public', 'icons'), join(DIST, 'icons'));

// Step 5: Validate
console.log('\n▶ Validating dist');
const expectedFiles = ['manifest.json', 'content.js', 'background.js', 'popup.html'];
const missing = expectedFiles.filter((f) => !existsSync(join(DIST, f)));

if (missing.length > 0) {
  console.error(`\n❌ Missing files in dist: ${missing.join(', ')}`);
  process.exit(1);
}

// List all files in dist
console.log('\n  dist/ contents:');
function listDir(dir, prefix = '  ') {
  for (const entry of readdirSync(dir).sort()) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      console.log(`${prefix}📁 ${entry}/`);
      listDir(fullPath, prefix + '  ');
    } else {
      const size = (stat.size / 1024).toFixed(1);
      console.log(`${prefix}📄 ${entry} (${size} KB)`);
    }
  }
}
listDir(DIST);

console.log('\n✅ Build complete! Load dist/ in about:debugging.\n');
