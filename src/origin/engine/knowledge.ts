import { KnowledgeKind, SessionState } from './types';

export type NoteDefinition = { id:string; kind:KnowledgeKind; title:string; versions:{when:string[]; text:string; strike?:string}[]; doodle?:string };

export const notes: NoteDefinition[] = [
 {id:'beto-camera',kind:'observación',title:'El que filma',doodle:'▱→○',versions:[{when:['photo-back'],text:'Beto no aparece en la foto.'},{when:['fridge-reflection'],text:'Beto aparece reflejado. Elegía dónde quedar.',strike:'Beto no aparece'},{when:['child-voice'],text:'Beto dejó un hueco delante de la cámara. ¿Para mí?',strike:'Elegía dónde quedar'}]},
 {id:'elvira-chair',kind:'contradicción',title:'El lugar de Elvira',versions:[{when:['chair-mark'],text:'Elvira decía que Beto nunca se sentaba. El tapizado dice otra cosa.'},{when:['mate-seat'],text:'La marca no era de Beto: ahí apoyaban la fuente caliente.',strike:'El tapizado dice otra cosa'}]},
 {id:'radio-voices',kind:'testimonio',title:'Dos voces',versions:[{when:['radio-a'],text:'Malena: “mamá lo echó”. Debajo, Elvira dice “andá si querés”.'},{when:['radio-b'],text:'La segunda voz continúa: “pero llevate la cámara”. No suena a expulsión.',strike:'mamá lo echó'}]},
 {id:'match-time',kind:'recuerdo incompleto',title:'La tarde del partido',versions:[{when:['tv-memory'],text:'Recuerdo el grito del edificio. No recuerdo el gol.'},{when:['window-open'],text:'Las bocinas entran antes que el grito de la cinta. La grabación fue montada.'}]},
 {id:'malena-note',kind:'sospecha',title:'Malena',versions:[{when:['letter'],text:'Malena fechó la nota en 1994. Mi nombre está agregado con otra tinta.'},{when:['recipe-date'],text:'La receta usa esa misma tinta. Malena volvió después y corrigió ambas.'}]},
 {id:'elvira-food',kind:'testimonio',title:'El idioma de Elvira',versions:[{when:['recipe'],text:'Tres manos corrigieron el pastel. Elvira ganó: tachó a las otras dos.'},{when:['table-set'],text:'No decía “quedate”. Ponía otro plato.'}]},
 {id:'icecream-tub',kind:'observación',title:'El pote',versions:[{when:['fridge-tub'],text:'“HELADO” contiene tuco. “TUCO” contiene tornillos. La familia entera mintió antes que tirar un pote.'}]},
 {id:'door-debt',kind:'observación',title:'La puerta',versions:[{when:['door-mark'],text:'Atrás de una factura: “la puerta la arregla el que la rompió”. Cuatro firmas; ningún arreglo.'}]},
 {id:'tape-origin',kind:'hipótesis',title:'La cinta',versions:[{when:['tapes'],text:'Tres casetes, una misma etiqueta rehecha.'},{when:['tape-wear'],text:'El más gastado no es el más viejo. Alguien volvió siempre a la discusión.'},{when:['child-voice'],text:'La respiración al final es mía. ¿Recuerdo o repetición?',strike:'Alguien'}]},
 {id:'leaving',kind:'certeza provisional',title:'Quién se fue',versions:[{when:['mirror-gap'],text:'Todos cuentan que Beto se fue. El espejo conserva un rectángulo sin polvo: alguien se llevó una valija.'},{when:['recipe-date'],text:'Elvira cocinó para cuatro al día siguiente. Tal vez esperaba a Malena, no a Beto.',strike:'Beto se fue'}]},
 {id:'protagonist',kind:'recuerdo incompleto',title:'Yo',versions:[{when:['bed-indent'],text:'La cama chica tiene mi altura de entonces.'},{when:['child-voice'],text:'Yo estaba despierto. Fingí dormir mientras discutían.'}]},
 {id:'empty-place',kind:'relación',title:'El lugar vacío',versions:[{when:['rel-chair-table'],text:'La silla, el mate y la cámara señalan lugares distintos. El vacío cambia según quién habla.'}]},
];

export const visibleNotes=(state:SessionState)=>notes.map(n=>{const versions=n.versions.filter(v=>v.when.every(k=>state.knowledge.includes(k)));return versions.length?{...n,current:versions[versions.length-1],history:versions.slice(0,-1)}:null}).filter(Boolean) as Array<NoteDefinition&{current:NoteDefinition['versions'][number];history:NoteDefinition['versions']}>;

export const knowledgeGroups={filmer:['photo-back','fridge-reflection','child-voice'],conflict:['radio-a','radio-b','recipe-date'],timeline:['tv-memory','window-open','tape-wear'],child:['bed-indent','child-voice'],departure:['mirror-gap','recipe-date','door-mark']};
export const groupScore=(s:SessionState,key:keyof typeof knowledgeGroups)=>knowledgeGroups[key].filter(x=>s.knowledge.includes(x)).length;
