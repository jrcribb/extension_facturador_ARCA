import { test } from 'node:test';
import assert from 'node:assert/strict';
test('un solo inicio recorre todas las pantallas aunque Chrome pierda la respuesta de Continuar',async()=>{
 let listener, stage=0, clicks=0,starts=0;
 const data={};
 let resolveFinished;
 const finished=new Promise(resolve=>{resolveFinished=resolve;});
 const groups=[['point','invoice'],['concept','date','from','to','due'],['vat','cash'],['description','quantity','price']];
 globalThis.chrome={
 storage:{session:{get:async key=>({[key]:data[key]}),set:async values=>{Object.assign(data,values);if(values.runStatus==='Revisión final')resolveFinished();},remove:async key=>{delete data[key];},clear:async()=>{}}},
 tabs:{get:async()=>({id:1,url:data.run?'https://fe.afip.gob.ar/rcel/jsp/step.jsp':'https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp',status:'complete'}),onUpdated:{addListener(){}},onRemoved:{addListener(){}}},
 runtime:{id:'test',onMessage:{addListener(fn){listener=fn;}}},
 scripting:{executeScript:async({func,args})=>{
 const documentId=`doc${stage}`;
 if(func.name==='fillScreen')return [{documentId,result:{completed:groups[stage]}}];
 if(stage===4)return [{documentId,result:{state:'review',message:'Revisión final'}}];
 if(args[1]===false)return [{documentId,result:{state:'editing'}}];
 if(args[1]==='validate')return [{documentId,result:{state:'ready'}}];
 stage++; clicks++;
 if(stage===1)throw Error('Frame was removed');
 return [{documentId,result:{state:'advancing'}}];
 }}
 };
 await import('../extension/background.js');
 const config={amount:'999999.99',date:'2026-11-24',from:'2026-11-24',to:'2026-11-24',due:'2026-11-24'};
 starts++;await new Promise(resolve=>listener({type:'start',tabId:1,config},{id:'test'},resolve));
 await finished;
 assert.equal(starts,1);assert.equal(clicks,4);assert.equal(stage,4);assert.equal(data.run,undefined);
});
