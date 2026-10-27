const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');
const vm=require('node:vm');
const source=fs.readFileSync('waffle-app.js','utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const sandbox={escapeDashboardHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
vm.runInNewContext(between('    function normalizeDirectoryPhoneForTel(', '    function getDirectoryCareBriefFreshness(')+between('    function intakeAttributeReadViewHtml(', '    const directoryIntakeRenderSnapshots')+'\nthis.read=intakeAttributeReadViewHtml;',sandbox);
const fields=[{key:'emergencyContact',label:'Emergency Contact'},{key:'emergencyPhone',label:'Emergency Phone'},{key:'vetPhone',label:'Vet Phone'},{key:'notes',label:'Notes'}];
test('saved emergency and vet numbers preserve display and expose only validated tel targets',()=>{
 const html=sandbox.read(fields,{emergencyContact:'Sam & Jo',emergencyPhone:'+61 (400) 123-456',vetPhone:'02 9000 1234',notes:'0400000000'},'fresh','healthHome');
 assert.match(html,/href="tel:\+61400123456"/);assert.match(html,/>\+61 \(400\) 123-456<\/a>/);
 assert.match(html,/href="tel:0290001234"/);assert.match(html,/Sam &amp; Jo/);
 assert.equal((html.match(/href="tel:/g)||[]).length,2);
});
test('placeholder, malformed and unsafe phone values never become call links',()=>{
 for(const value of ['Other','N/A','123','+61+400000000','0400abc123','javascript:alert(1)','<img src=x onerror=alert(1)>']){
  const html=sandbox.read(fields,{emergencyPhone:value,vetPhone:value},'saved','healthHome');
  assert.doesNotMatch(html,/href=|<img/);
 }
});
test('unverified identities and unloaded profiles do not expose contact values or call actions',()=>{
 for(const state of ['identity-conflict','loading','not-found']){
  const html=sandbox.read(fields,{emergencyContact:'Private contact',emergencyPhone:'0400123456'},state,'healthHome');
  assert.doesNotMatch(html,/href=|Private contact|0400123456/);
 }
});
test('failed refresh keeps saved contact usable with the existing warning',()=>{
 const html=sandbox.read(fields,{emergencyPhone:'0400123456'},'error','healthHome');
 assert.match(html,/Profile refresh failed/);assert.match(html,/href="tel:0400123456"/);
});
