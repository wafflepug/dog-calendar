const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'platform.browser.spec.ts',workers:2,timeout:45000,expect:{timeout:10000},
 use:{baseURL:'http://127.0.0.1:4381',serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:['chromium','webkit'].flatMap(browserName=>[320,390,1440].map(width=>({name:`${browserName}-${width}`,use:{browserName,viewport:{width,height:844}}}))),
 webServer:{command:'node dist/server.js',url:'http://127.0.0.1:4381/health',env:{PLATFORM_MODE:'local',FIREBASE_PROJECT_ID:'demo-palz-stay',PORT:'4381',DATA_DIR:`.local/browser-tests-${Date.now()}`},reuseExistingServer:false,timeout:30000,stdout:'ignore',stderr:'pipe'}
});
