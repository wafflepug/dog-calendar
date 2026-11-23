const {test,expect} = require('@playwright/test');
const fs = require('node:fs/promises');
const {parse} = require('../waffle-csv');

const stayId = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n'+
  '2026-11-20,Maple,Poodle,24/11/2026,26/11/2026,Fixture,0400000000,,,,,Boarding,Other,bbbbbbbb-bbbb-4bbb-8bbb-000000000001,'+stayId+',00001';
const encode = rows => rows.map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(',')).join('\r\n');

test('Sales template can be edited in spreadsheet format and imported after preview', async ({page,baseURL}) => {
  await page.route('https://docs.google.com/**',route=>route.fulfill({body:csv,contentType:'text/csv'}));
  await page.route('https://script.google.com/**',route=>route.abort());
  await page.goto(baseURL+'/sales-master.html');
  await expect(page.getByRole('rowheader',{name:/Maple/})).toBeVisible();
  await page.getByText('Spreadsheet tools',{exact:true}).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download import template'}).click();
  const template = await download;
  const parsed = parse(await fs.readFile(await template.path(),'utf8'));
  expect(parsed.ok).toBe(true);
  expect(parsed.records[1].cells[0]).toBe(stayId);
  const rows = parsed.records.map(row=>row.cells);
  rows[1][7] = '135.50';
  rows[1][8] = '26/11/2026';
  rows[1][9] = '12';
  rows[1][10] = 'Treats, café';
  const file = {name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(encode(rows))};
  await page.locator('[data-sales-file]').setInputFiles(file);
  await expect(page.getByText('Review prices and expenses before importing.')).toBeVisible();
  await expect(page.getByText('Unpriced',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Apply 1 entry'}).click();
  await expect(page.getByRole('row',{name:/Maple/})).toContainText('$135.50');
  await page.locator('[data-sales-file]').setInputFiles(file);
  await expect(page.locator('[data-sales-file-status]')).toContainText('Download a fresh template');
  await page.reload();
  await expect(page.getByRole('row',{name:/Maple/})).toContainText('$12.00');
  await page.getByRole('button',{name:'Edit Maple'}).click();
  const editor = page.getByRole('dialog',{name:'Manage a stay'});
  await editor.getByRole('checkbox',{name:/Paid/}).check();
  await editor.getByRole('button',{name:'Save price'}).click();
  await expect(editor.getByText(/payment recorded/i)).toBeVisible();
  await editor.getByText('Payment history',{exact:true}).click();
  await editor.getByRole('button',{name:'Record refund'}).click();
  await editor.getByLabel('Amount (AUD)').fill('20.00');
  await editor.getByRole('button',{name:'Save refund'}).click();
  await expect(editor.getByText('Refund recorded.')).toBeVisible();
  await expect(editor.getByText('$20.00 outstanding')).toBeVisible();
});

test('private stay shows approved update and saves handover with a scoped token', async ({page,baseURL}) => {
  const token = 'a'.repeat(64);
  const captured = [];
  await page.route('https://script.google.com/**',async route=>{
    const body = new URLSearchParams(route.request().postData());
    const payload = JSON.parse(body.get('payloadJson'));
    captured.push(payload);
    await route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{result:'success',value:{
      dogName:'Maple',startDate:'2026-11-24',endDate:'2026-11-26',update:'Maple settled in.',
      times:{dropoffTime:'09:00',pickupTime:payload.pickupTime || '16:00'},canEdit:true,canEditDropoff:false,revision:'r1'
    }}});
  });
  await page.goto(baseURL+'/owner-stay.html#token='+token);
  await expect(page.getByText('Maple settled in.')).toBeVisible();
  await expect(page.getByLabel('Drop-off')).toBeDisabled();
  await page.getByLabel('Pick-up').fill('16:30');
  await page.getByRole('button',{name:'Confirm times'}).click();
  await expect(page.getByRole('status')).toHaveText('Handover times confirmed.');
  expect(captured).toHaveLength(2);
  expect(captured[1]).toMatchObject({operation:'handover',token,revision:'r1',pickupTime:'16:30'});
});
