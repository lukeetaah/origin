'use client';

import { useEffect, useRef } from 'react';
import { GameState } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type NotebookPanelProps = {
  state: GameState;
  onClose: () => void;
};

export default function NotebookPanel({ state, onClose }: NotebookPanelProps) {
  const closeButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.notebookOverlay}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside aria-label="libreta azul" aria-modal="true" className={styles.notebook} role="dialog">
        <button className={styles.closePaper} onClick={onClose} ref={closeButton} type="button">cerrar</button>
        <p className={styles.paperKicker}>memoria auxiliar</p>
        <h2>Cuaderno azul</h2>
        <section className={styles.paperSection} aria-label="deducciones">
          {state.notebook.slice(-8).map((line) => (
            <p className={line.struck ? styles.struckLine : ''} key={line.id}>{line.text}</p>
          ))}
        </section>
      </aside>
    </div>
  );
}
