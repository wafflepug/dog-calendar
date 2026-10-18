import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {mkdir} from 'node:fs/promises';
const password='Local-Only-Browser-Password-84!';
async function account(){
 if(!/^127\.0\.0\.1:9199$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || ''))throw Error('Local Auth emulator required');
 const auth=getAuth(getApps().find(a=>a.name==='browser')||initializeApp({projectId:'demo-palz-stay'},'browser'));
 const email=`browser-${randomUUID()}@example.test`;const u=await auth.createUser({email,password,emailVerified:true});
 return {email,uid:u.uid,async remove(){await auth.deleteUser(u.uid);}};
}
test('a business owner signs in, onboards two same-name dogs, books them, switches workspaces and signs out',async({page},info)=>{
 const a=await account();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/');await page.locator('#email').fill(a.email);await page.locator('#password').fill(password);await page.locator('#signin').click();
  await expect(page.locator('#business-form')).toBeVisible();
  await page.locator('#business-name').fill('Pilot Boarding');await page.locator('#business-slug').fill(`pilot-${randomUUID().slice(0,8)}`);
  await page.locator('#capacity').fill('3');await page.locator('#business-form button').click();
  await expect(page.locator('h1')).toHaveText('Pilot Boarding');
  await page.locator('#dog-name').fill('Coco');await page.locator('#owner-name').fill('Pilot Owner');await page.locator('#dog-form button').click();
  await expect(page.locator('.row')).toContainText('#00001');
  await page.locator('#dog-name').fill('Coco');await page.locator('#dog-breed').fill('Poodle');await page.locator('#dog-form button').click();
  await expect(page.locator('.row')).toHaveCount(2);await expect(page.locator('.row').nth(1)).toContainText('#00002');
  await page.locator('[data-tab="bookings"]').click();
  for(const checkbox of await page.locator('input[name="dog"]').all())await checkbox.check();
  await page.locator('#start-date').fill('2026-12-08');await page.locator('#end-date').fill('2026-12-10');await page.locator('#booking-form button').click();
  await expect(page.locator('.row')).toHaveCount(1);await expect(page.locator('.row')).toContainText('Coco, Coco');
  await page.locator('#switch-workspace').click();await page.locator('#new-business').click();
  await page.locator('#business-name').fill('Second Business');await page.locator('#business-slug').fill(`second-${randomUUID().slice(0,8)}`);await page.locator('#business-form button').click();
  await expect(page.locator('h1')).toHaveText('Second Business');await expect(page.locator('.row')).toHaveCount(0);
  await page.locator('#switch-workspace').click();await expect(page.locator('[data-business]')).toHaveCount(2);
  await page.getByRole('button',{name:/Pilot Boarding/}).click();await expect(page.locator('.row')).toHaveCount(2);
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,small:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.disabled).map(b=>b.getBoundingClientRect().height)}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);expect(geometry.small.every(h=>h>=44)).toBe(true);expect(errors).toEqual([]);
  if(info.project.name==='chromium-390'||info.project.name==='chromium-1440'){await mkdir('screenshots',{recursive:true});await page.screenshot({path:`screenshots/workspace-${info.project.name}.png`,fullPage:true});}
  // A late authenticated response must not repaint a signed-out user's screen.
  await page.locator('#switch-workspace').click();let release!:()=>void;const pause=new Promise<void>(r=>release=r);let waiting!:()=>void;const entered=new Promise<void>(r=>waiting=r);
  await page.route('**/api/businesses/*/workspace',async route=>{waiting();await pause;await route.continue();});
  await page.getByRole('button',{name:/Pilot Boarding/}).click();await entered;
  await page.locator('#signout').click();await expect(page.locator('#auth-form')).toBeVisible();const lateResponse=page.waitForResponse(r=>r.url().includes('/workspace'));release();await (await lateResponse).finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#auth-form')).toBeVisible();await expect(page.locator('.row')).toHaveCount(0);
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
 }finally{await a.remove();}
});

test('an invitation leaves the address bar before sign-in and an unverified account cannot create a business',async({page})=>{
 await page.goto('/?invite=synthetic-not-a-valid-invitation-token');
 await expect(page.locator('#auth-form')).toBeVisible();expect(page.url()).not.toContain('invite=');
 const email=`unverified-${randomUUID()}@example.test`;
 await page.locator('#email').fill(email);await page.locator('#password').fill(password);await page.locator('#signup').click();
 await expect(page.locator('#check-verified')).toBeVisible();await expect(page.locator('#business-form')).toHaveCount(0);
 await expect(page.locator('body')).toContainText(/local|emulator/i);
 const auth=getAuth(getApps().find(a=>a.name==='browser')||initializeApp({projectId:'demo-palz-stay'},'browser'));
 const identity=await auth.getUserByEmail(email);await auth.updateUser(identity.uid,{emailVerified:true});
 await page.locator('#check-verified').click();await expect(page.locator('#accept-invite')).toBeVisible();
 await page.locator('#skip-invite').click();await expect(page.locator('#business-form')).toBeVisible();
 await page.locator('#signout').click();await expect(page.locator('#auth-form')).toBeVisible();
 await auth.deleteUser(identity.uid);
});
