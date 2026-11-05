/**
 * @file determinism-probe.cjs
 * @purpose RESEARCH ONLY — same session seed + same actions under different presentation settings
 *          (frame pacing 30/60/120/144 via setTimeout loop, reduced motion, quick spin, tap-to-skip,
 *          muted audio) must yield identical grids, ledgers and balances. Crown is always collected.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const { open } = require('../capture/lib.cjs');
const SPINS = 12;
const CONFIGS = [
  ['raf-default', ''], ['fps30', 'fps=30&timeout=1'], ['fps60', 'fps=60&timeout=1'], ['fps120', 'fps=120&timeout=1'], ['fps144', 'fps=144&timeout=1'],
  ['reduced-motion', 'reduced=1'], ['quick-spin', 'quick=1'], ['skip-every-spin', 'skip=1'], ['audio-muted', 'music=0&sfx=0'],
];
(async () => {
  const results = [];
  for (const [name, q] of CONFIGS) {
    const { browser, page, errors } = await open(`seed=determinism&${q}`);
    const t0 = Date.now();
    const trace = await page.evaluate(async ({ spins, skip }) => {
      const s = window.__inferno.scene();
      const until = (fn) => new Promise((res) => { const iv = setInterval(() => { if (fn()) { clearInterval(iv); res(); } }, 10); });
      const rows = [];
      for (let i = 0; i < spins; i++) {
        await until(() => s.session.phase === 'ready');
        s.handleSpinPress();
        if (skip) setTimeout(() => s.ui.requestSkip(), 50);
        await until(() => s.session.phase === 'ready' || s.session.phase === 'decision');
        if (s.session.phase === 'decision') s.handleCollect(s.session.roundId);
        await until(() => s.session.phase === 'ready');
        rows.push({ r: s.session.roundId, bal: s.session.balanceMilli, heat: s.session.state.heatMeter, fs: s.session.state.freeSpinsRemaining, grid: s.session.state.grid.map((x) => x.map((c) => c.symbol[0] + c.symbol[1])).join('|') });
      }
      return { rows, ledger: s.session.ledger, frames: window.__inferno.frames.length };
    }, { spins: SPINS, skip: q.includes('skip=1') });
    results.push({ name, query: q, ms: Date.now() - t0, finalBalance: trace.rows[trace.rows.length - 1].bal, trace, errors });
    await browser.close();
  }
  const ref = JSON.stringify(results[0].trace.rows) + JSON.stringify(results[0].trace.ledger);
  const summary = results.map((r) => ({ name: r.name, wallMs: r.ms, finalBalanceMilli: r.finalBalance, identicalToRaf: JSON.stringify(r.trace.rows) + JSON.stringify(r.trace.ledger) === ref, errors: r.errors.length }));
  console.log(JSON.stringify({ spins: SPINS, summary, referenceRows: results[0].trace.rows }, null, 2));
})();
