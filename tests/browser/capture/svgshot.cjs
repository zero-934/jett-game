const { chromium } = require('playwright'); const path=require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
for (const f of process.argv.slice(3)) { await p.goto('file://' + path.resolve(f)); await p.waitForTimeout(300); await p.screenshot({ path: process.argv[2] + '/' + path.basename(f, '.svg') + '.png' }); }
await b.close(); })();
