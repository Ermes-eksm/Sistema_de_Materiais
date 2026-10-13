export type Material={id:string;code:string;name:string;category:string;unit:string;kind:string;minimum:number;available:number;maintenance:number;lost:number};
export type Recipient={id:string;name:string;cpfPrefix:string;cpf?:string;registration?:string;role?:string;admission?:string;updatedAt?:string;createdAt:string;createdBy:string};
export type Loan={id:string;materialId:string;person:string;registration:string;cpfPrefix?:string;recipientId?:string;quantity:number;remaining:number;at:string;due:string;closedAt?:string};
export type Movement={id:string;materialId:string;type:string;quantity:number;at:string;actor:string;actorId:string;person:string;registration:string;cpfPrefix?:string;recipientId?:string;note:string;loanId?:string};
export type ImportReceipt={key:string;at:string;source:string;added:number;updated:number;unchanged:number;total:number};
export type State={imports?:ImportReceipt[];recipients:Recipient[];materials:Material[];loans:Loan[];movements:Movement[]};
export const empty=():State=>({recipients:[],materials:[],loans:[],movements:[]});
const txt=(v:unknown,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
export function apply(state:State,b:any,actor:{displayName:string;userId:string},now=new Date()):State{
 const s=structuredClone(state), at=now.toISOString(); s.recipients ||= [];
 const positive=(v:unknown)=>{const n=Number(v);if(!Number.isFinite(n)||n<=0||n>1e9||Math.abs(n*1000-Math.round(n*1000))>0.00001)throw Error('Informe uma quantidade positiva, com até 3 casas decimais.');return n;};
 const id=crypto.randomUUID();
 if(b.action==='recipient'||b.action==='recipientEdit'){
 const name=txt(b.name,120),cpf=txt(b.cpf,18).replace(/[^0-9]/g,''),cpfPrefix=cpf?cpf.slice(0,6):txt(b.cpfPrefix,18),registration=txt(b.registration,40),role=txt(b.role,100),admission=txt(b.admission,10);
 if(name.length<3||!/^\d{6}$/.test(cpfPrefix)||(cpf&&!/^\d{11}$/.test(cpf)))throw Error('Informe nome e CPF com 11 dígitos (ou mantenha os 6 primeiros dígitos do cadastro antigo).');
 if(admission&&(!/^\d{4}-\d{2}-\d{2}$/.test(admission)||!Number.isFinite(Date.parse(admission))||new Date(admission).toISOString().slice(0,10)!==admission))throw Error('Data de admissão inválida.');
 if(registration.toUpperCase().includes('PJ'))throw Error('Pessoas com matrícula PJ não integram este cadastro.');
 const existing=b.action==='recipientEdit'?s.recipients.find(r=>r.id===b.recipientId):undefined;
 if(b.action==='recipientEdit'&&!existing)throw Error('Pessoa não encontrada.');
 if(s.recipients.some(r=>r.id!==existing?.id&&((cpf&&r.cpf===cpf)||(registration&&r.registration===registration)||(r.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')&&r.cpfPrefix===cpfPrefix))))throw Error('Já existe cadastro com esta matrícula, CPF ou nome e início do CPF.');
 const values={name,cpfPrefix,cpf:cpf||undefined,registration,role,admission};
 if(existing)Object.assign(existing,values,{updatedAt:at});else s.recipients.push({id,...values,createdAt:at,createdBy:actor.displayName});
 s.movements.unshift({id:crypto.randomUUID(),materialId:'',type:existing?'Atualização de pessoa':'Cadastro de pessoa',quantity:0,at,actor:actor.displayName,actorId:actor.userId,person:name,registration,cpfPrefix,recipientId:existing?.id||id,note:existing?'Cadastro atualizado; entregas anteriores preservadas':'Destinatário cadastrado'});return s;
 }
 if(b.action==='material'){
 const name=txt(b.name),code=txt(b.code,40),unit=txt(b.unit,20),category=txt(b.category,60),minimum=Number(b.minimum);
 if(!name||!code||!unit||!category||!['returnable','consumable'].includes(b.kind)||!Number.isFinite(minimum)||minimum<0||minimum>1e9)throw Error('Preencha todos os dados do material corretamente.');
 if(s.materials.some(m=>m.code.toLowerCase()===code.toLowerCase()))throw Error('Já existe um material com esse código.');
 s.materials.push({id,code,name,unit,category,kind:b.kind,minimum,available:0,maintenance:0,lost:0});
 s.movements.unshift({id:crypto.randomUUID(),materialId:id,type:'Cadastro',quantity:0,at,actor:actor.displayName,actorId:actor.userId,person:'',registration:'',note:'Material cadastrado'});return s;
 }
 const m=s.materials.find(m=>m.id===b.materialId);if(!m)throw Error('Material não encontrado.');
 if(b.action==='minimum'){const n=Number(b.minimum);if(!Number.isFinite(n)||n<0||n>1e9)throw Error('Estoque mínimo inválido.');const old=m.minimum;m.minimum=n;s.movements.unshift({id,materialId:m.id,type:'Configuração',quantity:0,at,actor:actor.displayName,actorId:actor.userId,person:'',registration:'',note:`Estoque mínimo: ${old} → ${n}`});return s;}
 const q=positive(b.quantity);let type='',person=txt(b.person),registration='',cpfPrefix:string|undefined,recipientId:string|undefined,loanId:string|undefined;const note=txt(b.note,1000);
 if(['entry','replacement'].includes(b.action)){m.available+=q;type=b.action==='entry'?'Entrada':'Reposição';}
 else if(b.action==='out'){
 const r=s.recipients.find(r=>r.id===b.recipientId);if(!r)throw Error('Selecione uma pessoa cadastrada para receber o material.');person=r.name;registration=r.registration||'';cpfPrefix=r.cpfPrefix;recipientId=r.id;
 if(q>m.available)throw Error('Quantidade maior que o estoque disponível.');m.available-=q;type=m.kind==='returnable'?'Empréstimo':'Consumo';
 if(m.kind==='returnable'){loanId=id;s.loans.push({id,materialId:m.id,person,registration,cpfPrefix,recipientId,quantity:q,remaining:q,at,due:new Date(now.getTime()+86400000).toISOString()});}
 }else if(b.action==='return'||b.action==='loanIncident'){
 const l=s.loans.find(l=>l.id===b.loanId&&l.materialId===m.id);if(!l||q>l.remaining)throw Error('Quantidade superior à pendência atual.');person=l.person;registration=l.registration;cpfPrefix=l.cpfPrefix;recipientId=l.recipientId;loanId=l.id;
 if(b.action==='return'){m.available+=q;type='Devolução';}else{if(!note)throw Error('Descreva a ocorrência.');if(b.reason==='Dano'){m.maintenance+=q;type='Dano';}else if(['Extravio','Perda'].includes(b.reason)){m.lost+=q;type=b.reason;}else throw Error('Ocorrência inválida.');}
 l.remaining-=q;if(l.remaining<0.000001){l.remaining=0;l.closedAt=at;}
 }else if(b.action==='incident'){
 if(!note)throw Error('Descreva a ocorrência.');if(q>m.available)throw Error('Quantidade maior que o estoque disponível.');m.available-=q;
 if(['Dano','Manutenção'].includes(b.reason)){m.maintenance+=q;type=b.reason;}else if(['Extravio','Perda'].includes(b.reason)){m.lost+=q;type=b.reason;}else throw Error('Ocorrência inválida.');
 }else if(b.action==='repair'){if(q>m.maintenance)throw Error('Quantidade superior ao saldo em manutenção.');m.maintenance-=q;m.available+=q;type='Retorno de manutenção';}
 else throw Error('Operação inválida.');
 for(const k of ['available','maintenance','lost'] as const)m[k]=Math.round(m[k]*1000)/1000;
 s.movements.unshift({id,materialId:m.id,type,quantity:q,at,actor:actor.displayName,actorId:actor.userId,person,registration,cpfPrefix,recipientId,note,loanId});return s;
}
