'use client';

import { buildNotebook } from '../el-origen/notebook';
import { GameState } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type NotebookPanelProps = {
  state: GameState;
  onClose: () => void;
};

export default function NotebookPanel({ state, onClose }: NotebookPanelProps) {
  const notebook = buildNotebook(state);

  return (
    <aside className={styles.notebook} aria-label="libreta azul">
      <button className={styles.closePaper} onClick={onClose} type="button">cerrar</button>
      <p className={styles.paperKicker}>libreta azul</p>
      <h2>{notebook.heading}</h2>
      <p className={styles.hand}>{notebook.hand}</p>

      <section className={styles.paperSection}>
        {notebook.lines.map((line) => (
          <p className={line.struck ? styles.struckLine : ''} key={line.id}>{line.text}</p>
        ))}
      </section>

      {notebook.mutations.length > 0 && (
        <section className={styles.paperSection}>
          <h3>marcas nuevas</h3>
          {notebook.mutations.map((line) => <p className={styles.marginNote} key={line}>{line}</p>)}
        </section>
      )}

      {notebook.sections.map((section) => (
        <section className={styles.paperSection} key={section.kind}>
          <h3>{section.title}</h3>
          {section.lines.map((line) => <p key={line}>{line}</p>)}
        </section>
      ))}
    </aside>
  );
}
