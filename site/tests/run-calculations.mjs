import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('.sites-runtime/tests',{recursive:true});
for(const name of ['engine','management','import-employees','indicators','holidays','simulation','annual-employee']){
  await build({entryPoints:[`tests/${name}.mjs`],bundle:true,platform:'node',format:'esm',outfile:`.sites-runtime/tests/${name}.mjs`});
  await import(`../.sites-runtime/tests/${name}.mjs`);
}
