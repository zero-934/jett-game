/**
 * @file verify-baseline-probes.cjs
 * @purpose Reproduce two current Inferno behaviours for the cloud handoff, not certify RTP.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, file);
const logic = require('../../src/games/InfernoLogic.ts');
let allWild = logic.createInfernoState(10);
allWild.grid.forEach(row => row.forEach(cell => { cell.symbol = 'WILD'; }));
allWild = logic.evaluateClusters(allWild);
const scatterSymbols = [
  ['SCATTER','EMBER','FLAME'],
  ['ASH','SCATTER','COAL'],
  ['FLAME','SMOKE','SCATTER'],
];
let scatters = logic.createInfernoState(10);
scatters.grid.forEach((row, rowIndex) => row.forEach((cell, colIndex) => { cell.symbol = scatterSymbols[rowIndex][colIndex]; }));
scatters = logic.evaluateClusters(scatters);
const afterCascade = logic.cascadeInferno(scatters);
assert.equal(allWild.clusters.length, 0);
assert.equal(allWild.totalWin, 0);
assert.equal(scatters.scatterCount, 3);
assert.equal(scatters.clusters.length, 0);
assert.equal(afterCascade.freeSpinsRemaining, 0);
assert.equal(afterCascade.isComplete, true);
const output = {
  note:'Current-behaviour probes against production exports, not desired regression expectations. Revisit after a reviewed rule fix; never preserve a bug to satisfy this diagnostic.',
  allWild:{clusters:allWild.clusters.length,win:allWild.totalWin},
  scatterWithoutCluster:{scatterCount:scatters.scatterCount,clusters:scatters.clusters.length,freeSpinsBefore:scatters.freeSpinsRemaining,freeSpinsAfterCascade:afterCascade.freeSpinsRemaining,complete:afterCascade.isComplete},
};
fs.writeFileSync(path.join(__dirname, 'evidence', 'direct-logic-probes.json'), JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
