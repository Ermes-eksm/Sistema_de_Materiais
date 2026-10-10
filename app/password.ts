const enc=new TextEncoder();
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),v=>v.toString(16).padStart(2,'0')).join('');}
export async function hashPassword(password:string,salt:string){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');
}
export function equalHash(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function validatePassword(p:unknown):p is string{return typeof p==='string'&&p.length>=12&&p.length<=128;}
export function normalizeEmail(e:unknown){if(typeof e!=='string')return '';const value=e.trim().toLowerCase();return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value:'';}
