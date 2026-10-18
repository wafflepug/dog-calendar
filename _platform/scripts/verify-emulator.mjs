import {spawnSync} from 'node:child_process';
if(!/^127\.0\.0\.1:9199$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || ''))throw Error('Tests require the isolated local Auth emulator');
for(const args of [['--import','tsx','--test','tests/emulator.integration.ts'],['node_modules/@playwright/test/cli.js','test','--config=playwright.config.cjs']]){
 const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(r.status!==0)process.exit(r.status || 1);
}
