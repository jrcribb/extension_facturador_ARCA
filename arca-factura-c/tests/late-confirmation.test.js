import {test} from 'node:test';
import assert from 'node:assert/strict';
test('reconoce confirmación manual posterior al timeout sin emitir nuevamente',async()=>{
 let updated,waitingResolve;const waiting=new Promise(resolve=>{waitingResolve=resolve;});
 const originalTimeout=globalThis.setTimeout;globalThis.setTimeout=fn=>{queueMicrotask(fn);return 1;};
 let listener,issued=false,atMenu=false,clicks=0,notices=[];
 const data={};let complete;
 const done=new Promise(resolve=>{complete=resolve;});
 globalThis.chrome={
 storage:{session:{get:async k=>({[k]:data[k]}),set:async values=>{Object.assign(data,values);if(values.runStatus?.includes('Menú principal listo'))complete();if(values.run?.phase==='awaitingEmission')waitingResolve();},remove:async k=>{delete data[k];},clear:async()=>{}}},
 tabs:{get:async()=>({id:1,status:'complete',url:`https://fe.afip.gob.ar/rcel/jsp/${atMenu||!data.run?'menu_ppal':'review'}.jsp`}),onUpdated:{addListener(fn){updated=fn;}},onRemoved:{addListener(){}}},
 runtime:{id:'test',onMessage:{addListener(fn){listener=fn;}}},
 notifications:{create:async(id,notice)=>{notices.push(notice);}},
 scripting:{executeScript:async({func,args})=>{
 if(func.name==='advanceScreen')return [{documentId:'review',result:{state:'review',message:'Revisión'}}];
 assert.equal(func.name,'issueOrInspect');
 if(args[0]==='issue'){clicks++;throw Error('Context destroyed after submission');}
 if(args[0]==='inspect')return [{result:{state:issued?'issued':'pending'}}];
 if(args[0]==='menu'){atMenu=true;return [{result:{state:'returning'}}];}
 }}
 };
 await import('../extension/background.js');
 const config={amount:'12345.67',date:'2026-11-24',from:'2026-11-24',to:'2026-11-24',due:'2026-11-24',autoIssue:true};
 await new Promise(resolve=>listener({type:'start',tabId:1,config},{id:'test'},resolve));
 await waiting;assert.equal(data.run.phase,'awaitingEmission');
 issued=true;updated(1,{status:'complete'});
 await done;globalThis.setTimeout=originalTimeout;
 assert.equal(clicks,1);assert.equal(atMenu,true);assert.equal(notices.length,1);assert.match(notices[0].message,/12\.345,67/);
 assert.equal(data.draft.amount,'');assert.equal(data.draft.autoIssue,true);assert.equal(data.run,undefined);
});
