import {blankEntry, round, yearsAt, type Entry} from './engine';

export type Contract = {
  nightEligible?:boolean; effective:string; salary:number; divisor:number; danger:boolean;
  unhealthyRate:number; unhealthyBase:number; annuityRate:number;
  nightRate:number; fixedName:string; fixedValue:number; notes:string;
};
export type Employee = {
  id:string; pis?:string; registration:string; name:string; admission:string;
  job:string; department:string; termination:string; contracts:Contract[];
};
export type Monthly = {
  nightEligible?:boolean; nightClockHours?:boolean; divisor:number; hours50:number; hours100:number; nightHours:number;
  nightRate:number; hourlyBase:number; unhealthyRate:number; unhealthyBase:number;
  fixedName:string; fixedValue:number; commission:number; advance:number;
  holidays:string; calendarConfirmed:boolean; contractEffective:string;
};
export const currentMonth=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}).slice(0,7);
export const blankContract=():Contract=>({effective:currentMonth(),salary:0,divisor:220,danger:false,unhealthyRate:0,unhealthyBase:0,annuityRate:1,nightEligible:false,nightRate:20,fixedName:'',fixedValue:0,notes:''});
export const blankEmployee=():Employee=>({id:crypto.randomUUID(),registration:'',name:'',admission:'',job:'',department:'',termination:'',contracts:[blankContract()]});
export function contractAt(employee:Employee,month:string){return [...employee.contracts].filter(c=>c.effective<=month).sort((a,b)=>b.effective.localeCompare(a.effective))[0];}
export function calendar(month:string,holidays='') {
  const [y,m]=month.split('-').map(Number);
  const dates=new Set(holidays.split(/[\s,;]+/).filter(Boolean));
  const count=new Date(Date.UTC(y,m,0)).getUTCDate(); let rests=0;
  for(let d=1;d<=count;d++) {const key=`${month}-${String(d).padStart(2,'0')}`;if(new Date(Date.UTC(y,m-1,d)).getUTCDay()===0||dates.has(key))rests++;}
  return {workDays:count-rests,restDays:rests};
}
export function entryFor(employee:Employee,month:string):Entry {
  const c=contractAt(employee,month);
  if(!employee.admission||!employee.registration.trim()||!employee.job.trim()||!c||c.salary<=0)throw new Error('Complete a ficha antes do lançamento: matrícula, admissão, cargo e salário vigente são obrigatórios.');
  if(!c)throw new Error('Não há contrato vigente nesta competência.');
  if(employee.admission.slice(0,7)>month||(employee.termination&&employee.termination.slice(0,7)<month))throw new Error('Colaborador fora do vínculo nesta competência.');
  const fixed=round(c.salary*(c.danger?.3:0)+c.unhealthyBase*c.unhealthyRate/100+c.salary*yearsAt(employee.admission,month)*1/100+c.fixedValue);
  return {...blankEntry(),employeeId:employee.id,employee:employee.name,admission:employee.admission,month,salary:c.salary,danger:c.danger,annuityRate:1,...calendar(month),monthly:{divisor:c.divisor,hours50:0,hours100:0,nightHours:0,nightEligible:c.nightEligible===true,nightClockHours:true,nightRate:20,hourlyBase:round(c.salary+fixed),unhealthyRate:c.unhealthyRate,unhealthyBase:c.unhealthyBase,fixedName:c.fixedName,fixedValue:c.fixedValue,commission:0,advance:0,holidays:'',calendarConfirmed:false,contractEffective:c.effective}};
}
