import type {State} from './engine';
export type Holiday={id:string;date:string;name:string;scope:'national'|'state'|'municipal';uf:string;city:string;enabled:boolean;source:string};
export function knownHolidays(year:string):Holiday[]{
 const fixed=[['01-01','Confraternização Universal'],['04-21','Tiradentes'],['05-01','Dia do Trabalho'],['09-07','Independência do Brasil'],['10-12','Nossa Senhora Aparecida'],['11-02','Finados'],['11-15','Proclamação da República'],['12-25','Natal']];
 if(Number(year)>=2024)fixed.push(['11-20','Dia Nacional de Zumbi e da Consciência Negra']);
 return [...fixed.map(([day,name])=>({id:`national-${year}-${day}`,date:`${year}-${day}`,name,scope:'national' as const,uf:'',city:'',enabled:true,source:'Leis federais 662/1949, 6.802/1980 e 14.759/2023'})),{id:`PA-${year}-08-15`,date:`${year}-08-15`,name:'Adesão do Grão-Pará à Independência',scope:'state',uf:'PA',city:'',enabled:true,source:'Calendário oficial do Pará — Decreto 5.122/2025 (2026)'}];
}
export function holidaysFor(state:Pick<State,'uf'|'city'|'holidays'>,year:string):Holiday[]{
 const records=new Map(knownHolidays(year).map(h=>[h.id,h]));for(const h of state.holidays??[])if(h.date.startsWith(year+'-'))records.set(h.id,h);
 return [...records.values()].filter(h=>h.scope==='national'||h.uf===state.uf&&(h.scope==='state'||h.city.trim().toLocaleLowerCase('pt-BR')===state.city.trim().toLocaleLowerCase('pt-BR'))).sort((a,b)=>a.date.localeCompare(b.date));
}
export const holidayDates=(state:Pick<State,'uf'|'city'|'holidays'>,month:string)=>[...new Set(holidaysFor(state,month.slice(0,4)).filter(h=>h.enabled&&h.date.startsWith(month+'-')).map(h=>h.date))].join(', ');
