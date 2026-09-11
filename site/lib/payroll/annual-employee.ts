import {round,yearsAt,calculate,annual,type State} from './engine';
import {contractAt,type Employee} from './management';
const day=(s:string)=>new Date(s+'T00:00:00Z');
export function anniversary(admission:string,year:number){const month=Number(admission.slice(5,7)),d=Number(admission.slice(8));return `${year}-${String(month).padStart(2,'0')}-${String(Math.min(d,new Date(Date.UTC(year,month,0)).getUTCDate())).padStart(2,'0')}`;}
export function vacationPeriod(p:Employee,reference:string){if(!p.admission)return '';let year=Number(reference.slice(0,4));if(anniversary(p.admission,year)>reference)year--;return anniversary(p.admission,Math.max(Number(p.admission.slice(0,4)),year-1));}
export function employeeAnnual(state:State,p:Employee,type:'13'|'vacation',reference:string,start:string,absences:number|null,installment:'annual'|'first'|'second'='annual',paymentDate=reference){
 if(!p.admission||!reference)throw Error('Informe admissão e data de referência.');
 if(reference<p.admission)throw Error('Referência anterior à admissão.');
 if(p.termination&&reference>p.termination)throw Error('Vínculo encerrado: apuração rescisória exige tratamento específico.');
 if(type==='13'&&paymentDate< p.admission)throw Error('Data de pagamento anterior à admissão.');
 const calculationDate=type==='13'?paymentDate:reference;const month=calculationDate.slice(0,7),c=contractAt(p,month);if(!c||c.salary<=0)throw Error('Cadastre salário vigente para a data de referência.');
 const warnings=['Prévia bruta: confira convenção, afastamentos e incidências. Não calcula INSS, IRRF, adiantamentos, abono ou rescisão.','Anuênio utiliza a premissa cadastrada de 1% ao ano; validar convenção.'];
 const fixed=round(c.salary+c.salary*(c.danger?.3:0)+c.unhealthyBase*c.unhealthyRate/100+c.salary*yearsAt(p.admission,month)/100+c.fixedValue);
 let avos=0;let begin=type==='13'?`${paymentDate.slice(0,4)}-01-01`:start;let end=type==='13'?paymentDate:reference;
 if(type==='vacation'){if(!start||start<p.admission)throw Error('Informe um período aquisitivo válido, a partir da admissão.');const next=anniversary(start,Number(start.slice(0,4))+1);end=new Date(day(next).getTime()-86400000).toISOString().slice(0,10);if(reference<=end)throw Error('Período aquisitivo ainda não concluído. Férias proporcionais/coletivas exigem apuração específica.');if(start.slice(8)!=='01')warnings.push('Período aquisitivo corta competências: médias mensais precisam de conferência dos dias de início e fim.');if(absences===null)warnings.push('Informe as faltas injustificadas em dias no período aquisitivo. Descontos em reais não determinam essa quantidade.');warnings.push('Confirme se este período ainda está disponível: não há controle automático de férias já gozadas nem de perda do direito por afastamentos.');}
 const expected:string[]=[];let cursor=begin.slice(0,7);while(cursor<=end.slice(0,7)){
  const [y,m]=cursor.split('-').map(Number),last=`${cursor}-${String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0')}`;const a=[begin,p.admission,`${cursor}-01`].sort().at(-1)!;const b=[end,last,p.termination||end].sort()[0];const days=Math.max(0,Math.floor((day(b).getTime()-day(a).getTime())/86400000)+1);
  if(days>0)expected.push(cursor);if(days>=15)avos++;cursor=new Date(Date.UTC(y,m,1)).toISOString().slice(0,7);
 }
 const records=state.entries.filter(e=>e.employeeId===p.id&&expected.includes(e.month));const missing=expected.filter(m=>!records.some(e=>e.month===m));if(missing.length)warnings.push(`Sem lançamento: ${missing.join(', ')}. Média parcial; meses ausentes não são tratados como zero.`);
 if(type==='13'){if(installment==='first')warnings.push('1ª parcela: adiantamento de 50% do 13º proporcional aos avos acumulados até a data de pagamento.');if(installment==='second')warnings.push('2ª parcela: saldo do 13º devido, descontando o adiantamento informado.');if(!paymentDate.endsWith('12-31'))warnings.push('Pagamento antecipado: os avos consideram meses com pelo menos 15 dias trabalhados até a data do pagamento; faça a revisão na segunda parcela.');}
 let variable=0;for(const e of records){const r=calculate(e,state.convention);const hour=fixed/c.divisor;const extra=e.monthly?hour*(e.monthly.hours50*1.5+e.monthly.hours100*2):r.extra50+r.extra100;const dsr=e.workDays>0?extra/e.workDays*e.restDays:0;variable+=extra+dsr+r.night;}
 const commissionStart=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-13,1)).toISOString().slice(0,7);
 const commissions=type==='vacation'?state.entries.filter(e=>e.employeeId===p.id&&e.month>=commissionStart&&e.month<month):records;
 const commissionAverage=commissions.length?commissions.reduce((s,e)=>s+(e.monthly?.commission??0),0)/commissions.length:0;
 if(type==='vacation'&&commissions.length<12)warnings.push('Comissões: histórico dos 12 meses anteriores à concessão incompleto.');
 if(records.some(e=>e.bonus>0))warnings.push('Bonificações não incluídas automaticamente nas médias: classifique sua natureza salarial ou indenizatória.');
 if(records.some(e=>calculate(e).night>0)||type==='vacation'&&records.some(e=>e.danger!==c.danger||e.monthly?.unhealthyRate!==c.unhealthyRate))warnings.push('Adicionais variáveis/noturnos: conferir atualização e integração da média conforme art. 142 da CLT.');
 const average=round((records.length?variable/records.length:0)+commissionAverage);
 const days=absences===null?null:absences<=5?30:absences<=14?24:absences<=23?18:absences<=32?12:0;
 const units=type==='13'?avos:days;const result=units===null?null:annual(fixed,average,units,type);if(type==='13'&&installment==='first'&&paymentDate.slice(5)>='12-01')warnings.push('A primeira parcela deve ser paga até 30/11, salvo antecipação anterior.');if(type==='13'&&installment==='second'&&paymentDate.slice(5)>'12-20')warnings.push('A segunda parcela deve ser paga até 20/12.');const installmentValue=result&&type==='13'?(installment==='first'||installment==='second'?round(result.total/2):result.total):result?.total??null;return {fixed,average,avos,days,begin,end,records,missing,warnings,units,result,installmentValue,installment,paymentDate};
}
