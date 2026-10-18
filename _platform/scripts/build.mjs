import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public', {recursive:true});
await Promise.all(['index.html','style.css'].map(name=>copyFile(`web/${name}`,`public/${name}`)));
await build({entryPoints:['web/app.ts'],bundle:true,outfile:'public/app.js',format:'esm',target:['es2022'],minify:true,sourcemap:false});
await build({entryPoints:['src/server.ts'],bundle:true,packages:'external',platform:'node',outfile:'dist/server.js',format:'esm',target:['node22'],sourcemap:false});
console.log('Built the isolated platform browser and server application.');
