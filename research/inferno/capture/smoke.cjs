const { open, tap, dbg, waitPhase } = require('./lib.cjs');
(async () => {
  const { browser, page, errors } = await open('seed=smoke');
  console.log(JSON.stringify(await dbg(page)).slice(0, 400));
  await page.screenshot({ path: '/tmp/claude-0/smoke-ready.png' });
  await tap(page, 195, 716);
  await page.waitForTimeout(450);
  await page.screenshot({ path: '/tmp/claude-0/smoke-mid.png' });
  await waitPhase(page, ['ready', 'decision']);
  console.log(JSON.stringify(await dbg(page)).slice(0, 600));
  await page.screenshot({ path: '/tmp/claude-0/smoke-after.png' });
  console.log('errors', errors);
  await browser.close();
})();
