import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceScreen } from '../extension/navigation.js';
import { fillScreen } from '../extension/screen.js';
function button(text, action = '') {
 return { textContent: text, clicks: 0, getClientRects: () => [1], getAttribute: key => key === 'onclick' ? action : '', click() { this.clicks++; } };
}
function screen(buttons) { globalThis.location = { href: 'https://fe.afip.gob.ar/rcel/jsp/datos.jsp' }; globalThis.document = { querySelectorAll: () => buttons }; }
test('avanza automáticamente en cada paso completo', () => {
 for (const keys of [['point','invoice'], ['concept','date','from','to','due'], ['vat','cash'], ['description','quantity','price']]) {
  const next = button('Continuar >'); screen([next]);
  assert.equal(advanceScreen(keys).state, 'advancing'); assert.equal(next.clicks, 1);
 }
});
test('se detiene antes de confirmar o emitir', () => {
 for (const text of ['Confirmar datos', 'Emitir', 'Obtener CAE', 'Generar comprobante']) {
  const next = button('Continuar'), final = button(text); screen([next, final]);
  assert.equal(advanceScreen(['vat','cash']).state, 'review'); assert.equal(next.clicks + final.clicks, 0);
 }
});
test('pasos incompletos, botones ambiguos o campos inválidos no avanzan', () => {
 const next = button('Continuar'); screen([next]);
 assert.equal(advanceScreen(['vat']).state, 'waiting');
 screen([next, button('Siguiente')]); assert.equal(advanceScreen(['vat','cash']).state, 'stopped');
 next.form = { checkValidity: () => false }; screen([next]);
 assert.equal(advanceScreen(['vat','cash']).state, 'stopped'); assert.equal(next.clicks, 0);
});
test('rechaza emisión con etiqueta Continuar; el sondeo no pulsa', () => {
 const next = button('Continuar', 'confirmarComprobante()'); screen([next]);
 assert.equal(advanceScreen(['vat','cash']).state, 'review');
 assert.equal(advanceScreen([], false).state, 'editing'); assert.equal(next.clicks, 0);
});
test('selecciona consumidor final y Contado', () => {
 class Select {
  constructor(id, options) { this.id=id; this.tagName='SELECT'; this.options=options.map(([textContent,value])=>({textContent,value})); this.labels=[]; this.isConnected=true; }
  set value(v) {this.current=v;} get value() {return this.current;}
  getClientRects() {return [1];} getAttribute() {return null;} dispatchEvent() {}
 }
 globalThis.HTMLSelectElement=Select;
 globalThis.location={href:'https://fe.afip.gob.ar/rcel/jsp/datos.jsp'};
 const vat=new Select('idIVAReceptor',[['Consumidor Final','5']]);
 const cash=new Select('condicionVenta',[['Cuenta corriente','2'],['Contado','1']]);
 globalThis.document={querySelectorAll:()=>[vat,cash],querySelector:()=>null};
 assert.deepEqual(fillScreen({}).completed.sort(),['cash','vat']);
 assert.equal(vat.value,'5'); assert.equal(cash.value,'1');
});
test('marca Contado con checkbox sin pulsar botones', () => {
 const cash={type:'checkbox',tagName:'INPUT',labels:[{textContent:'Contado'}],isConnected:true,checked:false,getClientRects:()=>[1],dispatchEvent(){}};
 globalThis.location={href:'https://fe.afip.gob.ar/rcel/jsp/datos.jsp'};
 globalThis.document={querySelectorAll:()=>[cash],querySelector:()=>null};
 assert.deepEqual(fillScreen({}).completed,['cash']); assert.equal(cash.checked,true);
});
test('entra en Generar Comprobantes solo desde el menú principal', () => {
 const entry=button('GENERAR COMPROBANTES'); screen([entry]);
 assert.equal(advanceScreen([],false).state,'review');
 globalThis.location.href='https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp';
 assert.equal(advanceScreen([],false).state,'menu'); assert.equal(entry.clicks,0);
 assert.equal(advanceScreen([]).state,'advancing'); assert.equal(entry.clicks,1);
});
test('menú con confirmación o entrada duplicada no avanza', () => {
 for (const extra of [button('Confirmar'),button('GENERAR COMPROBANTES')]) {
  const entry=button('GENERAR COMPROBANTES'); screen([entry,extra]);
  globalThis.location.href='https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp';
  assert.equal(advanceScreen([]).state,'review'); assert.equal(entry.clicks,0);
 }
});
function pointFixture(options) {
 class Select {
  constructor(id,options) {this.id=id;this.tagName='SELECT';this.labels=[];this.isConnected=true;this.options=options;this.current='';this.events=0;}
  set value(v){this.current=v;} get value(){return this.current;}
  getClientRects(){return [1];} getAttribute(){return null;} dispatchEvent(){this.events++;}
 }
 globalThis.HTMLSelectElement=Select;
 globalThis.location={href:'https://fe.afip.gob.ar/rcel/jsp/buscarPtosVtas.jsp'};
 const point=new Select('puntoDeVenta',options);
 const invoice=new Select('tipoComprobante',[{textContent:'Factura C',value:'11'}]);
 globalThis.document={querySelectorAll:()=>[point,invoice],querySelector:()=>null};
 return {point,invoice};
}
test('elige único punto disponible y luego Factura C sin repetir eventos', () => {
 const {point,invoice}=pointFixture([{textContent:'Seleccione',value:'0'},{textContent:'0001',value:'1'},{textContent:'0002',value:'2',disabled:true}]);
 assert.deepEqual(fillScreen({}).completed,['point']);
 assert.equal(point.value,'1'); assert.equal(invoice.value,'');
 assert.deepEqual(fillScreen({}).completed,['point','invoice']); assert.equal(invoice.value,'11');
 const events=point.events+invoice.events; fillScreen({}); assert.equal(point.events+invoice.events,events);
});
test('cero o varios puntos no cambian campos ni eligen el primero', () => {
 for (const options of [[],[{textContent:'1',value:'1'},{textContent:'2',value:'2'}]]) {
  const {point,invoice}=pointFixture(options);
  assert.match(fillScreen({}),/Detenido/); assert.equal(point.value,''); assert.equal(invoice.value,'');
 }
});
test('valida Continuar sin pulsarlo y espera a que se habilite', () => {
 const next=button('CONTINUAR'); screen([next]);
 next.disabled=true;
 assert.equal(advanceScreen(['point','invoice'],'validate').state,'waiting');
 next.disabled=false;
 assert.equal(advanceScreen(['point','invoice'],'validate').state,'ready'); assert.equal(next.clicks,0);
 assert.equal(advanceScreen(['point','invoice']).state,'advancing'); assert.equal(next.clicks,1);
});
test('espera opción Factura C cargada después de seleccionar punto de venta', () => {
 const {point,invoice}=pointFixture([{textContent:'0001',value:'1'}]);
 invoice.options=[];
 assert.equal(fillScreen({}).waiting,true); assert.equal(point.value,'1');
 assert.equal(fillScreen({}).waiting,true);
 invoice.options=[{textContent:'FACTURA C',value:'11'}];
 assert.deepEqual(fillScreen({}).completed,['point','invoice']); assert.equal(invoice.value,'11');
});
test('acepta Factura C preseleccionada con ID distinto y control bloqueado', () => {
 for (const disabled of [false,true]) {
  const {point,invoice}=pointFixture([{textContent:'0001',value:'1'}]);
  point.value='1'; invoice.id='comprobanteElegido'; invoice.value='11'; invoice.disabled=disabled;
  const result=fillScreen({});
  assert.deepEqual(result.completed,['point','invoice']); assert.equal(result.waiting,undefined);
  assert.equal(invoice.events,0);
  const next=button('CONTINUAR'); screen([next]);
  assert.equal(advanceScreen(result.completed).state,'advancing'); assert.equal(next.clicks,1);
 }
});
test('no acepta otro tipo bloqueado aunque contenga Factura C entre sus opciones', () => {
 const {point,invoice}=pointFixture([{textContent:'1',value:'1'}]); point.value='1';
 invoice.value='6'; invoice.disabled=true; invoice.options.push({textContent:'Factura B',value:'6'});
 assert.match(fillScreen({}),/bloqueado/); assert.equal(invoice.value,'6');
});
test('no confunde dos selectores ni un tipo incorrecto con Factura C', () => {
 const {point,invoice}=pointFixture([{textContent:'1',value:'1'}]); point.value='1'; invoice.id='otro';
 const duplicate=Object.create(invoice); duplicate.id='segundo';
 globalThis.document.querySelectorAll=()=>[point,invoice,duplicate];
 assert.match(fillScreen({}),/varios selectores/);
 globalThis.document.querySelectorAll=()=>[point,invoice];
 invoice.options=[{textContent:'Factura B',value:'6'}];invoice.value='6';
 assert.equal(fillScreen({}).waiting,true); assert.equal(invoice.value,'6');
});
