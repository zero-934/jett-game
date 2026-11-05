# Handoff validation — 2026-11-05

## Source integrity

Fetched `origin/research/jett-polish-002` and verified exact commit `151a5005753d9be45deb82b2ec7b96031ef88549`. Its parent is the requested baseline `616fd82b5a5552ad0ae26a9dbaddb78213d0f96f`. Cherry-picked onto `fix/polish-003-opus-handoff` as `b1c7482`; no patch file needed.

`git diff --stat 616fd82 -- src index.html package.json package-lock.json .github` produced **no output**. This package adds design/research documents, assets and dev-only reference tooling. No production implementation, package upgrade, main merge or deployment was performed.

## Rerun here

Windows / Node project environment, original lockfile, no additional project dependencies. Exact log files are in `evidence/`.

| Command | Result |
|---|---|
| `npm ci` | Pass;326 packages installed. Audit reported22 advisories; no automatic dependency remediation applied. |
| `npm run build` | Pass; TypeScript + Vite. JS1543.94 kB /398.75 kB gzip; existing large-chunk warning. |
| `node node_modules/jest/bin/jest.js --config jest.config.cjs src/tests/JettLogic.test.ts src/tests/FlapFortuneLogic.test.ts src/tests/ShatterStepLogic.test.ts --runInBand` | **42/42**,3 suites;26.436s. Original production logic, not corrected behaviour. |
| `node node_modules/jest/bin/jest.js --config research/jest.research.cjs --runInBand` | **36/36**,7 suites;7.023s. Some tests intentionally characterize current defects. |
| `node node_modules/jest/bin/jest.js --config research/jest.masked-rng.cjs src/tests/BallDropLogic.test.ts --runInBand` | **24/24**,1 suite;3.308s. Research replacement only; production RNG unchanged. |
| `node docs/polish-003/render-mockups.cjs` | Generates36 standalone screen SVGs, one glass storyboard, tokens and local viewer. |
| `node docs/polish-003/verify-reference-fixtures.cjs` | Pass: source-derived Flap first spawn tick111 at157/450; tick152 at34/327, gap397.6–555.6, return10.57. Shatter row3 multiplier3.2737 →32.74. Jett400m base1.4202 +one.03 bonus →14.50. |

The fixture script resets Flap's vertical position/velocity each tick to inspect geometry. It is explicitly **assisted**, not a human playthrough or replay test. The renderer is a design artifact; its successful generation does not validate the production renderer. The normal full multi-game suite was not rerun for this docs-only addition; Opus's existing all-game results and known seed-pinned differences are retained in polish-002. A production shared RNG/runner change requires the complete suite.

## Visual QA

Opened the local design viewer in a browser and checked playing, cashed-out, loss, emerald/violet themes, glass sequence and comparison board. Browser captures are committed under `renders/`. All are labelled as proposed artist references. Baseline comparison uses actual Opus ready-screen captures on the left, concepts on the right; it is not a claim of implemented “after” results.

Checked visible return/net/balance arithmetic and separated the cash-out footer from gameplay. Source fixture checks independently verify the geometry and payout samples used in the brief. SVGs embed the character PNGs and can be opened standalone. The miniature labels and placeholder icons are called out for production accessibility changes; reference art is not accessibility certification.

## Performance evidence and unresolved risks

No new gameplay performance gain is claimed. The preserved Opus software-WebGL baseline reports Jett60 fps /30 at4× throttle, Shatter idle47.7 /23.7 at4×. Use these only as within-environment comparisons; see `docs/polish-002/TEST_AND_BENCHMARK_REPORT.md` and `evidence/browser-dynamics-perf.json` there.

1. **Economics/trust:** unsupported RTP claims, skill strategy dependence and Shatter's72.75% upper bound require explicit handling. No paytable retune has been approved or applied.
2. **RNG compatibility:** corrected state masking changes sequences outside the three games; Inferno/Surge seed-pinned expectations need review. CSPRNG seed generation alone is not a fairness protocol.
3. **Timing:** proposed runner drops long-hitch time. Production needs tested debt/pause semantics and real renderer interpolation, not merely a helper's passing tests.
4. **Input/settlement:** actual UI routing, dive-exit compatibility, same-tick ordering and delayed callback guards remain implementation work.
5. **Art scale:** small wizard/pilot legibility, glass transparency and high-DPR texture cost need real Phaser captures; supplied studies are not animation atlases.
6. **Mobile/accessibility:** no new real-phone/Safari/GPU validation. Readable minimum text, safe-area layout, accessible shell and reduced motion remain acceptance work.
7. **Deployment/toolchain:** existing main deployment has no test gate;22 dev/build advisories and bundle size need review. No deployment workflow was triggered or modified.

Recommended next review: corrected simulation/settlement plus three scoped art pilots with actual browser captures and a complete automated report. Expand the theme only after that review.
