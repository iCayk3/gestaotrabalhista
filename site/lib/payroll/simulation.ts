import {blankEmployee,calendar,entryFor} from './management';
import {calculate,round,type State,type Entry} from './engine';
import {holidayDates} from './holidays';
export function simulatePayroll(source:State):State{
 const originals=source.employees?.length?source.employees:Array.from({length:12},(_,i)=>({...blankEmployee(),name:`Colaborador exemplo ${i+1}`}));
 const employees=originals.map((p,i)=>{
   const salary=[1800,2200,2600,3200,4000,4800][i%6];
   const first={...p.contracts[0],effective:'2026-01',salary,divisor:220,danger:i%4===0,unhealthyRate:0,unhealthyBase:0,annuityRate:1,nightEligible:i%5===0,nightRate:20,fixedName:i%7===0?'Gratificação fictícia':'',fixedValue:i%7===0?200:0,notes:'SIMULAÇÃO: valores fictícios para avaliação visual.'};
   const contracts=[first];if(i%3!==2)contracts.push({...first,effective:`2026-${i%2===0?'07':'04'}`,salary:i%6===0?3000:round(salary*1.15)});
   return {...p,pis:'',registration:`SIM-${String(i+1).padStart(3,'0')}`,admission:p.admission&&p.admission<'2026-01-01'?p.admission:`202${i%5}-01-10`,termination:'',job:p.job||['Técnico','Assistente administrativo','Analista'][i%3],department:p.department||['Operações','Administrativo','Comercial'][i%3],contracts};
 });
 const state:State={...source,company:`SIMULAÇÃO · ${source.company}`,convention:'SIMULAÇÃO VISUAL: valores e regras de exemplo, sem validade para pagamento.',employees,entries:[]};
 const entries:Entry[]=[];
 for(const [i,p] of employees.entries())for(let m=1;m<=10;m++){
   const month=`2026-${String(m).padStart(2,'0')}`,e=entryFor(p,month);const holidays=holidayDates(state,month);Object.assign(e,calendar(month,holidays));
   Object.assign(e.monthly!,{holidays,calendarConfirmed:true,hours50:(i+m)%4===0?0:((i*7+m*3)%24)+.5,hours100:(i+m)%3===0?(i+m)%9+2:0,nightHours:p.contracts[0].nightEligible?14+(m%4)*7:0,commission:i%6===3?150+m*35:0,advance:(i+m)%7===0?200:0});
   e.bonus=(i+m)%4===0?100+(m%3)*75:0;e.absenceDiscount=(i+m)%9===0?round(e.salary/30):0;e.otherDiscount=(i+m)%5===0?60:0;
   e.inssBase=calculate(e).base;e.irrf=e.salary>=3000?round(e.salary*.035):0;e.confirmed=true;const net=calculate(e).net!;e.paid=round(net+((i+m)%13===0?-25:0));entries.push(e);
 }
 return {...state,entries};
}
