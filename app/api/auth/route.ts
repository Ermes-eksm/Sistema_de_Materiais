import {env} from 'cloudflare:workers';
import {COOKIE,getOperator,sessionCookie} from '../../operator-auth';
import {token,digest,hashPassword,equalHash,validatePassword,normalizeEmail} from '../../password';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
async function limit(key:string,max:number,windowMs:number){
 const now=Date.now(),bucket=Math.floor(now/windowMs);const id=await digest(`${key}:${bucket}`);
 const row=await env.DB!.prepare('INSERT INTO auth_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(id,now+windowMs).first<{attempts:number}>();
 return (row?.attempts??max+1)<=max;
}
export async function GET(){try{const user=await getOperator();return reply({user});}catch{return reply({error:'Não foi possível verificar sua sessão.'},503);}}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
 try{
 const raw=await req.text();if(raw.length>4096)return reply({error:'Dados inválidos.'},400);const b=JSON.parse(raw);
 if(b.action==='logout'){
 const t=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(t)await env.DB!.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(t)).run();
 return reply({ok:true},200,sessionCookie('',0));
 }
 if(!['signup','login','recover'].includes(b.action))return reply({error:'Operação inválida.'},400);
 const warehouse=b.warehouse;if(!['obra','ssma'].includes(warehouse))return reply({error:'Selecione Almoxarifado SSMA ou Almoxarifado Obra.'},400);
 const email=normalizeEmail(b.email),password=b.password;
 if(!email||typeof password!=='string'||password.length>128)return reply({error:'Informe e-mail e senha válidos.'},400);
 const ip=req.headers.get('cf-connecting-ip')||'unavailable';
 const ipOk=await limit(`ip:${ip}`,30,600000);
 const accountOk=await limit(`account:${email}`,15,600000);
 if(!ipOk||!accountOk)return reply({error:'Muitas tentativas. Aguarde 10 minutos e tente novamente.'},429);
 await env.DB!.batch([env.DB!.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()),env.DB!.prepare('DELETE FROM auth_limits WHERE expires_at <= ?').bind(Date.now())]);
 let operator=await env.DB!.prepare('SELECT id, name, email, password_hash, salt, recovery_hash FROM operators WHERE email = ?').bind(email).first<{id:string;name:string;email:string;password_hash:string;salt:string;recovery_hash:string}>();
 let recoveryCode:string|undefined;
 if(b.action==='signup'){
 if(!await limit(`signup:${ip}`,5,3600000))return reply({error:'Limite de cadastros atingido. Tente novamente em 1 hora.'},429);
 const name=typeof b.name==='string'?b.name.trim():'';
 if(name.length<3||name.length>120||!validatePassword(password))return reply({error:'Informe seu nome (3 a 120 caracteres) e uma senha de 12 a 128 caracteres.'},400);
 if(operator)return reply({error:'Não foi possível cadastrar esse e-mail. Tente entrar ou recuperar o acesso.'},400);
 const salt=token(),id=crypto.randomUUID();recoveryCode=token();const passwordHash=await hashPassword(password,salt),recoveryHash=await digest(recoveryCode);
 await env.DB!.prepare('INSERT INTO operators (id, email, name, password_hash, salt, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id,email,name,passwordHash,salt,recoveryHash,new Date().toISOString()).run();
 operator={id,name,email,password_hash:passwordHash,salt,recovery_hash:recoveryHash};
 }else if(b.action==='recover'){
 if(!validatePassword(password)||typeof b.recoveryCode!=='string'||!operator||!equalHash(await digest(b.recoveryCode.trim()),operator.recovery_hash))return reply({error:'E-mail/código inválido ou nova senha fora do limite de 12 a 128 caracteres.'},400);
 const salt=token();recoveryCode=token();const ph=await hashPassword(password,salt),rh=await digest(recoveryCode);
 const results=await env.DB!.batch([
 env.DB!.prepare('UPDATE operators SET password_hash = ?, salt = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?').bind(ph,salt,rh,operator.id,operator.recovery_hash),
 env.DB!.prepare('DELETE FROM sessions WHERE user_id = ?').bind(operator.id)
 ]);
 if(results[0].meta.changes!==1)return reply({error:'Código já utilizado. Use o código de recuperação mais recente.'},400);
 }else{
 const candidate=await hashPassword(password,operator?.salt||'0000000000000000000000000000000000000000000000000000000000000000');
 if(!operator||!equalHash(candidate,operator.password_hash))return reply({error:'E-mail ou senha incorretos.'},401);
 }
 const session=token();await env.DB!.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, warehouse) VALUES (?, ?, ?, ?)').bind(await digest(session),operator!.id,Date.now()+604800000,warehouse).run();
 return reply({user:{displayName:operator!.name,email:operator!.email,warehouse},recoveryCode},200,sessionCookie(session));
 }catch{return reply({error:'Não foi possível concluir. Confira os dados e tente novamente.'},400);}
}
