# 🎂 Birthday Cake

A 3D interactive birthday card (three.js). Builds to a single self-contained `index.html`.

```bash
npm install
npm run dev     # rebuilds index.html on every save — open it with VS Code Live Server
npm run build   # one-off build
```

- Content (name, message, candle count): `CAKE_CONFIG` at the top of `src/template.html`
- 3D scene & interactions: `src/main.js`
- `template.html` changes are picked up on the next save of `main.js` (or rerun `npm run build`)

Deploy: push, then turn on GitHub Pages (Settings → Pages → branch `main`, root). `index.html` is committed so Pages serves it directly.
