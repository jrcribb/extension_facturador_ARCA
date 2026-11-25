import {test} from 'node:test';
import assert from 'node:assert/strict';
let imports=0;
async function popup(local={},session={},available=[{id:1,url:'https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp'}]) {
 const nodes={};
 for(const name of ['status','form','autoIssue','amount','start','mode','dates','clear','targetTab','targetStatus','refreshTabs','goToRcel'])nodes[name]={value:'',checked:false,disabled:true,textContent:'',handlers:{},replaceChildren(){},append(){},addEventListener(event,handler){this.handlers[event]=handler;}};
 nodes.form.querySelector=()=>nodes.start;
 globalThis.document={createElement:()=>({}),querySelector:selector=>nodes[selector==='form'?'form':selector.slice(1)]};
 const listeners=[];let submitted;
 function area(store,type){return {get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,store[key]])),set:async values=>{const changes={};for(const [key,value] of Object.entries(values)){changes[key]={newValue:value};store[key]=value;}for(const listener of listeners)listener(changes,type);}};}
 globalThis.chrome={storage:{local:area(local,'local'),session:area(session,'session'),onChanged:{addListener:fn=>listeners.push(fn)}},tabs:{query:async filter=>{assert.ok(filter.url);assert.equal(filter.active,undefined);return available;}},runtime:{sendMessage:async message=>{submitted=message;if(message.type==='start'){await chrome.storage.session.set({run:{config:message.config}});}return {message:'En ejecución'};}}};
 await import(`../extension/popup.js?test=${++imports}`);
 return {nodes,listeners,submitted:()=>submitted};
}
test('guarda al marcar, restaura al reabrir y envía el modo a la ejecución',async()=>{
 const local={},session={};
 let p=await popup(local,session);
 assert.equal(p.nodes.autoIssue.checked,false);
 p.nodes.autoIssue.checked=true;p.nodes.autoIssue.handlers.change();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(local.autoIssuePreference,true);
 p=await popup(local,session);
 assert.equal(p.nodes.autoIssue.checked,true);assert.equal(p.nodes.start.textContent,'Preparar y emitir');
 p.nodes.amount.value='12.345,67';
 await p.nodes.form.handlers.submit({preventDefault(){}});
 assert.equal(p.submitted().config.autoIssue,true);assert.equal(p.submitted().config.amount,'12345.67');
 assert.equal(p.nodes.autoIssue.disabled,true);
 // Emission clears amount, not the saved preference.
 for(const listener of p.listeners)listener({draft:{newValue:{amount:''}},run:{newValue:undefined}},'session');
 assert.equal(p.nodes.amount.value,'');assert.equal(p.nodes.autoIssue.checked,true);assert.equal(p.nodes.autoIssue.disabled,false);
});
test('muestra el modo real de una ejecución anterior aunque la preferencia sea distinta',async()=>{
 const p=await popup({autoIssuePreference:true},{run:{config:{autoIssue:false}}});
 assert.equal(p.nodes.autoIssue.checked,false);assert.equal(p.nodes.autoIssue.disabled,true);assert.equal(p.nodes.start.disabled,true);
});
test('desmarcar se guarda y no se reactiva al reabrir',async()=>{
 const local={autoIssuePreference:true};let p=await popup(local);
 p.nodes.autoIssue.checked=false;p.nodes.autoIssue.handlers.change();
 await new Promise(resolve=>setImmediate(resolve));
 p=await popup(local);assert.equal(p.nodes.autoIssue.checked,false);assert.equal(local.autoIssuePreference,false);
});

test('el panel exige selección entre dos RCEL y envía el destino elegido',async()=>{
 const tabs=[{id:10,url:'https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp',windowId:1,index:0},{id:20,url:'https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp',windowId:2,index:1}];
 const p=await popup({}, {}, tabs);
 assert.equal(p.nodes.targetTab.hidden,false);
 p.nodes.amount.value='1.000,00';
 await p.nodes.form.handlers.submit({preventDefault(){}});
 assert.equal(p.submitted(),undefined);assert.match(p.nodes.status.textContent,/Elegí/);
 p.nodes.targetTab.value='20';p.nodes.targetTab.handlers.change();
 await p.nodes.form.handlers.submit({preventDefault(){}});
 assert.equal(p.submitted().tabId,20);
});
test('sin RCEL el panel informa el problema y no inicia',async()=>{
 const p=await popup({}, {}, []);p.nodes.amount.value='1.000,00';
 await p.nodes.form.handlers.submit({preventDefault(){}});
 assert.equal(p.submitted(),undefined);assert.match(p.nodes.status.textContent,/No hay/);
});
