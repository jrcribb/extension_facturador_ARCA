import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnToMenu} from '../extension/return-menu.js';
test('espera el botón tardío y vuelve automáticamente sin repetir navegación',async()=>{
 let attempts=0,clicks=0,reads=0;
 const result=await returnToMenu({active:async()=>true,pause:async()=>{},read:async()=>++reads>=6?'menu':'ready',click:async()=>{
 if(++attempts<4)return {state:'waiting'};
 clicks++;return {state:'returning'};
 }});
 assert.equal(result.state,'done');assert.equal(attempts,4);assert.equal(clicks,1);
});
test('clic con contexto destruido no se repite y se detecta destino',async()=>{
 let clicked=0,reads=0;
 const result=await returnToMenu({active:async()=>true,pause:async()=>{},read:async()=>++reads>=4?'menu':'ready',click:async()=>{clicked++;throw Error('Context destroyed');}});
 assert.equal(result.state,'done');assert.equal(clicked,1);
});
test('no informa regreso si menú no aparece y respeta cancelación',async()=>{
 const setup={active:async()=>true,pause:async()=>{},attempts:2,read:async()=> 'ready',click:async()=>({state:'waiting'})};
 assert.equal((await returnToMenu(setup)).state,'stopped');
 assert.equal((await returnToMenu({...setup,active:async()=>false})).state,'cancelled');
});
