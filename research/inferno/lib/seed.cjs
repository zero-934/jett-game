/**
 * @file seed.cjs
 * @purpose RESEARCH ONLY — same derivation as InfernoLogic.deriveInfernoSeed (FNV-1a 64 + splitmix64,
 *          top 53 bits) so the baseline tree (which lacks the export) gets identical numeric seeds.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const MASK64 = (1n << 64n) - 1n;
module.exports.deriveSeed = (key) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < key.length; i++) { h ^= BigInt(key.charCodeAt(i)); h = (h * 0x100000001b3n) & MASK64; }
  let z = (h + 0x9e3779b97f4a7c15n) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z ^= z >> 31n;
  const top = Number(z >> 11n);
  return top === 0 ? 1 : top;
};
