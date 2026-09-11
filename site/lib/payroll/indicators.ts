import {calculate,round,type Entry,type State} from './engine';
export const personKey=(e:Entry)=>e.employeeId??`legacy:${e.employee.trim().toLocaleLowerCase('pt-BR')}`;
export function indicators(state:State,year:string){
  const entries=state.entries.filter(e=>e.month.slice(0,4)===year).map(e=>({entry:e,result:calculate(e,state.convention)}));
  const months=Array.from({length:12},(_,i)=>{const month=`${year}-${String(i+1).padStart(2,'0')}`;const rows=entries.filter(e=>e.entry.month===month);return {month,count:rows.length,gross:round(rows.reduce((s,r)=>s+r.result.gross,0)),extras:round(rows.reduce((s,r)=>s+r.result.extra50+r.result.extra100,0)),dsr:round(rows.reduce((s,r)=>s+r.result.dsr,0))};});
  const grouped=new Map<string,{id:string;name:string;value:number;hours:number;missingHours:boolean}>();
  for(const {entry:e,result:c} of entries){const id=personKey(e);const r=grouped.get(id)??{id,name:state.employees?.find(p=>p.id===id)?.name??e.employee,value:0,hours:0,missingHours:false};r.value=round(r.value+c.extra50+c.extra100);r.hours=round(r.hours+(e.monthly?e.monthly.hours50+e.monthly.hours100:0));r.missingHours ||= !e.monthly&&(c.extra50+c.extra100)>0;grouped.set(id,r);}
  return {entries,months,gross:round(months.reduce((s,m)=>s+m.gross,0)),extras:round(months.reduce((s,m)=>s+m.extras,0)),dsr:round(months.reduce((s,m)=>s+m.dsr,0)),ranking:[...grouped.values()].filter(r=>r.value>0||r.hours>0).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name)),pending:entries.filter(r=>r.result.warnings.length).length};
}
