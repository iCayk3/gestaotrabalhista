import {randomBytes,scrypt as derive,timingSafeEqual,createHash,createHmac} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive);
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export async function hashPassword(password){if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Use uma senha de 12 a 128 caracteres.');const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:128*1024*1024});return `scrypt$${salt}$${hash.toString('hex')}`;}
export async function verifyPassword(password,stored){if(typeof password!=='string'||password.length>128)return false;const [,salt,hex]=stored.split('$');const hash=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:128*1024*1024});const expected=Buffer.from(hex,'hex');return hash.length===expected.length&&timingSafeEqual(hash,expected);}
export const signIdentity=(secret,id,email,time)=>createHmac('sha256',secret).update(`${time}\n${id}\n${email}`).digest('hex');
export class Accounts{
 constructor(db){this.db=db;db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user TEXT NOT NULL,expires INTEGER NOT NULL,idle INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);}
 throttle(key,limit=8){const now=Date.now();this.db.prepare('DELETE FROM attempts WHERE expires<?').run(now);const k=digest(key);const r=this.db.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(k,now+15*60000);return r.count<=limit;}
 createSession(id){const value=token(),now=Date.now();this.db.prepare('DELETE FROM sessions WHERE expires<? OR idle<?').run(now,now);this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(value),id,now+8*3600000,now+30*60000);return value;}
 session(value){if(!/^[a-f0-9]{64}$/.test(value??''))return null;const now=Date.now();const row=this.db.prepare('SELECT u.id,u.email FROM users u JOIN sessions s ON u.id=s.user WHERE s.hash=? AND s.expires>? AND s.idle>?').get(digest(value),now,now);if(row)this.db.prepare('UPDATE sessions SET idle=? WHERE hash=?').run(now+30*60000,digest(value));return row??null;}
 logout(value){this.db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(value??''));}
}
