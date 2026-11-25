import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareStep } from '../extension/prepare.js';
function fixture(overrides={}) {
 return {active:async()=>true,pause:async()=>{}, fill:async()=>({documentId:'one',result:{completed:['point','invoice']}}),inspect:async()=>({documentId:'one',result:{state:'ready'}}),...overrides};
}
test('espera carga tardía de Factura C y botón sin intervención', async()=>{
 let fills=0,checks=0,pauses=0;
 const result=await prepareStep(fixture({
 fill:async()=>({documentId:'one',result:++fills<5?{completed:['point'],waiting:true,message:'Cargando Factura C'}:{completed:['point','invoice']}}),
 inspect:async()=>({documentId:'one',result:{state:++checks<3?'waiting':'ready'}}),
 pause:async()=>{pauses++;}
 }));
 assert.equal(result.state,'ready');assert.equal(fills,7);assert.equal(pauses,6);
});
test('timeout de dependencias nunca pasa a avance',async()=>{
 const result=await prepareStep(fixture({attempts:3,fill:async()=>({documentId:'one',result:{waiting:true,message:'Sin Factura C'}}),inspect:()=>{throw Error('No inspeccionar');}}));
 assert.equal(result.state,'stopped'); assert.match(result.message,/agotó la espera/);
});
test('cancelación y confirmación final detienen preparación',async()=>{
 assert.equal((await prepareStep(fixture({active:async()=>false}))).state,'cancelled');
 assert.equal((await prepareStep(fixture({inspect:async()=>({documentId:'one',result:{state:'review',message:'Revisar'}})}))).state,'review');
});
test('cambio de documento obliga a reconocer pantalla de nuevo',async()=>{
 assert.equal((await prepareStep(fixture({inspect:async()=>({documentId:'two',result:{state:'ready'}})}))).state,'changed');
});
