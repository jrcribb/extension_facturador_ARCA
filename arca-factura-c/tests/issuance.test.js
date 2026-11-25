import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueOrInspect,awaitIssuance} from '../extension/issuance.js';
function fixture(text='') {
 const confirm=()=>false;
 globalThis.window={confirm,setTimeout:()=>1,clearTimeout(){}};
 globalThis.location={href:'https://fe.afip.gob.ar/rcel/jsp/final.jsp'};
 let calls=0;
 const button={textContent:'Confirmar datos',getClientRects:()=>[1],click(){assert.equal(window.confirm('Usted está por generar un nuevo comprobante. ¿Confirma la Operación?'),true);calls++;}};
 globalThis.document={body:{innerText:text},querySelectorAll:selector=>selector.startsWith('[role=')?[]:[button]};
 return {button,confirm,calls:()=>calls};
}
test('no emite sin opción explícita; emite una vez y restaura confirm',()=>{
 const f=fixture();assert.equal(issueOrInspect('issue',false).state,'stopped');assert.equal(f.calls(),0);
 assert.equal(issueOrInspect('issue',true).state,'submitted');assert.equal(f.calls(),1);assert.equal(window.confirm,f.confirm);
});
test('exige éxito y CAE, no basta encontrar un número ni presionar confirmar',()=>{
 fixture('CAE: 12345678901234');assert.equal(issueOrInspect('inspect').state,'pending');
 document.body.innerText='Comprobante generado';assert.equal(issueOrInspect('inspect').state,'pending');
 document.body.innerText='Comprobante generado CAE: 12345678901234';assert.equal(issueOrInspect('inspect').state,'issued');
 assert.equal(issueOrInspect('issue',true).state,'stopped');
});
test('regresa por MENU PRINCIPAL sólo después del éxito',()=>{
 fixture();let clicks=0;
 document.querySelectorAll=()=>[{textContent:'MENÚ PRINCIPAL',getClientRects:()=>[1],click(){clicks++;}}];
 assert.equal(issueOrInspect('menu',true).state,'stopped');
 document.body.innerText='Comprobante generado CAE: 12345678901234';
 assert.equal(issueOrInspect('menu',true).state,'returning');assert.equal(clicks,1);
});
test('no anuncia emisión si vence la espera o se cancela',async()=>{
 const base={inspect:async()=>({state:'pending'}),active:async()=>true,pause:async()=>{},attempts:2};
 assert.equal((await awaitIssuance(base)).state,'stopped');
 assert.equal((await awaitIssuance({...base,active:async()=>false})).state,'cancelled');
 assert.equal((await awaitIssuance({...base,inspect:async()=>({state:'issued'})})).state,'issued');
});
test('acepta el mensaje exacto diferido y deja otras preguntas al navegador',()=>{
 const f=fixture();f.button.click=()=>{};
 assert.equal(issueOrInspect('issue',true).state,'submitted');
 assert.equal(window.confirm('¿Eliminar otro elemento?'),false);
 assert.equal(window.confirm('Usted está por generar un nuevo comprobante. ¿Confirma la Operación?'),true);
 assert.equal(window.confirm,f.confirm);
});
test('confirma una ventana HTML diferida una sola vez y limpia al cancelar',()=>{
 const f=fixture();f.button.click=()=>{};issueOrInspect('issue',true);
 let clicks=0;
 const accept={textContent:'Confirmar',getClientRects:()=>[1],click(){clicks++;}};
 const dialog={innerText:'Usted está por generar un nuevo comprobante. ¿Confirma la Operación? Confirmar Cancelar',getClientRects:()=>[1],querySelectorAll:()=>[accept]};
 document.querySelectorAll=selector=>selector.startsWith('[role=')?[dialog]:[f.button];
 issueOrInspect('inspect',true);issueOrInspect('inspect',true);
 assert.equal(clicks,1);
 issueOrInspect('cancel',true);assert.equal(window.confirm,f.confirm);
});
test('reconoce Volver al menú principal y espera controles deshabilitados',()=>{
 fixture('Comprobante generado CAE: 12345678901234');let clicks=0;
 const button={textContent:'Volver al Menú Principal',disabled:true,getClientRects:()=>[1],click(){clicks++;}};
 document.querySelectorAll=()=>[button];
 assert.equal(issueOrInspect('menu',true).state,'waiting');
 button.disabled=false;assert.equal(issueOrInspect('menu',true).state,'returning');assert.equal(clicks,1);
});
test('resultado generado sin CAE visible permite regresar al menú',()=>{
 for(const text of ['El comprobante ha sido generado exitosamente.', 'Se ha generado el comprobante.', 'Operación exitosa']) {
  fixture(text);let clicks=0;
  document.querySelectorAll=selector=>selector.startsWith('[role=')?[]:[{textContent:'MENÚ PRINCIPAL',getClientRects:()=>[1],click(){clicks++;}}];
  assert.equal(issueOrInspect('inspect',true).state,'issued');
  assert.equal(issueOrInspect('menu',true).state,'returning');assert.equal(clicks,1);
 }
});
test('menú solo o texto de error nunca anuncian un comprobante generado',()=>{
 for(const text of ['Menú Principal', 'No se ha generado el comprobante.', 'Error: comprobante generado con datos inválidos.', 'Comprobante no autorizado']) {
  fixture(text);
  document.querySelectorAll=selector=>selector.startsWith('[role=')?[]:[{textContent:'MENÚ PRINCIPAL',getClientRects:()=>[1],click(){throw Error('No debe navegar');}}];
  assert.equal(issueOrInspect('inspect',true).state,'pending');
  assert.equal(issueOrInspect('menu',true).state,'stopped');
 }
});
