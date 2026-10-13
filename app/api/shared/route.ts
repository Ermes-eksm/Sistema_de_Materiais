import {env} from 'cloudflare:workers';
import {digest} from '../../password';
import {empty} from '../../domain';
import {sharedData} from '../../shared-data';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
export async function GET(req:Request){
 const key=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!/^[a-f0-9]{64}$/.test(key))return reply({error:'Link inválido ou desativado. Solicite um novo link ao almoxarifado.'},404);
 try{const link=await env.DB!.prepare('SELECT id FROM share_links WHERE token_hash=? AND revoked_at IS NULL').bind(await digest(key)).first();
 if(!link)return reply({error:'Link inválido ou desativado. Solicite um novo link ao almoxarifado.'},404);
 const row=await env.DB!.prepare('SELECT payload FROM inventory WHERE id IN (1,2) ORDER BY id DESC LIMIT 1').first<{payload:string}>();
 return reply({state:sharedData(row?{...empty(),...JSON.parse(row.payload)}:empty()),serverTime:new Date().toISOString()});
 }catch{return reply({error:'Consulta indisponível. Tente atualizar em instantes.'},503)}
}
