import * as XLSX from 'xlsx';
import {blankEmployee,type Employee} from './management';
import {employeeSchema} from './management-validation';
const normalize=(v:unknown)=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
export type ImportRow={employee:Employee;line:number;selected:boolean;error:string;update?:boolean;salaryProvided?:boolean};
export function readEmployees(data:ArrayBuffer):ImportRow[]{
  const book=XLSX.read(data,{type:'array',cellDates:false,cellFormula:true,sheetRows:503});
  const sheet=book.Sheets[book.SheetNames[0]];
  if(!sheet)throw new Error('A planilha não contém uma aba.');
  const range=XLSX.utils.decode_range(sheet['!fullref']??sheet['!ref']??'A1');
  if(range.e.r>502||range.e.c>50)throw new Error('Use até 500 colaboradores e 51 colunas.');
  const rows=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',raw:false});
  const header=rows.findIndex(r=>r.some(v=>['nome','nome completo','colaborador'].includes(normalize(v))));
  if(header<0)throw new Error('Não encontrei a coluna Nome na primeira aba.');
  const headers=rows[header].map(normalize);
  const find=(...aliases:string[])=>headers.findIndex(v=>aliases.includes(v));
  const cols={name:find('nome','nome completo','colaborador'),pis:find('pis','pis/pasep','nit'),registration:find('matricula'),admission:find('admissao','data de admissao'),job:find('cargo','cargo / funcao','cargo/funcao','funcao','nome do cargo','descricao do cargo','cargo do colaborador','cargos'),salary:find('salario','salario base','salario mensal'),department:find('setor','departamento')};
  const result:ImportRow[]=[];
  for(let i=header+1;i<rows.length;i++){
    const row=rows[i];if(row.every(v=>String(v??'').trim()===''))continue;
    const employee=blankEmployee();const get=(key:keyof typeof cols)=>String(row[cols[key]]??'').trim();
    employee.name=get('name');employee.pis=get('pis').replace(/[.\-\s]/g,'');employee.registration=get('registration');employee.job=get('job');employee.department=get('department');
    const rawDate=get('admission');const br=rawDate.match(/(?:^|\s)(\d{2})\/(\d{2})\/(\d{4})$/);employee.admission=br?`${br[3]}-${br[2]}-${br[1]}`:rawDate;
    const dateCell=cols.admission>=0?sheet[XLSX.utils.encode_cell({r:i,c:cols.admission})]:null;
    if(dateCell?.t==='n'){const d=XLSX.SSF.parse_date_code(dateCell.v,{date1904:!!book.Workbook?.WBProps?.date1904});if(d)employee.admission=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
    const rawSalary=get('salary').replace(/R\$|\s/g,'');const salary=rawSalary.includes(',')?Number(rawSalary.replace(/\./g,'').replace(',','.')):Number(rawSalary);
    employee.contracts[0].salary=salary;
    const formula=Object.values(cols).some(c=>c>=0&&sheet[XLSX.utils.encode_cell({r:i,c})]?.f);
    result.push({employee,line:i+1,selected:true,salaryProvided:rawSalary!=='',error:formula?'Fórmula detectada: substitua por valores na planilha.':''});
  }
  if(!result.length||result.length>500)throw new Error('Importe entre 1 e 500 colaboradores.');
  return result;
}
export function importIssues(row:ImportRow,existing:Employee[],selected:ImportRow[]):string[]{
  const p=row.employee;const issues:string[]=[];
  if(row.error)issues.push(row.error);
  if(!employeeSchema.safeParse(p).success)issues.push('Confira os dados: datas válidas, PIS com 11 dígitos e nome');
  const others=[...existing.filter(e=>e.id!==p.id),...selected.filter(r=>r!==row).map(r=>r.employee)];
  if(selected.some(r=>r!==row&&r.employee.id===p.id))issues.push('Mais de uma linha atualiza este colaborador: selecione somente uma.');
  if(others.some(o=>p.registration.trim()&&o.registration.trim()===p.registration.trim()))issues.push('Matrícula já utilizada');
  if(p.pis&&others.some(o=>o.pis===p.pis))issues.push('PIS já cadastrado ou repetido');
  if(others.some(o=>normalize(o.name)===normalize(p.name)))issues.push('Nome repetido: confira se este colaborador já está cadastrado');
  return issues;
}
export function prepareUpdates(rows:ImportRow[],existing:Employee[]):ImportRow[]{
  return rows.map(row=>{
    const p=row.employee;
    const matches=existing.filter(e=>(p.pis&&e.pis===p.pis)||(p.registration&&e.registration===p.registration));
    const candidates=matches.length?matches:existing.filter(e=>normalize(e.name)===normalize(p.name));
    if(candidates.length>1)return {...row,error:'Correspondência ambígua: mais de um cadastro encontrado. Confira matrícula e PIS.'};
    const found=candidates[0];if(!found)return row;
    if((p.pis&&found.pis&&p.pis!==found.pis)||(p.registration&&found.registration&&p.registration!==found.registration))return {...row,error:'Nome ou identificadores em conflito com um cadastro existente. Confira matrícula e PIS.'};
    const employee=structuredClone(found);
    for(const key of ['name','pis','registration','admission','job','department'] as const){if(p[key])employee[key]=p[key]!;}
    const latest=[...employee.contracts].sort((a,b)=>b.effective.localeCompare(a.effective))[0];
    employee.contracts=[{...latest,salary:row.salaryProvided?p.contracts[0].salary:latest.salary}];
    return {...row,employee,update:true};
  });
}
export function mergeImported(existing:Employee[],incoming:Employee[]):Employee[]{
  const updates=new Map(incoming.map(p=>[p.id,p]));
  const result=existing.map(p=>{const next=updates.get(p.id);if(!next)return p;const months=new Set(next.contracts.map(c=>c.effective));return {...next,contracts:[...p.contracts.filter(c=>!months.has(c.effective)),...next.contracts].sort((a,b)=>a.effective.localeCompare(b.effective))};});
  return [...result,...incoming.filter(p=>!existing.some(e=>e.id===p.id))];
}
