import { Scene, SessionState } from './types';

export type DirectedBeat={text:string;change:string;tone:'comic'|'tender'|'fracture'};
const beats:Record<Scene,DirectedBeat[]>={
 hallway:[
  {text:'En el pasillo se superponen tres voces: todos ofrecieron ayudar a vaciar. Nadie dijo qué día.',change:'hallway-voices',tone:'comic'},
  {text:'Una bolsa dice DONAR. Adentro está el juego de copas que Elvira no prestaba ni a la familia.',change:'donation-bag',tone:'tender'},
  {text:'Alguien dice “Beto se fue”. Otra voz, más lejos: “lo dejamos ir”.',change:'beto-wording',tone:'fracture'}],
 living:[
  {text:'En la cinta discuten quién se sentó sobre el control remoto. Afuera, todo el edificio grita un gol.',change:'remote-argument',tone:'comic'},
  {text:'La luz del televisor encuentra una taza servida para alguien que ya estaba por irse.',change:'waiting-cup',tone:'tender'},
  {text:'Beto sigue filmando. Durante cuatro segundos nadie recuerda que hay un chico en el cuarto.',change:'camera-keeps-running',tone:'fracture'}],
 kitchen:[
  {text:'El pote de “helado” contiene salsa. El de “salsa”, botones. Elvira desconfiaba de las etiquetas y de casi todos.',change:'false-labels',tone:'comic'},
  {text:'La receta termina con una orden: “guardar una porción”. No dice para quién.',change:'saved-portion',tone:'tender'},
  {text:'Malena baja la voz: “si le servís otro plato, no significa que vuelve”.',change:'fourth-plate',tone:'fracture'}],
 bedroom:[
  {text:'Una caja dice IMPORTANTE. Contiene garantías vencidas y una estampita pegada con cinta de embalar.',change:'important-box',tone:'comic'},
  {text:'La colcha conserva un pliegue pequeño: alguien fingió dormir para que los grandes siguieran hablando.',change:'child-awake',tone:'tender'},
  {text:'La grabación corta justo cuando Beto deja la cámara. El silencio pesa más que la discusión.',change:'camera-down',tone:'fracture'}]
};

export const pressure=(s:SessionState)=>Math.min(4,Math.floor((s.knowledge.length+s.relations.length*2+s.behavior.revisits)/4));
export const directBeat=(s:SessionState,scene:Scene):DirectedBeat|null=>{
 const level=pressure(s); if(level===0)return null;
 const candidates=beats[scene];
 const preferred=s.behavior.holds>s.behavior.taps?'tender':s.behavior.revisits>2?'fracture':'comic';
 const start=(level+s.behavior.sceneVisits[scene])%candidates.length;
 return candidates.find((b,i)=>i>=start&&b.tone===preferred)||candidates[start];
};
