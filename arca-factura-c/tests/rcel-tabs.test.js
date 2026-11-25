import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRcelTab,findRcelTabs,chooseRcelTab,checkStartTab,RCEL_PATTERNS} from '../extension/rcel-tabs.js';
const tab={id:42,windowId:2,index:3,url:'https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp',active:false,status:'complete'};
test('desde correo encuentra RCEL en otra ventana sin activar pestañas',async()=>{
 const result=await findRcelTabs({tabs:{query:async filter=>{assert.deepEqual(filter,{url:RCEL_PATTERNS});return [{id:1,url:'https://mail.google.com/'},tab];}}});
 assert.equal(result.length,1);assert.equal(chooseRcelTab(result,'').id,42);checkStartTab(result[0]);
});
test('varias pestañas exigen elección y una elección cerrada no se reemplaza',()=>{
 const other={...tab,id:43};
 assert.throws(()=>chooseRcelTab([tab,other],''),/Elegí/);
 assert.equal(chooseRcelTab([tab,other],'43').id,43);
 assert.throws(()=>chooseRcelTab([other],'42'),/Elegí/);
 assert.throws(()=>chooseRcelTab([],''),/No hay/);
});
test('rechaza sesión vencida, borradores y pestañas suspendidas o cargando',()=>{
 for(const value of [{...tab,url:'https://auth.afip.gob.ar/login'}, {...tab,url:'https://fe.afip.gob.ar/rcel/jsp/datos.jsp'}, {...tab,discarded:true}, {...tab,frozen:true}, {...tab,status:'loading'}])assert.throws(()=>checkStartTab(value));
});
test('permisos limitados a los dos hosts oficiales sin acceso al correo',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../extension/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.host_permissions,['https://fe.afip.gob.ar/*','https://fe.arca.gob.ar/*']);
 assert.equal(manifest.permissions.includes('activeTab'),false);assert.equal(manifest.permissions.includes('tabs'),false);
 for(const value of ['https://fe.afip.gob.ar.evil.com/rcel/', 'http://fe.afip.gob.ar/rcel/', 'https://mail.google.com/', 'https://fe.afip.gov.ar/rcel/'])assert.equal(isRcelTab(value),false);
});
