import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createStore } from './database.js';
import { createHandler } from './api.js';
import { createTokenVerifier } from './auth.js';

export function configuration(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.PLATFORM_MODE || 'local';
  if (!['local','production'].includes(mode)) throw Error('PLATFORM_MODE must be local or production');
  const port = Number(env.PORT || 4380);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
  const projectId = env.FIREBASE_PROJECT_ID || (mode === 'local' ? 'demo-palz-stay' : '');
  const emulatorHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  if (mode === 'local' && (!projectId.startsWith('demo-') || !emulatorHost || !/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(emulatorHost))) {
    throw Error('Local mode requires a demo project and loopback Firebase Auth emulator. Use npm run dev.');
  }
  if (mode === 'production' && (!projectId || projectId.startsWith('demo-') || emulatorHost || !env.DATABASE_URL || !env.PLATFORM_ORIGIN || !env.FIREBASE_WEB_API_KEY || !env.FIREBASE_APP_ID)) {
    throw Error('Production requires separate Firebase, PostgreSQL and HTTPS configuration; emulation is forbidden.');
  }
  const origin = mode === 'local' ? `http://127.0.0.1:${port}` : String(env.PLATFORM_ORIGIN);
  const parsed = new URL(origin);
  if (parsed.origin !== origin || parsed.username || parsed.password || (mode === 'production' && parsed.protocol !== 'https:')) throw Error('Invalid PLATFORM_ORIGIN');
  const authDomain = env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
  if (!/^[a-z0-9-]+\.firebaseapp\.com$/.test(authDomain)) throw Error('Invalid Firebase auth domain');
  return {
    mode: mode as 'local'|'production', port, projectId, emulatorHost,
    host: mode === 'local' ? '127.0.0.1' : '0.0.0.0',
    databaseUrl: mode === 'production' ? env.DATABASE_URL : undefined,
    dataDir: mode === 'local' ? resolve(env.DATA_DIR || '.local/pg') : undefined,
    publicConfig: {mode, origin, firebase:{apiKey:env.FIREBASE_WEB_API_KEY || 'demo-local-key', authDomain,projectId,appId:env.FIREBASE_APP_ID || 'demo-local-app'}, ...(mode==='local'?{emulatorUrl:`http://${emulatorHost}`}:{})}
  };
}

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  const config = configuration(env);
  const store = await createStore({dataDir:config.dataDir,databaseUrl:config.databaseUrl});
  let verifyToken;
  try { verifyToken = createTokenVerifier({projectId:config.projectId,emulatorHost:config.emulatorHost,mode:config.mode}); } catch(error) {await store.close();throw error;}
  const handler = createHandler({store,verifyToken,publicConfig:config.publicConfig});
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const assets:Record<string,[string,string]> = {'/':['index.html','text/html'], '/index.html':['index.html','text/html'], '/style.css':['style.css','text/css'], '/app.js':['app.js','text/javascript']};
  const server = createServer(async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
    const emulator = config.mode==='local' ? config.publicConfig.emulatorUrl : '';
    res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self' https://apis.google.com; style-src 'self'; img-src 'self' data:; connect-src 'self' ${emulator} https://*.googleapis.com https://${config.publicConfig.firebase.authDomain}; frame-src ${emulator} https://${config.publicConfig.firebase.authDomain} https://accounts.google.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
    if (config.mode==='production') res.setHeader('Strict-Transport-Security','max-age=31536000');
    if (req.headers.host?.toLowerCase() !== new URL(config.publicConfig.origin).host.toLowerCase()) {
      res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:{code:'invalid_host',message:'Invalid host'}})); return;
    }
    try {
      const url = new URL(req.url || '/',config.publicConfig.origin);
      if (url.pathname.startsWith('/api/') || url.pathname==='/health') {await handler(req,res);return;}
      const asset = assets[url.pathname];
      if (!asset || !['GET','HEAD'].includes(req.method || '')) {res.writeHead(404).end();return;}
      const bytes = await readFile(resolve(publicDir,asset[0]));
      res.writeHead(200,{'Content-Type':`${asset[1]}; charset=utf-8`});res.end(req.method==='HEAD'?undefined:bytes);
    } catch {
      if (!res.headersSent) res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:{code:'unavailable',message:'Application unavailable'}}));
      else res.end();
    }
  });
  server.requestTimeout=15_000;server.headersTimeout=10_000;server.maxHeadersCount=50;
  try {await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>resolve());});}
  catch(error){await store.close();throw error;}
  return {server,store,config,async close(){await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await store.close();}};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  startServer().then(app=>{
    console.log(`Palz Stay ${app.config.mode}: ${app.config.publicConfig.origin}`);
    let closing=false;
    const stop=()=>{if(!closing){closing=true;void app.close().then(()=>process.exit(0));}};
    process.on('SIGTERM',stop);process.on('SIGINT',stop);
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
