'use client';
import {useRef,useState} from 'react';
import {Upload} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {Employee} from '@/lib/payroll/management';
import type {ImportRow} from '@/lib/payroll/import-employees';
import {importIssues,prepareUpdates} from '@/lib/payroll/import-employees';
export default function EmployeeImport({employees,onImport}:{employees:Employee[];onImport:(employees:Employee[])=>Promise<void>}){
  const input=useRef<HTMLInputElement>(null);const [rows,setRows]=useState<ImportRow[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[checked,setChecked]=useState(false);
  const selected=rows.filter(r=>r.selected);const issues=selected.flatMap(r=>importIssues(r,employees,selected));
  function edit(index:number,change:Partial<Employee>){setChecked(false);setRows(old=>old.map((r,i)=>i===index?{...r,employee:{...r.employee,...change}}:r));}
  async function read(file?:File){if(!file)return;setBusy(true);try{if(!/\.xlsx?$/i.test(file.name)||file.size>5000000)throw new Error('Selecione XLS ou XLSX de até 5 MB.');const {readEmployees}=await import('@/lib/payroll/import-employees');const next=prepareUpdates(readEmployees(await file.arrayBuffer()),employees);setRows(next);setChecked(false);setOpen(true);}catch(e:any){toast.error(e.message||'Não foi possível ler a planilha.');}finally{setBusy(false);if(input.current)input.current.value='';}}
  return <><input ref={input} type="file" accept=".xls,.xlsx" hidden onChange={e=>read(e.target.files?.[0])}/><button className="secondary" disabled={busy} onClick={()=>input.current?.click()}><Upload size={17}/>{busy?'Processando...':'Importar XLS / XLSX'}</button>
    <Dialog open={open} onOpenChange={v=>{if(!busy){setOpen(v);if(!v)setRows([]);}}}><DialogContent className="entry-dialog"><DialogTitle>Conferir importação de colaboradores</DialogTitle><DialogDescription>Primeira aba da planilha. Complete os dados que tiver e desmarque os registros que não deseja cadastrar. Cadastros identificados por PIS, matrícula ou nome único serão atualizados. Campos vazios do Excel preservam os dados existentes.</DialogDescription>
      <p className="note">O modelo Nome / PIS é aceito. Informações ausentes podem ficar em branco. Matrícula, admissão, cargo e salário serão exigidos ao abrir o lançamento mensal. Divisor inicial: 220 horas; anuênio automático de 1% por ano, pendente de convenção. Confira adicionais, jornada e demais condições na ficha. O arquivo é lido no navegador; somente os cadastros confirmados são enviados ao salvar.</p>
      <p><strong>{selected.length} selecionado(s)</strong> de {rows.length}. {issues.length?'Há pendências a corrigir.':'Dados prontos para conferência.'}</p>
      <div className="employee-import-list">{rows.map((row,i)=>{const p=row.employee,c=p.contracts[0];const errors=row.selected?importIssues(row,employees,selected):[];return <section className="import-person" key={p.id}>
        <label className="check"><input type="checkbox" checked={row.selected} onChange={e=>{setChecked(false);setRows(rows.map((r,j)=>j===i?{...r,selected:e.target.checked}:r));}}/>{row.update?'ATUALIZAR':'NOVO'} · Linha {row.line} · {p.name||'Sem nome'}</label>
        {row.selected&&<><div className="form-grid">{(['name','pis','registration','admission','job','department'] as const).map((key,k)=><label className="field" key={key}><span>{['Nome','PIS (opcional)','Matrícula','Admissão','Cargo','Setor'][k]}</span><input type={key==='admission'?'date':'text'} value={p[key]??''} onChange={e=>edit(i,{[key]:e.target.value})}/></label>)}
        <label className="field"><span>Salário mensal (R$)</span><input type="number" min="0" step="0.01" value={Number.isFinite(c.salary)&&c.salary?c.salary:''} onChange={e=>edit(i,{contracts:[{...c,salary:Number(e.target.value)}]})}/></label>
        <label className="field"><span>Vigência do contrato</span><input type="month" value={c.effective} onChange={e=>edit(i,{contracts:[{...c,effective:e.target.value}]})}/></label>
        <label className="field"><span>Divisor mensal (horas)</span><input type="number" min="1" max="744" value={c.divisor} onChange={e=>edit(i,{contracts:[{...c,divisor:Number(e.target.value)}]})}/></label>
        </div><div className="inline-actions"><label className="check"><input type="checkbox" checked={c.danger} onChange={e=>edit(i,{contracts:[{...c,danger:e.target.checked}]})}/>Recebe periculosidade</label><label className="check"><input type="checkbox" checked={!!c.nightEligible} onChange={e=>edit(i,{contracts:[{...c,nightEligible:e.target.checked}]})}/>Recebe adicional noturno</label></div>
        {!!errors.length&&<ul className="warning-list">{errors.map(e=><li key={e}>{e}</li>)}</ul>}</>}
      </section>})}</div>
      <label className="check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>Conferi os dados, vigências, jornada e adicionais dos colaboradores selecionados.</label>
      <div className="dialog-actions"><button className="secondary" disabled={busy} onClick={()=>{setOpen(false);setRows([]);}}>Cancelar</button><button className="primary" disabled={busy||!checked||!selected.length||!!issues.length||employees.length+selected.filter(r=>!r.update).length>500} onClick={async()=>{setBusy(true);try{await onImport(selected.map(r=>r.employee));setOpen(false);setRows([]);toast.success('Colaboradores importados.');}catch(e:any){toast.error(e.message);}finally{setBusy(false);}}}>{busy?'Salvando...':`Salvar ${selected.length} colaborador(es)`}</button></div>
      {employees.length+selected.filter(r=>!r.update).length>500&&<p className="note">O limite é de 500 colaboradores por empresa.</p>}
    </DialogContent></Dialog></>;
}
