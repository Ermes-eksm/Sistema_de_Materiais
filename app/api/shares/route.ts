import {env} from 'cloudflare:workers';
import {getOperator} from '../../operator-auth';
import {token,digest} from '../../password';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 if(!await getOperator())return reply({error:'Entre no sistema para gerenciar os links.'},401);
 try{const rows=await env.DB!.prepare('SELECT id, created_at AS createdAt, revoked_at AS revokedAt FROM share_links ORDER BY created_at DESC LIMIT 50').all();return reply({links:rows.results});}catch{return reply({error:'Não foi possível carregar os links.'},503)}
}
export async function POST(req:Request){
 const user=await getOperator();if(!user)return reply({error:'Entre no sistema para gerenciar os links.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
 try{const b=await req.json() as {action:string;id?:string};
 if(b.action==='revoke'){if(!b.id)return reply({error:'Link inválido.'},400);await env.DB!.prepare('UPDATE share_links SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(new Date().toISOString(),b.id).run();return reply({ok:true});}
 if(b.action!=='create')return reply({error:'Operação inválida.'},400);
 const key=token(),id=crypto.randomUUID(),at=new Date().toISOString();
 await env.DB!.prepare('INSERT INTO share_links (id, token_hash, created_by, created_at) VALUES (?, ?, ?, ?)').bind(id,await digest(key),user.userId,at).run();
 return reply({id,url:new URL('/compartilhado',req.url).href+'#token='+key});
 }catch{return reply({error:'Não foi possível atualizar o compartilhamento.'},503)}
}
