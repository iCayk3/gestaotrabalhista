import assert from 'node:assert/strict';
import {blankEntry,initialState} from '../lib/payroll/engine.ts';
import {indicators} from '../lib/payroll/indicators.ts';
const a={...blankEntry(),employee:'Pessoa A',month:'2026-01',salary:1000,extra50:100};
const b={...a,id:crypto.randomUUID(),month:'2026-02',salary:2000,extra50:200};
const older={...a,id:crypto.randomUUID(),month:'2025-01',salary:9000};
const r=indicators({...initialState(),entries:[a,b,older]},'2026');
assert.equal(r.entries.length,2);assert.equal(r.extras,300);assert.equal(r.ranking.length,1);assert.equal(r.ranking[0].value,300);assert.equal(r.ranking[0].missingHours,true);assert.equal(r.months[2].count,0);assert.equal(r.gross,r.months[0].gross+r.months[1].gross);assert.equal(indicators(initialState(),'2026').entries.length,0);
console.log('Indicadores: filtro anual, agrupamento, totais mensais, ranking e meses ausentes verificados.');
