import { defineConfig, loadEnv, type UserConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

/**
 * Vite config for LeetCommit Firefox Extension.
 *
 * We build each entry point separately to avoid code-splitting issues
 * with IIFE format (required for content scripts / background scripts).
 * The popup entry uses standard ES module format since it loads via
 * <script type="module">.
 *
 * Usage:
 *   ENTRY=content vite build   → builds content.js
 *   ENTRY=background vite build → builds background.js
 *   ENTRY=popup vite build     → builds popup.html + popup.js
 *
 * The npm `build` script calls all three sequentially.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'LEETCOMMIT_');
  const entry = process.env.ENTRY || 'all';

  const sharedConfig: UserConfig = {
    envPrefix: 'LEETCOMMIT_',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      __API_URL__: JSON.stringify(
        env.LEETCOMMIT_API_URL || 'http://localhost:3000/api/submissions'
      ),
      __API_KEY__: JSON.stringify(env.LEETCOMMIT_API_KEY || ''),
    },
    plugins: [react()],
  };

  // ── Content script build ─────────────────────────────────────
  if (entry === 'content') {
    return {
      ...sharedConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        sourcemap: mode === 'development' ? 'inline' : false,
        minify: mode === 'production',
        target: 'firefox115',
        lib: {
          entry: resolve(__dirname, 'src/content/index.ts'),
          name: 'LeetCommitContent',
          formats: ['iife'],
          fileName: () => 'content.js',
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  // ── Background script build ──────────────────────────────────
  if (entry === 'background') {
    return {
      ...sharedConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        sourcemap: mode === 'development' ? 'inline' : false,
        minify: mode === 'production',
        target: 'firefox115',
        lib: {
          entry: resolve(__dirname, 'src/background/index.ts'),
          name: 'LeetCommitBackground',
          formats: ['iife'],
          fileName: () => 'background.js',
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  // ── Popup build ──────────────────────────────────────────────
  // Set root to src/popup so Vite outputs popup.html at dist/
  // rather than dist/src/popup/popup.html.
  if (entry === 'popup') {
    return {
      ...sharedConfig,
      root: resolve(__dirname, 'src/popup'),
      build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: false,
        sourcemap: mode === 'development' ? 'inline' : false,
        minify: mode === 'production',
        target: 'firefox115',
        rollupOptions: {
          input: {
            popup: resolve(__dirname, 'src/popup/popup.html'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]',
          },
        },
      },
    };
  }

  // ── Default: build all (for `vite build` without ENTRY) ──────
  // Used by the first step of the build script. Builds popup only
  // (content/background are built separately as IIFE libs).
  return {
    ...sharedConfig,
    root: resolve(__dirname, 'src/popup'),
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
      sourcemap: mode === 'development' ? 'inline' : false,
      minify: mode === 'production',
      target: 'firefox115',
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/popup.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
  };
});
