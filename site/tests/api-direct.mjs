import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_third_zuras.sql','utf8'));
class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args;}bind(...args){return new Statement(this.sql,args);}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:db.prepare(this.sql).all(...this.args)}}async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes)}}}}
globalThis.__testDB={prepare:sql=>new Statement(sql),batch:async statements=>{db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['app/api/workspace/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/route.mjs',plugins:[{name:'test-only-boundaries',setup(b){b.onResolve({filter:/^@\/app\/chatgpt-auth$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/^@\/db\/raw$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='auth'?'export async function getChatGPTUser(){return globalThis.__testUser||null}':'export function database(){return globalThis.__testDB}',loader:'js'}));}}]});
const route=await import('../.sites-runtime/tests/route.mjs');
globalThis.fetch=async(url,options={})=>{const h=options.headers||{};globalThis.__testUser=h['oai-authenticated-user-id']?{userId:h['oai-authenticated-user-id'],email:h['oai-authenticated-user-email']}:null;const req=new Request(url,options);return options.method==='POST'?route.POST(req):route.GET(req);};
await import('./api.mjs');
