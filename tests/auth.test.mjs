import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const D1={prepare(sql){let params=[];return{bind(...p){params=p;return this},async first(){return db.prepare(sql).get(...params)||null},async all(){return {results:db.prepare(sql).all(...params)}},async run(){const r=db.prepare(sql).run(...params);return{meta:{changes:Number(r.changes)}}}}},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.__env={DB:D1};globalThis.__headers=new Headers();
async function load(file,transform=s=>s){const text=transform(fs.readFileSync(file,'utf8'));const output=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));}
globalThis.__password=await load('app/password.ts');
globalThis.__operator=await load('app/operator-auth.ts',s=>s.replace("import {headers} from 'next/headers';","const headers=async()=>globalThis.__headers;").replace("import {env} from 'cloudflare:workers';","const env=globalThis.__env;").replace("import {digest} from './password';","const {digest}=globalThis.__password;"));
const auth=await load('app/api/auth/route.ts',s=>s.replace("import {env} from 'cloudflare:workers';","const env=globalThis.__env;").replace("import {COOKIE,getOperator,sessionCookie} from '../../operator-auth';","const {COOKIE,getOperator,sessionCookie}=globalThis.__operator;").replace("import {token,digest,hashPassword,equalHash,validatePassword,normalizeEmail} from '../../password';","const {token,digest,hashPassword,equalHash,validatePassword,normalizeEmail}=globalThis.__password;"));
globalThis.__domain=await load('app/domain.ts');
const state=await load('app/api/state/route.ts',s=>s.replace("import { env } from 'cloudflare:workers';","const env=globalThis.__env;").replace("import { getOperator } from '../../operator-auth';","const {getOperator}=globalThis.__operator;").replace("import { apply, empty } from '../../domain';","const {apply,empty}=globalThis.__domain;"));
const url='https://test.example';
async function post(b,cookie='',origin=url,ip='127.0.0.1'){const r=new Request(url+'/api/auth',{method:'POST',headers:{origin,cookie,'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify(b)});globalThis.__headers=r.headers;const res=await auth.POST(r);return{res,json:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||''};}
assert.equal((await state.GET()).status,401);
const email='operator@example.test',password='a-long-password-for-test';
assert.equal((await post({action:'signup',name:'Operador Teste',email,password},'','https://other.example')).res.status,403);
assert.equal((await post({action:'signup',name:'Operador Teste',email,password:'short'})).res.status,400);
const signed=await post({action:'signup',name:'Operador Teste',email,password});assert.equal(signed.res.status,200);assert.equal(signed.json.recoveryCode.length,64);
assert.match(signed.res.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
const saved=db.prepare('SELECT * FROM operators').get();assert.notEqual(saved.password_hash,password);assert.equal(saved.password_hash.length,64);assert.equal(saved.name,'Operador Teste');
globalThis.__headers=new Headers({cookie:signed.cookie});assert.equal((await state.GET()).status,200);
const cookieRow=db.prepare('SELECT * FROM sessions').get();assert.notEqual(cookieRow.token_hash,signed.cookie.split('=')[1]);
assert.equal((await post({action:'login',email,password:'wrong-password'})).res.status,401);
const login=await post({action:'login',email:email.toUpperCase(),password});assert.equal(login.res.status,200);
assert.equal((await post({action:'logout'},login.cookie)).res.status,200);globalThis.__headers=new Headers({cookie:login.cookie});assert.equal((await state.GET()).status,401);
const recovered=await post({action:'recover',email,password:'changed-password-123',recoveryCode:signed.json.recoveryCode});assert.equal(recovered.res.status,200);assert.notEqual(recovered.json.recoveryCode,signed.json.recoveryCode);
globalThis.__headers=new Headers({cookie:signed.cookie});assert.equal((await state.GET()).status,401);
assert.equal((await post({action:'recover',email,password:'changed-password-456',recoveryCode:signed.json.recoveryCode})).res.status,400);
assert.equal((await post({action:'login',email,password})).res.status,401);
const newLogin=await post({action:'login',email,password:'changed-password-123'});assert.equal(newLogin.res.status,200);
globalThis.__headers=new Headers({cookie:newLogin.cookie});const stock=await state.GET();assert.equal(stock.status,200);assert.deepEqual((await stock.json()).state.recipients,[]);
const stateReq=new Request(url+'/api/state',{method:'POST',headers:{origin:url,cookie:newLogin.cookie},body:JSON.stringify({warehouse:'ssma',version:0,action:'recipient',name:'Destinatário Teste',cpfPrefix:'012345'})});globalThis.__headers=stateReq.headers;
assert.equal((await state.POST(stateReq)).status,200);
const persisted=JSON.parse(db.prepare('SELECT payload FROM inventory WHERE id=2').get().payload);assert.equal(persisted.recipients[0].cpfPrefix,'012345');assert.equal(persisted.recipients[0].createdBy,'Operador Teste');
// SSMA is the only operational inventory, including for legacy sessions.
assert.equal(newLogin.json.user.warehouse,'ssma');
const legacyData=JSON.stringify({materials:[{id:'general-only',name:'Material geral antigo'}],recipients:[],loans:[],movements:[]});
db.prepare('INSERT INTO inventory (id,version,payload) VALUES (1,7,?)').run(legacyData);
async function move(body,cookie){const req=new Request(url+'/api/state',{method:'POST',headers:{origin:url,cookie},body:JSON.stringify(body)});globalThis.__headers=req.headers;const res=await state.POST(req);return{res,json:await res.json()};}
globalThis.__headers=new Headers({cookie:newLogin.cookie});const existing=await (await state.GET()).json();assert.equal(existing.warehouse,'ssma');assert.equal(existing.state.recipients[0].cpfPrefix,'012345');
let ss=await move({version:existing.version,action:'material',name:'EPI já cadastrado',code:'EPI-1',category:'EPI',unit:'un',kind:'consumable',minimum:2},newLogin.cookie);assert.equal(ss.res.status,200);const materialId=ss.json.state.materials[0].id;
ss=await move({version:ss.json.version,action:'entry',materialId,quantity:8},newLogin.cookie);assert.equal(ss.res.status,200);
const ssmaBefore=JSON.stringify(db.prepare('SELECT * FROM inventory WHERE id=2').get());
// Session from the former general warehouse now sees the existing SSMA dataset.
const tokenHash=await globalThis.__password.digest(newLogin.cookie.split('=')[1]);db.prepare("UPDATE sessions SET warehouse='obra' WHERE token_hash=?").run(tokenHash);
globalThis.__headers=new Headers({cookie:newLogin.cookie});const restored=await (await state.GET()).json();assert.equal(restored.warehouse,'ssma');assert.equal(restored.state.materials[0].id,materialId);assert.equal(restored.state.materials[0].available,8);assert.equal(restored.state.recipients[0].cpfPrefix,'012345');assert.ok(restored.state.movements.length>=3);
assert.equal((await state.GET(new Request(url+'/api/state?warehouse=obra'))).status,401);
assert.equal((await move({warehouse:'obra',version:restored.version,action:'entry',materialId,quantity:1},newLogin.cookie)).res.status,409);
assert.equal((await move({version:restored.version,action:'material',name:'General blocked',code:'G1',category:'Geral',unit:'un',kind:'consumable',minimum:0},newLogin.cookie)).res.status,400);
assert.equal((await move({version:restored.version,action:'entry',materialId:'general-only',quantity:1},newLogin.cookie)).res.status,400);
assert.equal(JSON.stringify(db.prepare('SELECT * FROM inventory WHERE id=2').get()),ssmaBefore);
assert.equal(db.prepare('SELECT payload FROM inventory WHERE id=1').get().payload,legacyData);
assert.equal((await post({action:'login',email,password:'changed-password-123',warehouse:'obra'})).res.status,400);
console.log('PASS: SSMA-only login, old-session compatibility, EPI quantities/history preserved, general inventory inaccessible and old-tab writes blocked.');
globalThis.__headers=new Headers();assert.equal((await state.GET()).status,401);
for(let i=0;i<16;i++)await post({action:'login',email:'absent@example.test',password:'wrong'},'',url,'127.0.0.2');
assert.equal((await post({action:'login',email:'absent@example.test',password:'wrong'},'',url,'127.0.0.2')).res.status,429);
console.log('PASS: cadastro/login, hashes, cookie seguro, logout, recuperação, revogação de sessões, origem, rate limit, proteção do estoque e cadastro autenticado de destinatário.');
// Regression: original production stock exists only in row 1 after SSMA activation.
const completeSSMA=db.prepare('SELECT * FROM inventory WHERE id=2').get();
db.prepare('UPDATE inventory SET version=?,payload=? WHERE id=1').run(completeSSMA.version,completeSSMA.payload);
db.prepare('DELETE FROM inventory WHERE id=2').run();
globalThis.__headers=new Headers({cookie:newLogin.cookie});
const recoveredStock=await state.GET();assert.equal(recoveredStock.status,200);
const recoveredPayload=await recoveredStock.json();assert.equal(recoveredPayload.state.materials[0].available,8);
assert.equal(recoveredPayload.state.materials[0].id,materialId);
assert.equal(db.prepare('SELECT payload FROM inventory WHERE id=2').get().payload,completeSSMA.payload);
assert.equal(db.prepare('SELECT version FROM inventory WHERE id=2').get().version,completeSSMA.version);
assert.equal(db.prepare('SELECT payload FROM inventory WHERE id=1').get().payload,completeSSMA.payload);
await state.GET();assert.equal(db.prepare('SELECT version FROM inventory WHERE id=2').get().version,completeSSMA.version);
const afterRecovery=await move({version:completeSSMA.version,action:'entry',materialId,quantity:2},newLogin.cookie);assert.equal(afterRecovery.res.status,200);assert.equal(afterRecovery.json.state.materials[0].available,10);
globalThis.__headers=new Headers({cookie:newLogin.cookie});await state.GET();assert.equal(JSON.parse(db.prepare('SELECT payload FROM inventory WHERE id=2').get().payload).materials[0].available,10);
console.log('PASS: exact restoration of original stock, IDs/history/version preserved, source untouched, no duplicate recovery and new entries persist.');

// Shared links are independent read-only capabilities, revocable server-side.
globalThis.__sharedData=await load('app/shared-data.ts');
const shareTransform=s=>s.replace("import {env} from 'cloudflare:workers';","const env=globalThis.__env;").replace("import {getOperator} from '../../operator-auth';","const {getOperator}=globalThis.__operator;").replace("import {token,digest} from '../../password';","const {token,digest}=globalThis.__password;").replace("import {digest} from '../../password';","const {digest}=globalThis.__password;").replace("import {empty} from '../../domain';","const {empty}=globalThis.__domain;").replace("import {sharedData} from '../../shared-data';","const {sharedData}=globalThis.__sharedData;");
const shares=await load('app/api/shares/route.ts',shareTransform),shared=await load('app/api/shared/route.ts',shareTransform);
function shareReq(body,origin=url){return new Request(url+'/api/shares',{method:'POST',headers:{origin},body:JSON.stringify(body)})}
globalThis.__headers=new Headers();assert.equal((await shares.POST(shareReq({action:'create'}))).status,401);assert.equal((await shares.GET()).status,401);
globalThis.__headers=new Headers({cookie:newLogin.cookie});assert.equal((await shares.POST(shareReq({action:'create'},'https://bad.example'))).status,403);
const created=await shares.POST(shareReq({action:'create'}));assert.equal(created.status,200);const link=await created.json(),key=new URLSearchParams(new URL(link.url).hash.slice(1)).get('token');assert.equal(key.length,64);assert.notEqual(db.prepare('SELECT token_hash FROM share_links').get().token_hash,key);
globalThis.__headers=new Headers();const request=new Request(url+'/api/shared',{headers:{Authorization:'Bearer '+key}});const publicRead=await shared.GET(request);assert.equal(publicRead.status,200);const publicState=await publicRead.json();assert.ok(publicState.state.materials.length);assert.equal(publicState.state.recipients,undefined);assert.equal(publicState.state.materials[0].available,10);
const sample=globalThis.__sharedData.sharedData({materials:[],recipients:[{cpfPrefix:'123456'}],loans:[{person:'Pessoa',cpfPrefix:'123456',registration:'secret'}],movements:[{actor:'Operador',actorId:'private-id',cpfPrefix:'123456',note:'private-note'}]});assert.ok(!JSON.stringify(sample).includes('123456'));assert.ok(!JSON.stringify(sample).includes('secret'));assert.ok(!JSON.stringify(sample).includes('private-'));
globalThis.__headers=request.headers;assert.equal((await state.GET()).status,401);assert.equal((await state.POST(new Request(url+'/api/state',{method:'POST',headers:{origin:url,Authorization:'Bearer '+key},body:JSON.stringify({action:'entry',quantity:999})}))).status,401);
assert.equal((await shared.GET(new Request(url+'/api/shared'))).status,404);assert.equal((await shared.GET(new Request(url+'/api/shared',{headers:{Authorization:'Bearer '+'a'.repeat(64)}}))).status,404);
globalThis.__headers=new Headers({cookie:newLogin.cookie});assert.equal((await shares.GET()).status,200);assert.equal((await shares.POST(shareReq({action:'revoke',id:link.id}))).status,200);globalThis.__headers=new Headers();assert.equal((await shared.GET(request)).status,404);
console.log('PASS: anonymous read-only share, token hash, sanitized data, authenticated management, origin checks, rejected writes and revocation.');

db.close();
