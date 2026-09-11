import http from 'node:http';
import {readFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Miniflare} from 'miniflare';
import {Accounts,hashPassword,verifyPassword,digest,token,signIdentity} from './security.mjs';
import {authPage} from './auth-page.mjs';
process.umask(0o077);
const origin=process.env.APP_ORIGIN;
if(!origin||new URL(origin).origin!==origin)throw Error('Configure APP_ORIGIN com a origem pública exata.');
const secure=origin.startsWith('https://');if(!secure&&!(process.env.ALLOW_LOCAL_HTTP==='1'&&['localhost','127.0.0.1'].includes(new URL(origin).hostname)))throw Error('HTTPS obrigatório.');
const directory=process.env.DATA_DIR||'/data';mkdirSync(directory,{recursive:true});
const db=new DatabaseSync(resolve(directory,'accounts.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');const accounts=new Accounts(db);
if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
 const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();const path=process.env.ADMIN_PASSWORD_FILE;
 if(!/^\S+@\S+\.\S+$/.test(email)||!path||!existsSync(path))throw Error('Primeiro acesso exige ADMIN_EMAIL e arquivo ADMIN_PASSWORD_FILE.');
 const password=readFileSync(path,'utf8').trimEnd();db.prepare('INSERT INTO users VALUES(?,?,?)').run(token(),email,await hashPassword(password));
}
const dummy=await hashPassword(token());const secret=token();
const moduleRoot=resolve('dist/server');
const modules=[{type:'ESModule',path:resolve(moduleRoot,'index.js')},...readdirSync(moduleRoot,{recursive:true}).filter(n=>/\.(js|mjs)$/.test(n)&&n!=='index.js').map(n=>({type:'ESModule',path:resolve(moduleRoot,n)}))];
const mf=new Miniflare({host:'127.0.0.1',port:0,modules,modulesRoot:moduleRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'00000000-0000-4000-8000-000000000000'},d1Persist:resolve(directory,'d1'),bindings:{AUTH_GATEWAY_SECRET:secret},assets:{directory:resolve('dist/client'),routerConfig:{has_user_worker:true}}});
const d1=await mf.getD1Database('DB');
await d1.prepare('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY)').run();
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){
 if(await d1.prepare('SELECT name FROM app_migrations WHERE name=?').bind(name).first())continue;
 const statements=readFileSync(resolve('drizzle',name),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
 await d1.batch([...statements.map(s=>d1.prepare(s)),d1.prepare('INSERT INTO app_migrations VALUES(?)').bind(name)]);
}
const cookieName=secure?'__Host-sol_session':'sol_session';
const sessionCookie=(v,age=28800)=>`${cookieName}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
let authBusy=0;
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Cache-Control','no-store, private');
 if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
 const send=(code,body,type='text/plain; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type});res.end(body);};
 const redirect=(path)=>{res.writeHead(303,{Location:path});res.end();};
 try{
  const url=new URL(req.url,origin);if(url.origin!==origin||req.headers.host!==new URL(origin).host)return send(400,'Host inválido.');
  if(url.pathname==='/healthz'){if(req.method!=='GET')return send(405,'Método inválido');await d1.prepare('SELECT 1').first();return send(200,'ok');}
  if(!['GET','HEAD','POST'].includes(req.method))return send(405,'Método inválido');
  if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'))return send(403,'Origem inválida.');
  const cookies=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));const session=cookies.length===1?cookies[0].slice(cookieName.length+1):'';const user=accounts.session(session);
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1500000){send(413,'Solicitação muito grande.');req.destroy();return;}chunks.push(chunk);}const body=Buffer.concat(chunks);
  if(url.pathname.startsWith('/auth/')){
   const mode=url.pathname.slice(6);if(!['login','register','logout','password'].includes(mode))return send(404,'Não encontrado');
   if(mode==='logout'){if(req.method!=='POST')return send(405,'Use POST');accounts.logout(session);res.setHeader('Set-Cookie',sessionCookie('',0));return redirect('/auth/login');}
   if(mode==='password'&&!user)return redirect('/auth/login');
   if(req.method==='GET')return send(200,authPage(mode),'text/html; charset=utf-8');
   if(body.length>4096||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))return send(400,'Formato inválido');
   const fields=new URLSearchParams(body.toString()),email=(fields.get('email')||'').trim().toLowerCase(),password=fields.get('password')||'';
   // Only the isolated HTTPS proxy may supply the client address; direct ports are not published.
   const ip=req.headers['x-forwarded-for']?.toString().split(',')[0].trim()||req.socket.remoteAddress;
   if(!accounts.throttle('ip:'+ip,40)||!accounts.throttle('account:'+(user?.id||email),8)||authBusy>=2)return send(429,'Muitas tentativas. Aguarde 15 minutos.');
   authBusy++;
   try{
    if(mode==='login'){
     const record=db.prepare('SELECT * FROM users WHERE email=?').get(email);const valid=await verifyPassword(password,record?.password||dummy);
     if(!record||!valid)return send(401,authPage(mode,'E-mail ou senha inválidos.'),'text/html; charset=utf-8');
     accounts.logout(session);res.setHeader('Set-Cookie',sessionCookie(accounts.createSession(record.id)));return redirect('/');
    }
    if(mode==='password'){
     const record=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);if(!await verifyPassword(fields.get('current')||'',record.password))return send(400,authPage(mode,'Senha atual inválida.'),'text/html; charset=utf-8');
     const hashed=await hashPassword(password);db.exec('BEGIN');try{db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed,user.id);db.prepare('DELETE FROM sessions WHERE user=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}res.setHeader('Set-Cookie',sessionCookie('',0));return redirect('/auth/login');
    }
    const invitation=fields.get('invite')||'',now=new Date().toISOString();const hash=digest(invitation);
    const invite=await d1.prepare('SELECT company FROM invites WHERE hash=? AND recipient=? AND used IS NULL AND expires>?').bind(hash,email,now).first();
    if(!invite||db.prepare('SELECT id FROM users WHERE email=?').get(email))return send(400,authPage(mode,'Convite inválido ou conta existente. Se já tem conta, entre e aceite o convite na aplicação.'),'text/html; charset=utf-8');
    const hashed=await hashPassword(password),id=token();db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,email,hashed);
    const membership=await d1.batch([d1.prepare('INSERT INTO members(company,user,email,role) SELECT company,?,?,? FROM invites WHERE hash=? AND used IS NULL AND expires>? AND recipient=?').bind(id,email,'contador',hash,now,email),d1.prepare('UPDATE invites SET used=? WHERE hash=? AND used IS NULL AND expires>? AND recipient=?').bind(id,hash,now,email)]);
    if(!membership[0].meta.changes){db.prepare('DELETE FROM users WHERE id=?').run(id);return send(400,'Convite indisponível.');}
    accounts.logout(session);res.setHeader('Set-Cookie',sessionCookie(accounts.createSession(id)));return redirect('/');
   }catch{return send(400,authPage(mode,'Não foi possível concluir. Confira os dados e use senha de 12 a 128 caracteres.'),'text/html; charset=utf-8');}finally{authBusy--;}
  }
  if(!user)return url.pathname.startsWith('/api/')?send(401,JSON.stringify({error:'Entre para acessar.'}),'application/json'):redirect('/auth/login');
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value&&!/^(oai-|x-sol-identity-|cookie$|host$|connection$|content-length$|transfer-encoding$)/i.test(name))headers.set(name,Array.isArray(value)?value.join(','):value);
  const time=String(Date.now());headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email);headers.set('x-sol-identity-time',time);headers.set('x-sol-identity-signature',signIdentity(secret,user.id,user.email,time));
  const response=await mf.dispatchFetch(url.toString(),{method:req.method,headers,body:req.method==='POST'?body:undefined,redirect:'manual'});
  for(const [name,value] of response.headers)if(!['content-length','content-encoding','transfer-encoding','connection','set-cookie'].includes(name.toLowerCase()))res.setHeader(name,value);
  res.setHeader('Cache-Control','no-store, private');
  res.statusCode=response.status;if(req.method==='HEAD'){res.end();return;}if(response.body)for await(const chunk of response.body)res.write(chunk);res.end();
 }catch{if(!res.headersSent)send(503,'Serviço indisponível. Tente novamente.');else res.end();}
});
server.requestTimeout=30000;server.headersTimeout=10000;server.maxHeadersCount=60;
server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Aplicação iniciada com autenticação própria.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await mf.dispose();db.close();process.exit(0);}));
