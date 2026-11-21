// Bundles src/main.js (three.js included) and inlines it into one self-contained index.html.
// node build.mjs          -> build once
// node build.mjs --watch  -> rebuild on every save
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const inline = {
  name: 'inline-html',
  setup(build) {
    build.onEnd((r) => {
      if (r.errors.length) return;
      const js = r.outputFiles[0].text;
      const html = readFileSync('src/template.html', 'utf8').replace('/*BUNDLE*/', () => js);
      writeFileSync('index.html', html);
      console.log(`[${new Date().toLocaleTimeString()}] built index.html (${(html.length / 1024) | 0} KB)`);
    });
  },
};
const ctx = await esbuild.context({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife',
  target: 'es2019', write: false, plugins: [inline],
});
if (process.argv.includes('--watch')) { await ctx.watch(); console.log('watching src/ …'); }
else { await ctx.rebuild(); await ctx.dispose(); }
