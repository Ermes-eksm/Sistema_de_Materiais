import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { apply, empty } from '../../domain';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return response({error:'Entre com sua conta para acessar.'},401);
 try{const row=await env.DB!.prepare('SELECT version, payload FROM inventory WHERE id = 1').first<{version:number;payload:string}>();return response({state:row?JSON.parse(row.payload):empty(),version:row?.version??0,user:user.displayName,serverTime:new Date().toISOString()});}catch{return response({error:'Não foi possível carregar os dados. Tente novamente.'},503);}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return response({error:'Sua sessão expirou. Entre novamente.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Origem inválida.'},403);
 try{
 const b:any=await req.json();if(!Number.isInteger(b.version)||b.version<0)throw Error('Versão inválida.');
 await env.DB!.prepare('INSERT OR IGNORE INTO inventory (id, version, payload) VALUES (1, 0, ?)').bind(JSON.stringify(empty())).run();
 const row=await env.DB!.prepare('SELECT version, payload FROM inventory WHERE id = 1').first<{version:number;payload:string}>();
 if(row!.version!==b.version)return response({error:'Outra operação atualizou o estoque. Atualize os dados e confira a quantidade antes de confirmar novamente.'},409);
 const state=apply(JSON.parse(row!.payload),b,user);
 const result=await env.DB!.prepare('UPDATE inventory SET payload = ?, version = version + 1 WHERE id = 1 AND version = ?').bind(JSON.stringify(state),b.version).run();
 if(result.meta.changes!==1)return response({error:'O estoque mudou durante a operação. Atualize e tente novamente.'},409);
 return response({state,version:b.version+1,serverTime:new Date().toISOString()});
 }catch(e){return response({error:e instanceof Error?e.message:'Não foi possível salvar.'},400);}
}
