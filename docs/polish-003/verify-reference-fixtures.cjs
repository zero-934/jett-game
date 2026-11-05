/**
 * @file verify-reference-fixtures.cjs
 * @purpose Verify source-derived mockup geometry and returns; not gameplay replay coverage.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, file);
const flap = require('../../src/games/FlapFortuneLogic.ts');
const shatter = require('../../src/games/ShatterStepLogic.ts');
const jett = require('../../src/games/JettLogic.ts');
const config={worldWidth:390,worldHeight:844,gravity:.45,flapStrength:-7.5,pipeSpacing:230,pipeGapHeight:158,scrollSpeed:3,houseEdge:.03,combustionChancePerTick:.0003,rng:()=>.6};
const state=flap.createFlapFortuneState(10,config);
let firstSpawn;
for(let tick=1;tick<=152;tick++){
 // Assisted constant-centre geometry probe, explicitly NOT a human/replay fixture.
 state.playerY=476.15;state.playerVelocityY=0;
 flap.tickFlapFortune(state,false,config);
 if(!firstSpawn&&state.pipes.length===2)firstSpawn={tick,x:state.pipes.map(pipe=>pipe.x)};
}
assert.equal(state.isAlive,true);
assert.deepEqual(firstSpawn,{tick:111,x:[157,450]});
assert.deepEqual(state.pipes.map(pipe=>pipe.x),[34,327]);
assert.ok(Math.abs(state.pipes[0].topHeight-397.6)<1e-9);
assert.equal(state.pipesCleared,1);
assert.equal(flap.cashOutFlapFortune(state),10.57);
const shatterMultiplier=shatter.computeShatterMultiplier(3);
assert.ok(Math.abs(shatterMultiplier-3.2737)<1e-9);
assert.equal(Math.round(shatterMultiplier*10*100)/100,32.74);
// Jett's audited400m fixture: base computation plus one granted .03 coin bonus.
const jettBase=jett.computeMultiplier(400);
assert.equal(Math.round((jettBase+.03)*10*100)/100,14.50);
const output={note:'Source-derived, assisted geometry and payout fixtures; not gameplay/replay proof.',firstSpawn,flapAtTick152:{pipes:state.pipes,playerY:state.playerY,pipesCleared:state.pipesCleared,return:state.payout},shatter:{row:3,multiplier:shatterMultiplier,return:32.74},jett:{altitude:400,baseMultiplier:jettBase,coinBonus:.03,return:14.50}};
fs.writeFileSync(path.join(__dirname,'evidence','reference-fixtures.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
