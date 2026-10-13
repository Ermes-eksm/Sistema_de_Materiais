import type {State} from './domain';
// Explicit projection: never publish operator IDs, CPF, registration or free-text notes.
export function sharedData(s:State){return {
 materials:s.materials.map(({id,code,name,category,unit,kind,minimum,available,maintenance,lost})=>({id,code,name,category,unit,kind,minimum,available,maintenance,lost})),
 loans:s.loans.map(({id,materialId,person,quantity,remaining,at,due,closedAt})=>({id,materialId,person,quantity,remaining,at,due,closedAt})),
 movements:s.movements.map(({id,materialId,type,quantity,at,actor,person})=>({id,materialId,type,quantity,at,actor,person}))
};}
export type SharedData=ReturnType<typeof sharedData>;
