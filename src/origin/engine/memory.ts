/* eslint-disable @typescript-eslint/no-unused-vars */
import { deriveHypotheses } from './progression';
import { ActionKind, Hypothesis, Scene, SessionState } from './types';
const KEY='origin-session-v4';
const empty=():SessionState=>({behavior:{startedAt:Date.now(),taps:0,holds:0,drags:0,returns:0,revisits:0,hidden:0,sceneVisits:{hallway:0,living:0,kitchen:0,bedroom:0},objectVisits:{},lastActionAt:Date.now()},readings:[],dramaticState:'threshold',knowledge:[],relations:[],hypotheses:[],pendingNotes:[],worldChanges:[]});
export class SessionEngine{
 private state=empty();
 constructor(){try{const saved=sessionStorage.getItem(KEY);if(saved){this.state=JSON.parse(saved);this.state.behavior.returns++;}}catch{}this.save();}
 act(id:string,kind:ActionKind,_scene:Scene){const b=this.state.behavior,elapsed=Date.now()-b.lastActionAt;b[kind==='tap'?'taps':kind==='hold'?'holds':'drags']++;b.objectVisits[id]=(b.objectVisits[id]||0)+1;if(b.objectVisits[id]>1){b.revisits++;this.addReading('returning',.7,`volvió a ${id}`)}if(elapsed<800)this.addReading('quick',.45,'acciones seguidas');if(kind==='hold')this.addReading('careful',.8,`sostuvo ${id}`);if(kind==='drag')this.addReading('listening',.75,`manipuló ${id}`);if(b.objectVisits[id]>2)this.addReading('insistent',.65,`insistió sobre ${id}`);b.lastActionAt=Date.now();this.save();}
 discover(...ids:string[]){ids.forEach(id=>{if(!this.state.knowledge.includes(id)){this.state.knowledge.push(id);this.state.pendingNotes.push(id);}});this.state.hypotheses=deriveHypotheses(this.state);this.save();}
 relate(a:string,b:string){const pair=[a,b].sort().join('+');if(this.state.relations.includes(pair))return pair;this.state.relations.push(pair);const known:Record<string,string>= {'elvira-chair+elvira-food':'rel-chair-table','beto-camera+tape-origin':'rel-camera-tape','malena-note+radio-voices':'rel-malena-version','match-time+tape-origin':'rel-edited-time'};const discovery=known[pair];if(discovery)this.discover(discovery);else{const guess=`Tal vez ${a.replaceAll('-',' ')} explica ${b.replaceAll('-',' ')}.`;if(!this.state.hypotheses.includes(guess))this.state.hypotheses.push(guess);}this.save();return pair;}
 consumePending(){this.state.pendingNotes=[];this.save();}
 change(id:string){if(!this.state.worldChanges.includes(id))this.state.worldChanges.push(id);this.save();}
 visit(scene:Scene){this.state.behavior.sceneVisits[scene]++;this.save();}
 hide(){this.state.behavior.hidden++;this.state.pendingNotes.push('return-line');this.addReading('resistant',.4,'interrumpió la sesión');this.save();}
 setDramaticState(v:SessionState['dramaticState']){this.state.dramaticState=v;this.save();}
 get(){return this.state} has(id:string){return this.state.knowledge.includes(id)||Boolean(this.state.behavior.objectVisits[id])} count(id:string){return this.state.behavior.objectVisits[id]||0}
 dominant():Hypothesis{const scores=new Map<Hypothesis,number>();this.state.readings.forEach(r=>scores.set(r.hypothesis,(scores.get(r.hypothesis)||0)+r.confidence));return[...scores.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'exploring'}
 private addReading(h:Hypothesis,c:number,e:string){this.state.readings.push({hypothesis:h,confidence:c,evidence:e})}
 private save(){try{sessionStorage.setItem(KEY,JSON.stringify(this.state))}catch{}}
}
