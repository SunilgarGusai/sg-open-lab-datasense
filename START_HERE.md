# DataSense 0.4.1 alpha — start here

Analyze a local CSV, inspect statistics and charts, and download eight report
formats. Data is processed in your browser. This is an internal alpha.

## Windows

1. Extract the complete runtime ZIP to a folder you can write to.
2. Double-click **Start DataSense.cmd**. The app opens in your browser.
3. Choose **Sample scores** to try it, or open your UTF-8 CSV.
4. Double-click **Stop DataSense.cmd** when finished.

This machine's existing Node runtime is detected automatically. On another
machine install Node.js 22 or newer from https://nodejs.org first. No npm,
Python, account, internet connection or dependency installation is needed to
run the prepared package. A modern desktop browser is required.

The launcher runs a local server accessible only on this computer, checks every
published file against the package manifest, and remembers its port under
`.runtime/`. Start opens the same running instance again; Stop targets only that
instance. If Windows shows the downloaded-file warning, verify the package
checksum and review its scripts before running it.

## macOS / Linux / manual launch

From the extracted folder, with Node.js 22 or newer:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8765/. Press Ctrl+C in that terminal to stop.
If the port is in use, add `--port 8766`, or `--port 0` for an available port.

## Your data

Use comma-delimited UTF-8 CSV with one header row. Maximum size: 5 MiB,
50,000 data rows and 100 columns. Large files can take several seconds.
Missing and invalid values are counted separately. Choose a numeric column,
adjust histogram groups, and review the exact tables alongside the charts.
Narrow screens can scroll charts and tables horizontally; keyboard users can
Tab to each region and use the arrow keys.

Exports include numerical outliers and descriptive metadata. Review them before
sharing. The tool does not upload your CSV or save it in browser storage.

## Hosting and limitations

Read `docs/DEPLOYMENT.md` for static hosting, project subpaths, HTTPS and rollback.
The runtime ZIP contains the complete built site. No public website is included
in this local installation. Public-beta approval, actual Safari/device and
screen-reader checks, an independent pilot and ownership/licensing decisions
remain separate release gates.
