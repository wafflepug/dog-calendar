import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the commercial application has no link, service worker or API bridge into Waffle House',async()=>{
  for(const file of ['index.html','care.js','service-worker.js','waffle-bootstrap.js']) {
    const source=await readFile(new URL(`../../${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/_platform|demo-palz-stay|127\.0\.0\.1:4380/);
  }
  for(const file of ['../web/app.ts','../src/server.ts','../src/api.ts','../src/database.ts']) {
    const source=await readFile(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/script\.google\.com|sheets\.googleapis\.com|wafflepug\.github\.io/);
  }
  const css=await readFile(new URL('../web/style.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/@import|fonts\.googleapis/);
});
