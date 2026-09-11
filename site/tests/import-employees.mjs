import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {readEmployees,importIssues,prepareUpdates,mergeImported} from '../lib/payroll/import-employees.ts';
import {stateSchema} from '../lib/payroll/validation.ts';
import {initialState} from '../lib/payroll/engine.ts';
const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Relatório'],[],['Nome','PIS'],['Pessoa fictícia','01234567890']]));
for(const bookType of ['xlsx','biff8']){
 const rows=readEmployees(XLSX.write(book,{type:'array',bookType}));assert.equal(rows.length,1);assert.equal(rows[0].employee.pis,'01234567890');assert.deepEqual(importIssues(rows[0],[],rows),[]);
 const p=rows[0].employee;Object.assign(p,{registration:'001',admission:'2020-01-01',job:'Técnico'});p.contracts[0].salary=1700;
 assert.deepEqual(importIssues(rows[0],[],rows),[]);
 assert.ok(importIssues(rows[0],[{...p,id:crypto.randomUUID()}],rows).length);
 assert.equal(stateSchema.parse({...initialState(),employees:[p]}).employees[0].pis,'01234567890');
}
const formatted=XLSX.utils.book_new();XLSX.utils.book_append_sheet(formatted,XLSX.utils.aoa_to_sheet([['Nome','Matrícula','Admissão','Cargo','Salário'],['Pessoa teste','002','Sex, 31/01/2020','Técnico','1.700,50']]));
const rows=readEmployees(XLSX.write(formatted,{type:'array',bookType:'xlsx'}));assert.equal(rows[0].employee.admission,'2020-01-31');assert.equal(rows[0].employee.contracts[0].salary,1700.5);assert.deepEqual(importIssues(rows[0],[],rows),[]);
console.log('Importação XLS/XLSX: cabeçalho após título, zeros no PIS, dados ausentes, duplicidade, datas brasileiras, moeda e persistência validados.');
const existing=structuredClone(rows[0].employee);existing.contracts[0].danger=true;
const incoming=structuredClone(rows[0]);incoming.employee.id=crypto.randomUUID();incoming.employee.job='Novo cargo';incoming.employee.contracts[0].salary=0;incoming.salaryProvided=false;
const prepared=prepareUpdates([incoming],[existing]);
assert.equal(prepared[0].update,true);assert.equal(prepared[0].employee.id,existing.id);
assert.equal(prepared[0].employee.contracts[0].salary,1700.5);assert.equal(prepared[0].employee.contracts[0].danger,true);
assert.deepEqual(importIssues(prepared[0],[existing],prepared),[]);
const merged=mergeImported([existing],prepared.map(r=>r.employee));assert.equal(merged.length,1);assert.equal(merged[0].job,'Novo cargo');
assert.ok(importIssues(prepared[0],[existing],[prepared[0],{...prepared[0]}]).length);
