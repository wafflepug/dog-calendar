const {defineConfig}=require('@playwright/test');
const python=process.env.WAFFLE_PYTHON||(process.platform==='win32'?'python':'python3');
module.exports=defineConfig({
 testDir:'./tests',
 testMatch:['care-phone-clearance.browser.spec.js','shared-phone-label-audit.browser.spec.js'],
 timeout:180000,
 expect:{timeout:15000},
 workers:1,
 reporter:'list',
 outputDir:'./test-results/phone-clearance',
 use:{baseURL:'http://127.0.0.1:4355',timezoneId:'Australia/Sydney',serviceWorkers:'block',screenshot:'only-on-failure',actionTimeout:10000},
 projects:['chromium','webkit'].map(browserName=>({name:browserName,use:{browserName,viewport:{width:390,height:844}}})),
 webServer:{command:`"${python}" -m http.server 4355 --bind 127.0.0.1`,url:'http://127.0.0.1:4355/index.html',cwd:__dirname,reuseExistingServer:false,timeout:10000,stdout:'ignore',stderr:'ignore'}
});
