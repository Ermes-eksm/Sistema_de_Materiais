import type {Material} from './domain';
const wholeUnits=new Set(['un','und','unid','unidade','unidades','peça','peças','pç','pc','pcs','par','pares','kit','kits','caixa','caixas','cx','pacote','pacotes','pct']);
export function purchasePlan(m:Pick<Material,'minimum'|'available'|'unit'>){
 const whole=wholeUnits.has(m.unit.trim().toLocaleLowerCase('pt-BR').replace(/\./g,''));
 const scale=whole?1:1000;
 const target=Math.ceil((m.minimum*1.5-1e-9)*scale)/scale;
 const quantity=m.minimum>0?Math.max(0,Math.ceil((target-m.available-1e-9)*scale)/scale):0;
 return {target,quantity,whole};
}
