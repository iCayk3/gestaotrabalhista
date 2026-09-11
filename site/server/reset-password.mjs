import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {hashPassword} from './security.mjs';
const [email,file]=process.argv.slice(2);
if(!email||!file)throw Error('Uso: node server/reset-password.mjs email arquivo-da-nova-senha');
const db=new DatabaseSync(resolve(process.env.DATA_DIR||'/data','accounts.sqlite'));
db.exec('PRAGMA busy_timeout=5000');
const user=db.prepare('SELECT id FROM users WHERE email=?').get(email.trim().toLowerCase());
if(!user)throw Error('Conta não encontrada.');
const hash=await hashPassword(readFileSync(file,'utf8').trimEnd());
db.exec('BEGIN');
try{db.prepare('UPDATE users SET password=? WHERE id=?').run(hash,user.id);db.prepare('DELETE FROM sessions WHERE user=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
db.close();console.log('Senha atualizada e sessões anteriores encerradas.');
