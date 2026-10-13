import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {digest} from './password';
export const COOKIE='__Host-salg_session';
export async function getOperator(){
 const h=await headers();const token=h.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await env.DB!.prepare('SELECT o.id, o.name, o.email, s.warehouse FROM sessions s JOIN operators o ON o.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await digest(token),Date.now()).first<{id:string;name:string;email:string;warehouse:string}>();
 return row&&['obra','ssma'].includes(row.warehouse)?{userId:row.id,displayName:row.name,email:row.email,warehouse:row.warehouse as 'obra'|'ssma'}:null;
}
export const sessionCookie=(value:string,seconds=604800)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
