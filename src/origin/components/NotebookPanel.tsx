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
      <p className={styles.notebookSummary}>{notebook.summary}</p>
      <p className={styles.hand}>{notebook.hand}</p>

      {notebook.cards.length > 0 && (
        <section className={styles.evidenceGrid} aria-label="conexiones visuales">
          {notebook.cards.map((card) => (
            <article className={styles.evidenceCard} key={card.id}>
              <span>{card.kicker}</span>
              <p>{card.text}</p>
              <em>{card.question}</em>
            </article>
          ))}
        </section>
      )}

      {notebook.connections.length > 1 && (
        <section className={styles.clueMap} aria-label="mapa de pistas">
          {notebook.connections.map((node, index) => (
            <article data-linked={node.linksTo ? 'true' : 'false'} key={node.id}>
              <span>{index + 1}</span>
              <strong>{node.label}</strong>
              <p>{node.text}</p>
            </article>
          ))}
        </section>
      )}

      {notebook.mutations.length > 0 && (
        <section className={styles.paperSection}>
          <h3>marcas nuevas</h3>
          {notebook.mutations.map((line) => <p className={styles.marginNote} key={line}>{line}</p>)}
        </section>
      )}

      <details className={styles.archiveDetails}>
        <summary>archivo opcional</summary>
        <section className={styles.paperSection}>
          {notebook.lines.map((line) => (
            <p className={line.struck ? styles.struckLine : ''} key={line.id}>{line.text}</p>
          ))}
        </section>

        {notebook.sections.map((section) => (
          <section className={styles.paperSection} key={section.kind}>
            <h3>{section.title}</h3>
            {section.lines.map((line) => <p key={line}>{line}</p>)}
          </section>
        ))}
      </details>
    </aside>
  );
}
