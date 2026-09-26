const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.js');
const bridge = `<script>
window.__calls={saves:0,cloud:0,text:0};window.__savedPdf='';window.__raw='';window.__delaySave=false;window.__recognizedInputs=[];
window.__mockCall=async(name,p)=>{
 if(name==='getLegacyIntakeContextForHtml')return{candidates:[{stayKey:'stay-1',dogName:'Milo'}],document:p.documentId?{documentId:p.documentId,stayKey:'stay-1',dogName:p.documentId==='doc-2'?'Rex':'Milo',extractionMethod:'Free Browser OCR · Tesseract.js',extractedText:p.documentId==='doc-2'?'':window.__raw,parsedFields:{dogName:p.documentId==='doc-2'?'Rex':'Milo'},aiStatus:'Complete'}:null};
 if(name==='saveLegacyIntakeMediaForFreeOcrV11206'){window.__calls.saves++;window.__savedPdf=p.fileData;if(window.__delaySave)await new Promise(resolve=>window.__releaseSave=resolve);return{documentId:'doc-1',stayKey:p.stayKey,dogName:'Milo',originalFilename:p.fileName}}
 if(name==='retryLegacyIntakeAiPriorityV11207'){window.__calls.cloud++;return{result:'partial_success',aiStatus:'AI Failed',errorMessage:'providers unavailable'}}
 if(name==='getLegacyIntakeOcrSourceForHtmlV11206')return{fileData:window.__savedPdf};
 if(name==='processLegacyIntakeFreeOcrTextV11206'){window.__calls.text++;if(window.__calls.text===1)throw Error('temporary backend failure');window.__raw=p.rawText;return{result:'success',documentId:p.documentId,dogName:'Milo',aiStatus:'Complete',provider:'tesseract',rawOcrText:p.rawText,extraction:{}}}
 throw Error('Unexpected Apps Script call '+name)
};
let ok,fail;window.google={script:{run:new Proxy({withSuccessHandler(f){ok=f;return this},withFailureHandler(f){fail=f;return this}},{get(t,k){if(k in t)return t[k];return p=>Promise.resolve().then(()=>window.__mockCall(k,p)).then(ok,fail)}})}};
window.Tesseract={createWorker:async()=>({recognize:async input=>{window.__recognizedInputs.push(input);return{data:{text:'Handwritten note: give half tablet at bedtime.',confidence:88}}},terminate:async()=>{}})};
</script>`;

const source = fs.readFileSync(path.join(root, 'apps-script', 'LegacyIntake.html'), 'utf8')
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com[^>]+><\/script>/, '')
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]+><\/script>/, '')
  .replace('<?!= JSON.stringify(initialStayKey) ?>', '"stay-1"')
  .replace('<?!= JSON.stringify(initialDocumentId) ?>', '""')
  .replace('window.pdfjsLib.getDocument({data:dataUrlBytes(dataUrl)})', 'window.pdfjsLib.getDocument({data:dataUrlBytes(dataUrl),disableWorker:true})')
  .replace(/<script>\r?\nconst INITIAL_STAY_KEY=/, `${bridge}<script>\nconst INITIAL_STAY_KEY=`);

