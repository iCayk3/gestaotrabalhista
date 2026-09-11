// Run with the application stopped; refuses a nonempty destination.
import {DatabaseSync} from 'node:sqlite';
import {Miniflare} from 'miniflare';
import {resolve} from 'node:path';
const [file,email,oldUser]=process.argv.slice(2);
if(!file||!email||!oldUser)throw Error('Uso: node server/import-legacy.mjs arquivo.sqlite email-admin id-antigo');
const directory=process.env.DATA_DIR||'/data';
const accounts=new DatabaseSync(resolve(directory,'accounts.sqlite'),{readOnly:true});
const admin=accounts.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
if(!admin)throw Error('Inicialize a instalação e a conta administradora primeiro.');
const source=new DatabaseSync(resolve(file),{readOnly:true});
const companies=source.prepare("SELECT c.* FROM companies c JOIN members m ON c.id=m.company WHERE m.user=? AND m.role='admin'").all(oldUser);
if(!companies.length)throw Error('Nenhuma empresa administrada pelo identificador antigo.');
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("migration")}}',d1Databases:{DB:'00000000-0000-4000-8000-000000000000'},d1Persist:resolve(directory,'d1')});
try{
 const db=await mf.getD1Database('DB');
 if((await db.prepare('SELECT COUNT(*) n FROM companies').first()).n)throw Error('Destino não está vazio. Importação cancelada.');
 const statements=[];
 for(const company of companies){
  statements.push(db.prepare('INSERT INTO companies(id,state,version,op) VALUES(?,?,?,?)').bind(company.id,company.state,company.version,company.op));
  statements.push(db.prepare('INSERT INTO members(company,user,email,role) VALUES(?,?,?,?)').bind(company.id,admin.id,email.toLowerCase(),'admin'));
  for(const h of source.prepare('SELECT * FROM history WHERE company=?').all(company.id))statements.push(db.prepare('INSERT INTO history(id,company,version,actor,reason,created,snapshot) VALUES(?,?,?,?,?,?,?)').bind(h.id,h.company,h.version,h.actor,h.reason,h.created,h.snapshot));
 }
 await db.batch(statements);
 console.log(`${companies.length} empresa(s) importada(s). Convide novamente os contadores.`);
}finally{await mf.dispose();source.close();accounts.close();}
