import { env } from 'cloudflare:workers';
import { getOperator } from '../../operator-auth';
import { apply, empty } from '../../domain';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
// Recover the original inventory when the dedicated SSMA row has never been created.
// SQL copies the complete payload in the live database; no records or balances are reconstructed.
// INSERT OR IGNORE preserves any SSMA row created concurrently and makes recovery idempotent.
async function recoverOriginalInventory(){
 await env.DB!.prepare('INSERT OR IGNORE INTO inventory (id, version, payload) SELECT 2, version, payload FROM inventory WHERE id = 1').run();
}
export async function GET(req?:Request){
 const user=await getOperator();if(!user)return response({error:'Entre com sua conta para acessar.'},401);
 if(req&&new URL(req.url).searchParams.get('warehouse')&&new URL(req.url).searchParams.get('warehouse')!==user.warehouse)return response({error:'O sistema agora é exclusivo do SSMA. Atualize a página para continuar.'},401);
 try{await recoverOriginalInventory();const row=await env.DB!.prepare('SELECT version, payload FROM inventory WHERE id = ?').bind(2).first<{version:number;payload:string}>();return response({state:row?{...empty(),...JSON.parse(row.payload)}:empty(),version:row?.version??0,warehouse:user.warehouse,user:user.displayName,serverTime:new Date().toISOString()});}catch{return response({error:'Não foi possível carregar os dados. Tente novamente.'},503);}
}
export async function POST(req:Request){
 const user=await getOperator();if(!user)return response({error:'Sua sessão expirou. Entre novamente.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Origem inválida.'},403);
 try{
 const b:any=await req.json();
 if(b.warehouse&&b.warehouse!=='ssma')return response({error:'O almoxarifado geral foi desativado. Atualize a página para acessar o SSMA.'},409);
 if(b.action==='material'&&b.category!=='EPI')return response({error:'O Almoxarifado SSMA permite cadastrar somente EPI.'},400);
 const inventoryId=2; // Preserve the existing SSMA inventory. Never recreate or merge it.
 if(!Number.isInteger(b.version)||b.version<0)throw Error('Versão inválida.');
 await recoverOriginalInventory();
 await env.DB!.prepare('INSERT OR IGNORE INTO inventory (id, version, payload) VALUES (?, 0, ?)').bind(inventoryId,JSON.stringify(empty())).run();
 const row=await env.DB!.prepare('SELECT version, payload FROM inventory WHERE id = ?').bind(inventoryId).first<{version:number;payload:string}>();
 if(row!.version!==b.version)return response({error:'Outra operação atualizou o estoque. Atualize os dados e confira a quantidade antes de confirmar novamente.'},409);
 const state=apply(JSON.parse(row!.payload),b,user);
 const result=await env.DB!.prepare('UPDATE inventory SET payload = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(state),inventoryId,b.version).run();
 if(result.meta.changes!==1)return response({error:'O estoque mudou durante a operação. Atualize e tente novamente.'},409);
 return response({state,warehouse:user.warehouse,version:b.version+1,serverTime:new Date().toISOString()});
 }catch(e){return response({error:e instanceof Error?e.message:'Não foi possível salvar.'},400);}
}
