/**
 * @file load-ts.cjs
 * @purpose RESEARCH ONLY — registers a minimal TypeScript transpile hook so Node scripts can
 *          require the real production `.ts` modules (no reimplementation of game maths).
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(out, file);
};
/** Resolve a repo root (defaults to two levels up from research/inferno). */
module.exports.repoRoot = (override) => override || require('node:path').resolve(__dirname, '..', '..', '..');
