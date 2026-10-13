import {env} from 'cloudflare:workers';
import {getOperator} from '../../../operator-auth';
import {digest,equalHash} from '../../../password';
import {empty,type State} from '../../../domain';
import {importPeople} from '../../../people-import';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const configured=(env as unknown as {PEOPLE_IMPORT_TOKEN_HASH?:string}).PEOPLE_IMPORT_TOKEN_HASH;
 const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 const service=!!configured&&/^[a-f0-9]{64}$/.test(bearer)&&equalHash(await digest(bearer),configured);
 const user=service?{userId:'authorized-import',displayName:'Importação autorizada do efetivo'}:await getOperator();
 if(!user)return reply({error:'Acesso não autorizado.'},401);
 if(!service&&req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
 try{
 const raw=await req.text();if(raw.length>500000)return reply({error:'Arquivo muito grande.'},413);
 const input=JSON.parse(raw),key=await digest(raw);
 await env.DB!.prepare('INSERT OR IGNORE INTO inventory (id,version,payload) SELECT 2,version,payload FROM inventory WHERE id=1').run();
 await env.DB!.prepare('INSERT OR IGNORE INTO inventory (id,version,payload) VALUES (2,0,?)').bind(JSON.stringify(empty())).run();
 for(let attempt=0;attempt<5;attempt++){
 const row=await env.DB!.prepare('SELECT version,payload FROM inventory WHERE id=2').first<{version:number;payload:string}>();
 const before={...empty(),...JSON.parse(row!.payload)} as State;
 const result=importPeople(before,input,user,key);
 if(result.repeated)return reply({receipt:result.receipt,verified:true});
 const write=await env.DB!.prepare('UPDATE inventory SET payload=?,version=version+1 WHERE id=2 AND version=?').bind(JSON.stringify(result.state),row!.version).run();
 if(write.meta.changes===1)return reply({receipt:result.receipt,verified:true});
 }
 return reply({error:'Estoque em atualização. Tente importar novamente.'},409);
 }catch(e){return reply({error:e instanceof Error?e.message:'Falha na importação.'},400)}
}
