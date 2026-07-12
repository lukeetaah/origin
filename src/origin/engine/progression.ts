import { groupScore } from './knowledge';
import { SessionState } from './types';
export const deriveHypotheses=(s:SessionState)=>{
 const h:string[]=[];
 if(groupScore(s,'filmer')>=1)h.push('Beto prefería mirar desde afuera.');
 if(groupScore(s,'filmer')>=2)h[0]='Beto controlaba también la forma en que aparecía.';
 if(groupScore(s,'conflict')>=2)h.push('Malena simplificó la pelea para poder contarla.');
 if(groupScore(s,'timeline')>=2)h.push('La cinta mezcla momentos distintos de aquella tarde.');
 if(groupScore(s,'child')>=2)h.push('Mi recuerdo no nació solamente de las grabaciones.');
 return h;
};
export const canClose=(s:SessionState)=>Object.keys({filmer:0,conflict:0,timeline:0,child:0,departure:0}).filter(k=>groupScore(s,k as keyof typeof import('./knowledge').knowledgeGroups)>=2).length>=3;
export const endingFor=(action:'mirror'|'chair'|'door',s:SessionState)=>{
 const resolved=s.relations.length+s.hypotheses.length;
 if(action==='mirror')return resolved>3?'Girás el espejo hacia la mesa y dejás la libreta abierta en el reflejo. Por primera vez, el cuadro también te espera.':'Girás el espejo hacia la puerta. En el vidrio, alguien parece llegar un instante antes que vos.';
 if(action==='chair')return s.behavior.holds>s.behavior.taps?'Te sentás donde nadie coincidía que se había sentado. El tapizado cede con una familiaridad que no podés demostrar.':'La silla cruje. En la libreta, “lugar vacío” queda sin tachar.';
 return s.knowledge.includes('child-voice')?'Cerrás desde afuera. La discusión continúa hasta que el pestillo corta la última palabra. Esta vez sabés que aquella tarde no estabas dormido.':'La puerta cierra mal, como siempre. Adentro queda una versión que todavía sabe tu nombre.';
};
