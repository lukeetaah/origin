'use client';
import { useState } from 'react';
import { visibleNotes } from '../engine/knowledge';
import { SessionState } from '../engine/types';
import styles from '../styles/notebook.module.css';
import tabStyles from '../styles/notebookTab.module.css';
export default function Notebook({state,onClose,onRelate,onRead}:{state:SessionState;onClose:()=>void;onRelate:(a:string,b:string)=>void;onRead:()=>void}){
 const [selected,setSelected]=useState<string[]>([]);const entries=visibleNotes(state);
 const choose=(id:string)=>{const next=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id].slice(-2);setSelected(next);if(next.length===2){onRelate(next[0],next[1]);setSelected([])}};
 return <aside className={styles.book} aria-label="Libreta" onAnimationEnd={onRead}><button className={styles.close} onClick={onClose} aria-label="Cerrar libreta">cerrar la tapa</button><div className={styles.paper}><header><small>CASA DE ELVIRA Y BETO</small><h2>lo que creo recordar</h2></header><div className={styles.entries}>{entries.map((n,i)=><button key={n.id} className={`${styles.note} ${selected.includes(n.id)?styles.selected:''}`} onClick={()=>choose(n.id)} style={{'--delay':`${i*.06}s`} as React.CSSProperties}><em>{n.kind}</em><strong>{n.title}</strong>{n.history.map((h,j)=><del key={j}>{h.text}</del>)}<span>{n.current.strike&&<del>{n.current.strike}</del>} {n.current.text}</span>{n.doodle&&<b>{n.doodle}</b>}</button>)}</div>{state.hypotheses.length>0&&<footer>{state.hypotheses.slice(-3).map(h=><p key={h}>¿ {h}</p>)}</footer>}<p className={styles.hint}>Dos anotaciones sostenidas juntas dejan una relación, aunque sea equivocada.</p></div></aside>
}
export function NotebookTab({pending,onOpen}:{pending:number;onOpen:()=>void}){return <button className={tabStyles.tab} onClick={onOpen} aria-label="Abrir libreta"><span>papel</span>{pending>0&&<i />}</button>}
