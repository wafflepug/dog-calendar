const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {deflateSync}=require('node:zlib');
const {installCarePolishFixture,booking}=require('./fixtures/care-polish-fixture');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const photoStart = source.indexOf('    function directoryPhotoTilePreviewUrl(');
const photoEnd = source.indexOf('\n    async function hydrateDirectoryDogPhotos(', photoStart);
const photoFunctions = source.slice(photoStart, photoEnd);

async function setup(page) {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.setContent(`<!doctype html><html><body>
    <article class="directory-card" data-directory-stay-key="milo|2026-10-17|2026-10-20" data-directory-dog-name="Milo">
      <div data-directory-photo><div class="directory-photo-media"><div class="directory-photo-placeholder" aria-label="No dog profile photo">🐶</div></div><button id="photoEdit" type="button">Edit photo</button></div>
      <div data-directory-tile-photo style="width:180px;height:180px"></div>
    </article>
  </body></html>`);
  await page.addScriptTag({ content: `
    function escapeDashboardHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
    function getDirectoryProfileCard(stayKey) { return [...document.querySelectorAll('.directory-card')].find(card => card.dataset.directoryStayKey === stayKey) || null; }
    ${photoFunctions}
    window.__setDirectoryDogPhoto = setDirectoryDogPhoto;
    window.__directoryPhotoTilePreviewUrl = directoryPhotoTilePreviewUrl;
  ` });
}

const syntheticPhotos=new Map();
function syntheticPhoto(width) {
  if(syntheticPhotos.has(width))return syntheticPhotos.get(width);
  const chunk=(name,data)=>{
    const type=Buffer.from(name),bytes=Buffer.concat([type,data]);let crc=0xffffffff;
    for(const value of bytes){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([header,bytes,tail]);
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(width,4);header[8]=8;header[9]=2;
  const stride=width*3+1,raw=Buffer.alloc(stride*width);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const offset=y*stride+1+x*3;raw[offset]=x%256;raw[offset+1]=y%256;raw[offset+2]=(x+y)%256;
  }
  const photo=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
  syntheticPhotos.set(width,photo);return photo;
}

test('roster tile uses a measured Drive rendition while profile photo stays full-size and unchanged renders reuse nodes', async ({ page }) => {
  await setup(page);
  const deliveries = [];
  await page.route('https://drive.google.com/thumbnail**', async route => {
    const url = new URL(route.request().url());
    const width = Number(url.searchParams.get('sz')?.replace(/^w/, '') || 1600);
    const body = syntheticPhoto(width);
    deliveries.push({ url: url.toString(), width, bytes: Buffer.byteLength(body) });
    await route.fulfill({ status: 200, contentType: 'image/png', body });
  });
  await page.evaluate(() => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 }));

  const original = 'https://drive.google.com/thumbnail?id=milo-1&sz=w1600';
  await page.evaluate(url => window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: { previewUrl: url } }), original);
  const tile = page.locator('.directory-guest-tile-image');
  const profile = page.locator('.directory-dog-photo');
  await expect(tile).toHaveAttribute('src', /id=milo-1&sz=w320/);
  await expect(profile).toHaveAttribute('src', original);
  await expect.poll(() => deliveries.length).toBe(2);
  const decoded = await page.evaluate(async () => {
    const images = [document.querySelector('.directory-guest-tile-image'), document.querySelector('.directory-dog-photo')];
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => ({ width: image.naturalWidth, height: image.naturalHeight, complete: image.complete }));
  });
  expect(decoded).toEqual([{ width: 320, height: 320, complete: true }, { width: 1600, height: 1600, complete: true }]);
  const tileBytes = deliveries.find(item => item.width === 320).bytes;
  const profileBytes = deliveries.find(item => item.width === 1600).bytes;
  expect(tileBytes).toBeLessThan(profileBytes);

  const samePhoto = await page.evaluate(async url => {
    const card = document.querySelector('.directory-card'), edit = document.getElementById('photoEdit');
    const tileImage = card.querySelector('.directory-guest-tile-image'), profileImage = card.querySelector('.directory-dog-photo');
    window.__initialTile = tileImage;
    window.__initialProfile = profileImage;
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(card, { subtree: true, childList: true, attributes: true, characterData: true });
    edit.focus();
    window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: { previewUrl: url } });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    mutations += observer.takeRecords().length;
    observer.disconnect();
    return { sameTile: card.querySelector('.directory-guest-tile-image') === tileImage,
      sameProfile: card.querySelector('.directory-dog-photo') === profileImage,
      editConnected: edit.isConnected, focusPreserved: document.activeElement === edit, mutations };
  }, original);
  expect(samePhoto).toEqual({ sameTile: true, sameProfile: true, editConnected: true, focusPreserved: true, mutations: 0 });
  expect(deliveries).toHaveLength(2);

  const changed = 'https://drive.google.com/thumbnail?id=milo-2&sz=w1600';
  await page.locator('#photoEdit').focus();
  await page.evaluate(url => window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: { previewUrl: url } }), changed);
  await expect(tile).toHaveAttribute('src', /id=milo-2&sz=w320/);
  await expect(profile).toHaveAttribute('src', changed);
  await expect.poll(() => deliveries.length).toBe(4);
  expect(await tile.evaluate(image => image.naturalWidth)).toBe(320);
  expect(await profile.evaluate(image => image.naturalWidth)).toBe(1600);
  expect(await page.locator('#photoEdit').evaluate(button => button.isConnected && document.activeElement === button)).toBe(true);

  const reusedOnChange = await page.evaluate(() => ({
    tile: document.querySelector('.directory-guest-tile-image') === window.__initialTile,
    profile: document.querySelector('.directory-dog-photo') === window.__initialProfile,
  }));
  // The source changes update the existing media nodes, including the ones captured at first render.
  expect(reusedOnChange).toEqual({ tile: true, profile: true });

  await page.evaluate(() => window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: null }));
  await expect(page.locator('.directory-photo-placeholder')).toHaveCount(1);
  await expect(page.locator('.directory-guest-tile-image')).toHaveCount(0);
  const repeatedEmpty = await page.evaluate(async () => {
    const card = document.querySelector('.directory-card'), edit = document.getElementById('photoEdit');
    const placeholder = card.querySelector('.directory-photo-placeholder');
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(card, { subtree: true, childList: true, attributes: true, characterData: true });
    edit.focus();
    window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: null });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    mutations += observer.takeRecords().length;
    observer.disconnect();
    return { samePlaceholder: card.querySelector('.directory-photo-placeholder') === placeholder,
      editConnected: edit.isConnected, focusPreserved: document.activeElement === edit, mutations };
  });
  expect(repeatedEmpty).toEqual({ samePlaceholder: true, editConnected: true, focusPreserved: true, mutations: 0 });
});