// PDF.js parses/renders local PDF bytes; only providers and Apps Script are mocked.
function pdfFixture(text, raster = false) {
  const content = [text ? `BT /F1 12 Tf 30 740 Td (${text}) Tj ET` : '', raster ? 'q 300 0 0 300 100 200 cm /Im0 Do Q' : ''].filter(Boolean).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> ${raster ? '/XObject << /Im0 6 0 R >>' : ''} >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  if (raster) {
    const pixels = 'FF0000 00FF00 0000FF FFFFFF>';
    objects.push(`<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${Buffer.byteLength(pixels)} >>\nstream\n${pixels}\nendstream`);
  }
  let out = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(out); out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(n => { out += `${String(n).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return { name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from(out) };
}

async function openScanner(page) {
  const pageErrors=[];page.__errors=pageErrors;page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('https://**/*', route => route.request().url().includes('pdf.worker.min.js')
    ? route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(require.resolve('pdfjs-dist/legacy/build/pdf.worker.js')) })
    : route.abort());
  await page.setContent(source);
  await page.addScriptTag({ path: pdfjsPath });
  await page.evaluate(() => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; });
  await page.locator('#staySelect').selectOption('stay-1');
  return pageErrors;
}

test.afterEach(async ({ page }) => { expect(page.__errors || []).toEqual([]); });

test('selectable text and raster scanned pages are parsed and read in browser', async ({ page }) => {
  await openScanner(page);
  await page.locator('#mediaFile').setInputFiles(pdfFixture('Typed PDF feeding twice daily.'));
  await expect(page.locator('#fileCard')).toContainText('1 page ready');
  const embedded = await page.evaluate(() => embeddedPdfText[0]);
  expect(embedded).toContain('Typed PDF feeding twice daily');
  await page.locator('#mediaFile').setInputFiles(pdfFixture('', true));
  await expect(page.locator('#fileCard')).toContainText('1 page ready');
  const scanned = await page.evaluate(() => tesseractRead({ images: ocrImages, textPages: embeddedPdfText }));
  expect(scanned.rawText).toContain('Handwritten note');
  expect(scanned.confidence).toBe(88);
  expect(await page.evaluate(() => window.__recognizedInputs[0])).toMatch(/^data:image\/jpeg/);
});

test('mixed text and handwriting survive fallback on one page', async ({ page }) => {
  await openScanner(page);
  await page.locator('#mediaFile').setInputFiles(pdfFixture('Owner printed medication feeding values and details.', true));
  await expect(page.locator('#fileCard')).toContainText('1 page ready');
  const read = await page.evaluate(() => tesseractRead({ images: ocrImages, textPages: embeddedPdfText }));
  expect(read.rawText).toContain('printed medication');
  expect(read.rawText).toContain('Handwritten note');
});

test('invalid PDF is rejected before upload', async ({ page }) => {
  await openScanner(page);
  await page.locator('#mediaFile').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') });
  await expect(page.locator('#uploadStatus')).toContainText('Invalid PDF structure');
  expect(await page.evaluate(() => window.__calls.saves)).toBe(0);
});

test('failed OCR can retry without uploading a duplicate and keeps raw text visible', async ({ page }) => {
  await openScanner(page);
  await page.locator('#mediaFile').setInputFiles(pdfFixture('Typed PDF feeding twice daily.'));
  await expect(page.locator('#fileCard')).toContainText('1 page ready');
  await page.locator('#processBtn').click();
  await expect(page.locator('#uploadStatus')).toContainText('temporary backend failure');
  expect(await page.evaluate(() => window.__calls.saves)).toBe(1);
  await page.locator('#retryExistingBtn').click();
  await expect(page.locator('#resultPanel')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__calls.saves)).toBe(1);
  expect(await page.evaluate(() => window.__raw)).toContain('Typed PDF feeding twice daily');
  await expect(page.locator('#rawOcrDetails')).toBeVisible();
  expect(await page.locator('#rawOcrText').inputValue()).toContain('Typed PDF feeding twice daily');
});

test('switching to a document with no stored OCR text does not show another document text', async ({ page }) => {
  await openScanner(page);
  await page.evaluate(() => {
    lastRawOcrText='Previous guest handwritten notes';
    configureExisting({documentId:'doc-1',dogName:'Milo',extractionMethod:'Free Browser OCR · Tesseract.js',extractedText:'Previous guest handwritten notes',parsedFields:{dogName:'Milo'}});
  });
  await page.evaluate(() => switchStored('doc-2'));
  await expect(page.locator('#existingDocument')).toContainText('Rex');
  await expect(page.locator('#rawOcrDetails')).toBeHidden();
  expect(await page.locator('#rawOcrText').inputValue()).toBe('');
});

test('file and stay controls stay disabled while the upload request is pending', async ({ page }) => {
  await openScanner(page);
  await page.locator('#mediaFile').setInputFiles(pdfFixture('Typed PDF feeding twice daily.'));
  await expect(page.locator('#fileCard')).toContainText('1 page ready');
  await page.evaluate(() => { window.__delaySave=true; });
  await page.locator('#processBtn').click();
  await expect.poll(() => page.evaluate(() => window.__calls.saves)).toBe(1);
  await expect(page.locator('#mediaFile')).toBeDisabled();
  await expect(page.locator('#cameraFile')).toBeDisabled();
  await expect(page.locator('#staySelect')).toBeDisabled();
  await page.evaluate(() => window.__releaseSave());
  await expect(page.locator('#mediaFile')).toBeEnabled();
  await expect(page.locator('#staySelect')).toBeEnabled();
});
