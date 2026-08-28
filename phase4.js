/* Waffle House Phase 4 loader · build 2026.08.28.01 */
(function(){
'use strict';
if(window.WAFFLE_PHASE4)return;
const BUILD='2026.08.28.01';
const PARTS=['phase4-core.js','phase4-booking.js','phase4-operations.js','phase4-ai-actions.js'];
async function load(file){if(Array.from(document.scripts).some(s=>String(s.src||'').includes('/'+file)))return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`${file}?build=${encodeURIComponent(BUILD)}`;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+file));document.head.appendChild(s)})}
async function start(){for(const file of PARTS)await load(file);window.dispatchEvent(new CustomEvent('waffle:phase4-ready',{detail:{build:BUILD}}))}
window.WAFFLE_PHASE4=Object.freeze({build:BUILD,phase:'phase-4-sitter-workflow-expansion',features:Object.freeze({fastBooking:true,ownerSelfService:true,capacityDecision:true,returningGuest:true,smartReminders:true,askWaffleActions:true,sitterInsights:true}),parts:PARTS.slice()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(console.error),{once:true});else start().catch(console.error);
})();