test('one failed small Drive rendition falls back once and unknown URLs remain untouched', async ({ page }) => {
  await setup(page);
  const requested = [];
  await page.route('https://drive.google.com/thumbnail**', async route => {
    const url = new URL(route.request().url());
    const width = Number(url.searchParams.get('sz')?.replace(/^w/, '') || 1600);
    requested.push(url.toString());
    if (url.searchParams.get('id') === 'fallback-1' && width === 320) {
      await route.fulfill({ status: 404, body: 'synthetic smaller rendition unavailable' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'image/png', body: syntheticPhoto(width) });
  });
  const original = 'https://drive.google.com/thumbnail?id=fallback-1&sz=w1600';
  await page.evaluate(url => window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: { previewUrl: url } }), original);
  const tile = page.locator('.directory-guest-tile-image');
  await expect.poll(() => tile.getAttribute('src')).toBe(original);
  await expect.poll(() => tile.evaluate(image => image.naturalWidth)).toBe(1600);
  await page.evaluate(url => window.__setDirectoryDogPhoto('milo|2026-10-17|2026-10-20', { dogPhoto: { previewUrl: url } }), original);
  await expect.poll(() => requested.filter(url => new URL(url).searchParams.get('sz') === 'w320')).toHaveLength(1);
  expect(await page.evaluate(url => window.__directoryPhotoTilePreviewUrl(url, { getBoundingClientRect: () => ({ width: 180 }) }), 'https://images.example.test/photo.jpg')).toBe('https://images.example.test/photo.jpg');
});

test('actual roster loads only its small preview until profile intent, and terminal failure restores initials',async({page,baseURL},testInfo)=>{
  const state=await installCarePolishFixture(page);
  const deliveries=[];
  await page.route('https://drive.google.com/thumbnail**',async route=>{
    const url=new URL(route.request().url()),width=Number(url.searchParams.get('sz').slice(1));
    deliveries.push({width,bytes:Buffer.byteLength(syntheticPhoto(width)),id:url.searchParams.get('id')});
    await route.fulfill(url.searchParams.get('id')==='broken'?{status:404,body:'Synthetic unavailable photo'}:{contentType:'image/png',body:syntheticPhoto(width)});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?photoDeliveryJourney=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const opener=page.locator('#directory-grid [data-open-directory-profile]');
  await expect(opener).toHaveCount(1);
  const original='https://drive.google.com/thumbnail?id=journey&sz=w1600';
  await page.evaluate(({stayKey,url})=>window.__setPolishPhoto(stayKey,{dogPhoto:{previewUrl:url}}),{stayKey:booking.stayKey,url:original});
  const tile=page.locator('.directory-guest-tile-image');
  await expect.poll(()=>tile.evaluate(node=>node.naturalWidth)).toBe(320);
  expect(deliveries.map(x=>x.width)).toEqual([320]);
  const readCount=state.reads.filter(x=>x==='get_guest_profile').length;
  await opener.click();
  const profile=page.locator('.directory-card.is-profile-active .directory-dog-photo');
  await expect.poll(()=>profile.evaluate(node=>node.naturalWidth)).toBe(1600);
  expect(deliveries.map(x=>x.width)).toEqual([320,1600]);
  expect(state.reads.filter(x=>x==='get_guest_profile').length-readCount).toBe(1);
  await testInfo.attach('synthetic-photo-delivery',{body:JSON.stringify(deliveries,null,2),contentType:'application/json'});
  await page.locator('#directoryBackToGuestsBtn').click();
  await page.evaluate(stayKey=>window.__setPolishPhoto(stayKey,{dogPhoto:{previewUrl:'https://drive.google.com/thumbnail?id=broken&sz=w1600'}}),booking.stayKey);
  await expect.poll(()=>tile.evaluate(node=>node.dataset.directoryPhotoFailed)).toBe('true');
  await expect(tile).toBeHidden();
  await expect(page.locator('.directory-card')).not.toHaveClass(/has-profile-photo/);
  const failedDeliveries=deliveries.filter(x=>x.id==='broken');
  expect(failedDeliveries.filter(x=>x.width===320)).toHaveLength(1);
  // The already-opened profile may also request its unchanged original rendition.
  expect(failedDeliveries.filter(x=>x.width===1600).length).toBeLessThanOrEqual(2);
  await page.evaluate(stayKey=>window.__setPolishPhoto(stayKey,{dogPhoto:{previewUrl:'https://drive.google.com/thumbnail?id=broken&sz=w1600'}}),booking.stayKey);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(deliveries.filter(x=>x.id==='broken')).toEqual(failedDeliveries);
  expect(state.writes).toHaveLength(0);
});
