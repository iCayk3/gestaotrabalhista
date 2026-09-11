import {spawn} from 'node:child_process';
const port=String(Number(process.env.PORT||8787));
const child=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','/data/wrangler','--ip','0.0.0.0','--port',port,'--inspector-port','0'],{stdio:'inherit',env:{...process.env,PORT:port}});
const stop=signal=>{if(!child.killed)child.kill(signal);};process.on('SIGTERM',()=>stop('SIGTERM'));process.on('SIGINT',()=>stop('SIGINT'));child.on('exit',(code,signal)=>process.exit(code??(signal?1:0)));
