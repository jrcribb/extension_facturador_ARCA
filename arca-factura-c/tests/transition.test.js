import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForTransition } from '../extension/transition.js';
const base={documentId:'old',active:async()=>true,pause:async()=>{}};
test('continúa tras navegación lenta y destrucción del contexto',async()=>{
 let calls=0;
 const result=await waitForTransition({...base,read:async()=>{
 calls++;
 if(calls===1)throw Error('Frame removed');
 if(calls<6)return {state:'loading'};
 return {documentId:'new',result:{state:'editing'}};
 }});
 assert.equal(result.state,'changed');assert.equal(calls,6);
});
test('detiene al llegar al resumen final, cancelar o agotar la espera',async()=>{
 assert.equal((await waitForTransition({...base,read:async()=>({documentId:'new',result:{state:'review'}})})).state,'review');
 assert.equal((await waitForTransition({...base,active:async()=>false})).state,'cancelled');
 assert.equal((await waitForTransition({...base,attempts:2,read:async()=>({documentId:'old'})})).state,'stopped');
});
