# Qlik Script Studio

Build Qlik Sense / QlikView load scripts visually, without writing code.
Runs entirely in your browser: no backend, no account, nothing leaves your machine.

> Work in progress. See [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Features (so far)

- Source tables: QVD, Excel, CSV, SQL and inline, with connection (`lib://`) and format options
- Fields entered manually, pasted from a header row, or detected from a sample CSV/XLSX file
- Live, deterministic script preview with Qlik syntax highlighting; copy or download as `.qvs`
- Regional presets (EN / TR), Qlik Sense or QlikView path style, `///$tab` sections
- Autosave in the browser, JSON import/export, undo/redo, light/dark theme, English and Turkish UI

## Local setup

```bash
npm install
npm run dev
```

Other scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

## License

MIT
