import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
const load=async(file,transform=s=>s)=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(transform(fs.readFileSync(file,'utf8')),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
globalThis.__peopleDomain=await load('app/domain.ts');const {apply,empty}=globalThis.__peopleDomain;
const {importPeople}=await load('app/people-import.ts',s=>s.replace("import {apply,type State} from './domain';",'const {apply}=globalThis.__peopleDomain;'));
const actor={userId:'test',displayName:'Operador de teste'};
const person={registration:'TEST-1',name:'Pessoa Teste',role:'Função de teste',cpf:'01234567890',admission:'2026-10-01'};
let old=apply(empty(),{action:'recipient',name:person.name,cpfPrefix:'012345'},actor);const oldId=old.recipients[0].id;
old.materials=[{id:'epi',available:8}];old.loans=[{id:'loan',recipientId:oldId,person:person.name,registration:'',remaining:1}];const history=structuredClone(old.movements);
const imported=importPeople(old,{people:[person],source:'Teste'},actor,'batch-1');assert.equal(imported.receipt.updated,1);assert.equal(imported.state.recipients[0].id,oldId);assert.equal(imported.state.recipients[0].cpf,'01234567890');assert.deepEqual(imported.state.materials,old.materials);assert.deepEqual(imported.state.loans,old.loans);assert.deepEqual(imported.state.movements.slice(1),history);
const repeated=importPeople(imported.state,{people:[person],source:'Teste'},actor,'batch-1');assert.equal(repeated.repeated,true);assert.deepEqual(repeated.state,imported.state);
assert.equal(importPeople(imported.state,{people:[person],source:'Teste'},actor,'batch-2').receipt.unchanged,1);
const changed=importPeople(imported.state,{people:[{...person,role:'Nova função'}],source:'Teste'},actor,'batch-3');assert.equal(changed.receipt.updated,1);assert.equal(changed.state.recipients[0].role,'Nova função');assert.equal(changed.state.recipients[0].id,oldId);
assert.throws(()=>importPeople(old,{people:[{...person,registration:'PJ'}],source:'Teste'},actor,'bad'),/PJ/);
assert.throws(()=>importPeople(old,{people:[person,person],source:'Teste'},actor,'bad'),/duplicado/);
assert.throws(()=>importPeople(old,{people:[{...person,admission:'2026-02-30'}],source:'Teste'},actor,'bad'),/admissão/);
assert.throws(()=>importPeople(imported.state,{people:[{...person,cpf:'99999999999'}],source:'Teste'},actor,'bad'),/divergem/);
const conflicting=structuredClone(imported.state);conflicting.recipients.push({...person,id:'other',cpfPrefix:'012345',cpf:'99999999999'});assert.throws(()=>importPeople(conflicting,{people:[person],source:'Teste'},actor,'bad'),/mais de um/);
assert.equal(old.recipients[0].cpf,undefined);
// New deliveries capture the registered employee number.
let delivery=apply(empty(),{action:'recipient',...person},actor);delivery=apply(delivery,{action:'material',name:'Teste',code:'E1',unit:'un',category:'EPI',minimum:0,kind:'returnable'},actor);delivery=apply(delivery,{action:'entry',materialId:delivery.materials[0].id,quantity:2},actor);delivery=apply(delivery,{action:'out',materialId:delivery.materials[0].id,recipientId:delivery.recipients[0].id,quantity:1},actor);assert.equal(delivery.loans[0].registration,'TEST-1');assert.equal(delivery.movements[0].registration,'TEST-1');assert.equal(delivery.movements[0].cpf,undefined);
console.log('PASS: import matching, preserved IDs/stock/history, idempotency, full fields, PJ exclusion, collision rejection and delivery registration.');
// User-provided batch is read only from scratch, never committed.
if(process.argv[2]){const batch=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const r=importPeople(empty(),batch,actor,'actual-dry-run');assert.equal(r.receipt.total,31);assert.equal(r.receipt.added,31);console.log('PASS: all 31 supplied employee records passed import validation.');}
