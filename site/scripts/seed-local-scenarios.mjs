import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('.sites-runtime/scenarios',{recursive:true});
await build({stdin:{contents:"export {simulatePayroll} from './lib/payroll/simulation'; export {calculate,ENGINE} from './lib/payroll/engine'; export {entryFor,calendar} from './lib/payroll/management'; export {holidayDates} from './lib/payroll/holidays'; export {stateSchema} from './lib/payroll/validation';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/scenarios/seed-engine.mjs'});
const {simulatePayroll,calculate,ENGINE,entryFor,calendar,holidayDates,stateSchema}=await import('../.sites-runtime/scenarios/seed-engine.mjs');
const db=new DatabaseSync('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite');
const company='80fb8dfd-dac2-4a0c-97bf-a31382433a9d';
db.exec('BEGIN IMMEDIATE');
try{
 const row=db.prepare('SELECT state,version FROM companies WHERE id=?').get(company);if(!row)throw Error('Empresa alvo não encontrada');
 const before=JSON.parse(row.state);const generated=simulatePayroll(before);
 const employees=generated.employees.map(p=>{const original=before.employees.find(e=>e.id===p.id);return {...p,pis:original.pis,registration:original.registration||p.registration,admission:original.admission||p.admission,termination:original.termination,job:original.job||p.job,department:original.department||p.department};});
 const state={...before,employees,entries:before.entries.filter(e=>e.month<'2026-01'||e.month>'2026-10'),convention:before.convention};
 let replaced=0;
 for(const p of employees)for(let m=1;m<=10;m++){
  const month=`2026-${String(m).padStart(2,'0')}`;if(p.admission.slice(0,7)>month||(p.termination&&p.termination.slice(0,7)<month))continue;
  const e=entryFor(p,month),sample=generated.entries.find(e=>e.employeeId===p.id&&e.month===month),old=before.entries.find(e=>e.employeeId===p.id&&e.month===month);const holidays=holidayDates(state,month);
  Object.assign(e,calendar(month,holidays));Object.assign(e.monthly,{hours50:sample.monthly.hours50,hours100:sample.monthly.hours100,nightHours:sample.monthly.nightHours,commission:sample.monthly.commission,advance:sample.monthly.advance,holidays,calendarConfirmed:false});
  Object.assign(e,{bonus:sample.bonus,absenceDiscount:sample.absenceDiscount,otherDiscount:sample.otherDiscount,irrf:sample.irrf,confirmed:false});
  if(old){e.id=old.id;if(old.original)e.original=old.original;replaced++;}
  e.inssBase=calculate(e).base;e.paid=calculate(e).net;state.entries.push(e);
 }
 stateSchema.parse(state);const serialized=JSON.stringify(state);if(serialized.length>1400000)throw Error('Estado excede limite seguro de gravação.');
 const version=row.version+1,op=crypto.randomUUID();
 db.prepare('UPDATE companies SET state=?,version=?,op=? WHERE id=? AND version=?').run(serialized,version,op,company,row.version);
 db.prepare('INSERT INTO history (id,company,version,actor,reason,created,snapshot) VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(),company,version,'Codex — dados fictícios autorizados','CENÁRIO FICTÍCIO: salários e lançamentos de janeiro a outubro/2026 para teste visual, autorizado pelo usuário. Dados originais preservados no ponto de restauração.',new Date().toISOString(),JSON.stringify({...state,calculationVersion:ENGINE,results:state.entries.map(e=>({entryId:e.id,...calculate(e,state.convention)}))}));
 db.exec('COMMIT');
 console.log(JSON.stringify({employees:employees.length,entries:state.entries.length,replaced,version,months:[...new Set(state.entries.map(e=>e.month))],verified:db.prepare('PRAGMA integrity_check').get().integrity_check}));
}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
