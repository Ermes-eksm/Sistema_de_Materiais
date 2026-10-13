import {apply,type State} from './domain';
type PersonInput={name:string;registration:string;role:string;cpf:string;admission:string};
const norm=(s:string)=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
export function importPeople(state:State,input:unknown,actor:{userId:string;displayName:string},key:string,now=new Date()){
 const b=input as {people:PersonInput[];source:string};
 if(!b||!Array.isArray(b.people)||!b.people.length||b.people.length>1000||typeof b.source!=='string'||b.source.length>200)throw Error('Lote de importação inválido.');
 const done=state.imports?.find(i=>i.key===key);if(done)return {state,receipt:done,repeated:true};
 let s=structuredClone(state),added=0,updated=0,unchanged=0;
 const registrations=new Set<string>(),cpfs=new Set<string>();
 for(const [index,p] of b.people.entries()){
 if(!p||['name','registration','role','cpf','admission'].some(k=>typeof (p as any)[k]!=='string'||!(p as any)[k].trim()))throw Error(`Linha ${index+1}: faltam dados obrigatórios.`);
 const values={name:p.name.trim(),registration:p.registration.trim(),role:p.role.trim(),cpf:p.cpf.replace(/[^0-9]/g,''),admission:p.admission};
 if(values.registration.toUpperCase().includes('PJ'))throw Error(`Linha ${index+1}: matrícula PJ não permitida.`);
 if(!/^\d{11}$/.test(values.cpf)||values.name.length>120||values.registration.length>40||values.role.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(values.admission))throw Error(`Linha ${index+1}: formato inválido.`);
 if(registrations.has(values.registration)||cpfs.has(values.cpf))throw Error(`Linha ${index+1}: matrícula ou CPF duplicado no arquivo.`);
 registrations.add(values.registration);cpfs.add(values.cpf);
 const matches=(s.recipients||[]).filter(r=>r.cpf===values.cpf||r.registration===values.registration||(!r.cpf&&norm(r.name)===norm(values.name)&&r.cpfPrefix===values.cpf.slice(0,6)));
 if(matches.length>1)throw Error(`Linha ${index+1}: há mais de um cadastro correspondente. Revise antes de importar.`);
 const old=matches[0];
 if(old&&((old.cpf&&old.cpf!==values.cpf)||(old.registration&&old.registration!==values.registration)))throw Error(`Linha ${index+1}: matrícula e CPF divergem do cadastro existente.`);
 if(old&&Object.entries(values).every(([k,v])=>(old as any)[k]===v)){unchanged++;continue;}
 s=apply(s,{action:old?'recipientEdit':'recipient',recipientId:old?.id,...values},actor,now);
 if(old)updated++;else added++;
 }
 const receipt={key,at:now.toISOString(),source:b.source,added,updated,unchanged,total:b.people.length};
 s.imports=[...(s.imports||[]),receipt];return {state:s,receipt,repeated:false};
}
