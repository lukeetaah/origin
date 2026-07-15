'use client';

import { type CSSProperties, type MouseEvent, useEffect, useMemo, useState } from 'react';
import { GameState, InspectableObject, InspectionClue, InspectionClueId, InspectionSide } from '../el-origen/types';
import styles from '../styles/elOrigen.module.css';

type InspectionViewerProps = {
  object: InspectableObject;
  state: GameState;
  onClose: () => void;
  onDiscover: (objectId: string, clueId: InspectionClueId) => void;
};

type LightZone = NonNullable<InspectionClue['lightZone']>;
type ProbeStatus = 'texture' | 'blocked' | 'needs-light' | 'ready' | 'found';
type InspectionProbe = {
  id: string;
  label: string;
  x: string;
  y: string;
  clue?: InspectionClue;
  fallback: string;
};

const sideOrder: InspectionSide[] = ['front', 'back', 'left', 'right', 'top', 'base', 'inside'];
const sideLabels: Record<InspectionSide, string> = {
  front: 'frente',
  back: 'dorso',
  left: 'izquierda',
  right: 'derecha',
  top: 'arriba',
  base: 'base',
  inside: 'interior',
};
const lightLabels: Record<LightZone, string> = {
  left: 'izquierda',
  center: 'centro',
  right: 'derecha',
  top: 'arriba',
  bottom: 'abajo',
};
const lightPoints: Record<LightZone, { x: string; y: string }> = {
  left: { x: '24%', y: '48%' },
  center: { x: '50%', y: '46%' },
  right: { x: '76%', y: '48%' },
  top: { x: '50%', y: '18%' },
  bottom: { x: '50%', y: '78%' },
};

export default function InspectionViewer({ object, state, onClose, onDiscover }: InspectionViewerProps) {
  const rememberedOpen = Boolean(state.objectStates[object.objectId]?.open);
  const [side, setSide] = useState<InspectionSide>(() => visibleSidesFor(object, rememberedOpen)[0] ?? 'front');
  const [lightZone, setLightZone] = useState<LightZone>('center');
  const [open, setOpen] = useState(rememberedOpen);
  const [flash, setFlash] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(object.initialObservation);
  const [touchedProbe, setTouchedProbe] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([openingLogFor(object)]);

  const discovered = useMemo(
    () => state.objectStates[object.objectId]?.discoveredClues ?? [],
    [object.objectId, state.objectStates],
  );
  const visibleClues = useMemo(
    () => object.clues.filter((clue) => discovered.includes(clue.id)),
    [discovered, object.clues],
  );
  const latestClue = visibleClues.at(-1);
  const pendingClue = object.clues.find((clue) => !discovered.includes(clue.id));
  const allSides = useMemo(() => sidesFor(object), [object]);
  const availableSides = useMemo(() => visibleSidesFor(object, open), [object, open]);
  const probes = useMemo(() => probesFor(object, side), [object, side]);
  const readyProbe = probes.find((probe) => probe.clue && probeStatus(probe, discovered, open, lightZone) === 'ready');
  const relevantClue = readyProbe?.clue ?? object.clues.find((clue) => !discovered.includes(clue.id) && clue.side === side) ?? pendingClue;
  const lightPoint = lightPoints[lightZone];
  const reading = readingFor(object, relevantClue, side, lightZone, open, discovered);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const close = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    onClose();
  };

  const writeLog = (entry: string) => {
    setLog((items) => [entry, ...items.filter((item) => item !== entry)].slice(0, 4));
  };

  const changeSide = (candidate: InspectionSide) => {
    if (candidate === 'inside' && !open && object.clues.some((clue) => clue.side === 'inside' && clue.requiresOpen)) {
      setFeedback('Primero abrí el expediente. El interior no es una vista: es el contenido.');
      writeLog('Intentaste leer el interior, pero la carpeta seguía cerrada.');
      return;
    }
    setSide(candidate);
    const next = describeSide(object, candidate, open, discovered);
    setFeedback(next);
    writeLog(`Giraste el objeto: ${sideLabels[candidate]}.`);
    setTouchedProbe(null);
  };

  const moveLight = (candidate: LightZone) => {
    setLightZone(candidate);
    setFeedback(describeLight(object, side, candidate, open, discovered));
    writeLog(`Moviste la linterna hacia ${lightLabels[candidate]}.`);
  };

  const toggleOpen = () => {
    const nextOpen = !open;
    const nextSide = nextOpen && allSides.includes('inside') ? 'inside' : side === 'inside' ? 'front' : side;
    setOpen(nextOpen);
    setSide(nextSide);
    setFeedback(nextOpen ? openTextFor(object) : 'Cerraste el objeto. Los pliegues vuelven a tapar parte de la lectura.');
    writeLog(nextOpen ? (object.canDisassemble ? 'Desarmaste la pieza sin romperla.' : 'Abriste el objeto.') : 'Cerraste el objeto.');
    setTouchedProbe(null);
  };

  const inspectProbe = (probe: InspectionProbe) => {
    setTouchedProbe(probe.id);
    writeLog(`Tocaste: ${probe.label}.`);
    if (!probe.clue) {
      setFeedback(probe.fallback);
      return;
    }

    const status = probeStatus(probe, discovered, open, lightZone);
    if (status === 'found') {
      setFeedback(`${probe.clue.title}: ${probe.clue.fact}`);
      return;
    }
    if (status === 'blocked') {
      setFeedback('Se siente una marca, pero queda atrapada. Abrí o desarmá el objeto antes de insistir.');
      return;
    }
    if (status === 'needs-light') {
      setFeedback(`La marca está, pero la sombra la mata. Mové la luz hacia ${lightLabels[probe.clue.lightZone ?? 'center']}.`);
      return;
    }

    setFeedback(probe.clue.reveal);
    setFlash(probe.clue.reveal);
    window.setTimeout(() => setFlash(null), 2200);
    onDiscover(object.objectId, probe.clue.id);
  };

  return (
    <section
      aria-label={`inspección de ${object.title}`}
      aria-modal="true"
      className={styles.inspectionOverlay}
      role="dialog"
      style={{ '--ix': lightPoint.x, '--iy': lightPoint.y } as CSSProperties}
    >
      <div className={styles.inspectionBackdrop} />
      <div className={styles.inspectionLight} />
      <button
        aria-label="Salir de la inspección"
        className={styles.closeInspection}
        onClick={close}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        salir
      </button>

      <div className={styles.inspectionLayout}>
        <aside className={styles.inspectionBrief}>
          <p className={styles.paperKicker}>objeto</p>
          <h2>{object.title}</h2>
          <p>{latestClue ? object.afterClueObservation : object.initialObservation}</p>
          <dl className={styles.inspectionStateGrid}>
            <div>
              <dt>vista</dt>
              <dd>{sideLabels[side]}</dd>
            </div>
            <div>
              <dt>luz</dt>
              <dd>{lightLabels[lightZone]}</dd>
            </div>
            <div>
              <dt>estado</dt>
              <dd>{open ? (object.canDisassemble ? 'desarmado' : 'abierto') : 'cerrado'}</dd>
            </div>
          </dl>
          <small>{object.instruction}</small>
        </aside>

        <main className={styles.inspectionStage} aria-live="polite">
          <div className={styles.workbenchRail}>
            <span>{sideLabels[side]}</span>
            <span>{readyProbe ? 'marca expuesta' : reading.kicker}</span>
          </div>
          <div
            aria-label={`${object.title}, vista ${sideLabels[side]}`}
            className={`${styles.inspectedObject} ${objectClass(object)}`}
            data-document={isDocumentaryObject(object) ? 'true' : 'false'}
            data-hot={readyProbe ? 'true' : 'false'}
            data-open={open ? 'true' : 'false'}
            data-side={side}
          >
            {artifactBody(object, latestClue, readyProbe?.clue, side, open)}
            <span className={styles.objectLightPatch} />
            <div className={styles.probeLayer} aria-label="zonas táctiles del objeto">
              {probes.map((probe) => {
                const status = probeStatus(probe, discovered, open, lightZone);
                return (
                  <button
                    aria-label={`Examinar ${probe.label}`}
                    className={styles.probeButton}
                    data-active={touchedProbe === probe.id ? 'true' : 'false'}
                    data-status={status}
                    key={probe.id}
                    onClick={() => inspectProbe(probe)}
                    style={{ '--px': probe.x, '--py': probe.y } as CSSProperties}
                    type="button"
                  >
                    <i />
                    <span>{status === 'found' && probe.clue ? probe.clue.title : probe.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className={styles.workbenchFeedback}>{feedback}</p>
          {flash && <p className={styles.clueFlash}>{flash}</p>}
        </main>

        <aside className={styles.cluePanel} data-ready={readyProbe ? 'true' : 'false'}>
          <p className={styles.paperKicker}>lectura</p>
          <article className={readyProbe ? styles.readyHint : styles.inspectionHint}>
            <strong>{reading.title}</strong>
            <p>{reading.body}</p>
          </article>
          {latestClue && (
            <article className={styles.inspectionEvidence}>
              <strong>{latestClue.title}</strong>
              <p>{latestClue.fact}</p>
              <em>{latestClue.question}</em>
            </article>
          )}
          {visibleClues.length > 1 && (
            <ol className={styles.foundClues}>
              {visibleClues.map((clue) => (
                <li key={clue.id}>{clue.title}</li>
              ))}
            </ol>
          )}
          <ol className={styles.inspectionLog}>
            {log.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ol>
        </aside>
      </div>

      <footer className={styles.inspectionControls} aria-label="controles de inspección">
        <div>
          <span>girar</span>
          {availableSides.map((candidate) => (
            <button
              aria-pressed={candidate === side}
              className={candidate === side ? styles.activeInspectionControl : undefined}
              key={candidate}
              onClick={() => changeSide(candidate)}
              type="button"
            >
              {sideLabels[candidate]}
            </button>
          ))}
        </div>
        <div>
          <span>enfocar</span>
          {(Object.keys(lightLabels) as LightZone[]).map((candidate) => (
            <button
              aria-pressed={candidate === lightZone}
              className={candidate === lightZone ? styles.activeInspectionControl : undefined}
              key={candidate}
              onClick={() => moveLight(candidate)}
              type="button"
            >
              {lightLabels[candidate]}
            </button>
          ))}
        </div>
        {(object.canOpen || object.canDisassemble) && (
          <button className={styles.inspectToggle} onClick={toggleOpen} type="button">
            {open ? 'cerrar' : object.canDisassemble ? 'desarmar' : object.model === 'folder' ? 'abrir expediente' : 'abrir'}
          </button>
        )}
        {readyProbe && (
          <button className={styles.inspectToggle} onClick={() => inspectProbe(readyProbe)} type="button">
            examinar marca
          </button>
        )}
        <span className={styles.inspectionProgress}>{visibleClues.length} de {object.clues.length} pistas</span>
      </footer>
    </section>
  );
}

function sidesFor(object: InspectableObject) {
  const sides = new Set<InspectionSide>(['front']);
  for (const clue of object.clues) sides.add(clue.side);
  if (object.model === 'keys' || object.model === 'sensor') sides.add('base');
  if (object.model === 'photo' || object.model === 'document') sides.add('back');
  return sideOrder.filter((side) => sides.has(side));
}

function visibleSidesFor(object: InspectableObject, open: boolean) {
  return sidesFor(object).filter((side) => {
    if (side !== 'inside') return true;
    const insideRequiresOpen = object.clues.some((clue) => clue.side === 'inside' && clue.requiresOpen);
    return open || !insideRequiresOpen;
  });
}

function openingLogFor(object: InspectableObject) {
  if (object.model === 'folder') return 'Expediente cerrado. Primero abrilo; después leé la línea marcada.';
  if (object.model === 'notebook') return 'Cuaderno cerrado. Abrí la tapa antes de confiar en el dorso.';
  return 'Objeto sobre la mesa. Buscá una marca que responda.';
}

function isDocumentaryObject(object: InspectableObject) {
  return object.model === 'folder' || object.model === 'notebook' || object.model === 'document' || object.model === 'photo';
}

function artifactBody(
  object: InspectableObject,
  latestClue: InspectionClue | undefined,
  readyClue: InspectionClue | undefined,
  side: InspectionSide,
  open: boolean,
) {
  if (object.model === 'folder') return folderArtifactBody(object, latestClue, readyClue, side, open);
  if (object.model === 'notebook') return notebookArtifactBody(object, latestClue, readyClue, side, open);
  return (
    <>
      <span className={styles.objectFold} />
      <span className={styles.objectSeal} />
      <span className={styles.objectMark}>{objectMark(object, latestClue, readyClue, side, open)}</span>
    </>
  );
}

function folderArtifactBody(
  object: InspectableObject,
  latestClue: InspectionClue | undefined,
  readyClue: InspectionClue | undefined,
  side: InspectionSide,
  open: boolean,
) {
  if (!open || side !== 'inside') {
    return (
      <div className={styles.folderCover}>
        <span>expediente</span>
        <strong>{object.title}</strong>
        <p>{object.objectId === 'kitchen-folder' ? 'tasación · recibos · borrador de venta' : 'plano · anexo · recorrido omitido'}</p>
        <em>{open ? 'interior disponible' : 'cerrado: abrir para leer'}</em>
      </div>
    );
  }

  const isKitchenFolder = object.objectId === 'kitchen-folder';
  const headline = readyClue?.title ?? latestClue?.title ?? (isKitchenFolder ? 'Fecha anterior' : 'Recorrido borrado');
  return (
    <div className={styles.folderEvidence}>
      <article className={styles.documentPage}>
        <span className={styles.documentKicker}>borrador de venta</span>
        <h3>{isKitchenFolder ? 'Oferta preparada antes del abandono' : 'Plano oficial incompleto'}</h3>
        <p className={styles.documentLine}>Fecha del documento: anterior al diagnóstico familiar.</p>
        <p className={styles.documentLine}>Condición escrita: sostener versión de abandono.</p>
        <p className={styles.documentLine}>Firma faltante: titular de la casa.</p>
      </article>
      <article className={styles.documentPage}>
        <span className={styles.documentKicker}>marca verificable</span>
        <h3>{headline}</h3>
        <p className={styles.documentLine}>
          {isKitchenFolder
            ? 'La oferta baja aparece antes de que la casa estuviera vacía.'
            : 'El recorrido de servicio fue borrado del plano entregado.'}
        </p>
        <p className={styles.documentLine}>La línea no pide fe: pide tocar el sello.</p>
        <strong className={readyClue ? styles.documentStampReady : styles.documentStamp}>SELLO DE FECHA</strong>
      </article>
    </div>
  );
}

function notebookArtifactBody(
  object: InspectableObject,
  latestClue: InspectionClue | undefined,
  readyClue: InspectionClue | undefined,
  side: InspectionSide,
  open: boolean,
) {
  if (!open || side !== 'inside') {
    return (
      <div className={styles.folderCover}>
        <span>cuaderno</span>
        <strong>{object.title}</strong>
        <p>tapa azul · tela tibia · borde gastado</p>
        <em>{open ? 'hojas disponibles' : 'cerrado: abrir para leer'}</em>
      </div>
    );
  }

  return (
    <div className={styles.folderEvidence}>
      <article className={styles.documentPage}>
        <span className={styles.documentKicker}>lista de acciones</span>
        <h3>{readyClue?.title ?? latestClue?.title ?? 'Método doméstico'}</h3>
        <p className={styles.documentLine}>Cortes de luz después de cada visita.</p>
        <p className={styles.documentLine}>Muebles corridos para fabricar duda.</p>
        <p className={styles.documentLine}>Golpes en pared cuando pedía ayuda.</p>
      </article>
      <article className={styles.documentPage}>
        <span className={styles.documentKicker}>nota de margen</span>
        <h3>No era memoria: era presión.</h3>
        <p className={styles.documentLine}>La casa fue usada como tablero.</p>
        <strong className={readyClue ? styles.documentStampReady : styles.documentStamp}>TOCAR LISTA</strong>
      </article>
    </div>
  );
}

function probesFor(object: InspectableObject, side: InspectionSide): InspectionProbe[] {
  const tactile = tactileProbes(object, side);
  const clueProbes = object.clues
    .filter((clue) => clue.side === side)
    .map((clue, index) => ({
      id: `clue-${clue.id}`,
      label: clueLabel(clue),
      ...probePoint(clue, index),
      clue,
      fallback: clue.reveal,
    }));
  return [...tactile, ...clueProbes];
}

function tactileProbes(object: InspectableObject, side: InspectionSide): InspectionProbe[] {
  const common = [
    probe('surface', 'textura', '31%', '42%', `La superficie confirma el material: ${materialText(object)}.`),
    probe('edge', 'borde', '70%', '70%', 'El borde tiene desgaste real; no es una pieza de utilería.'),
  ];
  if (side === 'back') {
    return [
      probe('reverse-stain', 'mancha', '36%', '34%', 'El reverso conserva grasa de dedos y una presión reciente.'),
      probe('reverse-corner', 'esquina', '72%', '24%', 'La esquina fue doblada muchas veces para obligar a mirar atrás.'),
    ];
  }
  if (side === 'inside') {
    return [
      probe('inner-fold', 'pliegue', '42%', '45%', 'El interior no está vacío: guarda marcas de uso, correcciones y apuro.'),
      probe('inner-margin', 'margen', '73%', '40%', 'El margen tiene notas cortadas por una mano que quiso cerrar rápido.'),
    ];
  }
  if (side === 'base') {
    return [
      probe('weight', 'peso', '38%', '57%', 'La base pesa más de lo que debería; algo quedó agregado después.'),
      probe('scratch', 'rayón', '67%', '43%', 'El rayón no es viejo: corta polvo fresco.'),
    ];
  }
  if (object.model === 'keys') {
    return [
      probe('key-ring', 'aro', '35%', '35%', 'El aro está deformado por una llave arrancada, no por uso común.'),
      probe('key-teeth', 'dientes', '68%', '58%', 'Los dientes están limpios: alguien separó la llave que importaba.'),
    ];
  }
  if (object.model === 'sensor') {
    return [
      probe('red-dot', 'punto rojo', '68%', '34%', 'El punto parpadea a destiempo con la casa.'),
      probe('tape', 'cinta', '32%', '72%', 'La cinta es nueva sobre caños viejos: lo instalaron para esta visita.'),
    ];
  }
  return common;
}

function probe(id: string, label: string, x: string, y: string, fallback: string): InspectionProbe {
  return { id, label, x, y, fallback };
}

function probePoint(clue: InspectionClue, index: number) {
  if (clue.requiresOpen && clue.side === 'inside') return { x: '76%', y: '74%' };
  if (clue.lightZone) return lightPoints[clue.lightZone];
  const points = [
    { x: '51%', y: '50%' },
    { x: '63%', y: '38%' },
    { x: '38%', y: '62%' },
  ];
  return points[index % points.length];
}

function clueLabel(clue: InspectionClue) {
  if (clue.requiresOpen) return 'marca interna';
  if (clue.requiresLight) return 'brillo oculto';
  if (clue.side === 'back') return 'nota al dorso';
  if (clue.side === 'base') return 'marca inferior';
  return 'detalle raro';
}

function probeStatus(probe: InspectionProbe, discovered: InspectionClueId[], open: boolean, lightZone: LightZone): ProbeStatus {
  if (!probe.clue) return 'texture';
  if (discovered.includes(probe.clue.id)) return 'found';
  if (probe.clue.requiresOpen && !open) return 'blocked';
  if (probe.clue.requiresLight && probe.clue.lightZone !== lightZone) return 'needs-light';
  return 'ready';
}

function readingFor(
  object: InspectableObject,
  clue: InspectionClue | undefined,
  side: InspectionSide,
  lightZone: LightZone,
  open: boolean,
  discovered: InspectionClueId[],
) {
  if (!clue) {
    return {
      kicker: 'sin pendientes',
      title: 'Objeto agotado',
      body: 'Ya levantaste las marcas útiles. Lo que queda es textura, peso y malestar.',
    };
  }
  if (discovered.includes(clue.id)) {
    return { kicker: 'pista fijada', title: clue.title, body: clue.fact };
  }
  if (clue.side === 'inside' && clue.requiresOpen && !open) {
    return {
      kicker: 'expediente cerrado',
      title: object.model === 'folder' ? 'Abrí el expediente' : 'Abrí el objeto',
      body: object.model === 'folder'
        ? 'La prueba no está en la tapa. Está en la fecha y el sello del interior.'
        : 'La marca está protegida por pliegues. Tocarla desde afuera no alcanza.',
    };
  }
  if (clue.side !== side) {
    return {
      kicker: 'vista incompleta',
      title: 'No estás mirando la cara correcta',
      body: `Giralo hacia ${sideLabels[clue.side]}. La pista no vive en esta superficie.`,
    };
  }
  if (clue.requiresOpen && !open) {
    return {
      kicker: 'mecanismo cerrado',
      title: object.canDisassemble ? 'Hay que desarmar sin romper' : 'Hay que abrir',
      body: 'La marca está protegida por pliegues. Tocarla desde afuera no alcanza.',
    };
  }
  if (clue.requiresLight && clue.lightZone !== lightZone) {
    return {
      kicker: 'sombra incorrecta',
      title: 'La linterna todavía no muerde la marca',
      body: `Mové el foco hacia ${lightLabels[clue.lightZone ?? 'center']} y tocá el brillo que aparezca.`,
    };
  }
  return {
    kicker: 'lista para tocar',
    title: 'La marca está expuesta',
    body: 'Ahora sí: tocá la zona iluminada o usá “examinar marca”.',
  };
}

function describeSide(object: InspectableObject, side: InspectionSide, open: boolean, discovered: InspectionClueId[]) {
  const clue = object.clues.find((candidate) => candidate.side === side && !discovered.includes(candidate.id));
  if (side === 'inside' && !open) return 'Se adivina interior, pero el objeto todavía está cerrado.';
  if (clue) return `La vista ${sideLabels[side]} tiene una irregularidad. Falta confirmar luz, apertura o tacto.`;
  if (side === 'back') return 'El dorso cambia el tono del papel: se ven dobleces, dedos y una presión antigua.';
  if (side === 'base') return 'La base no cuenta la misma historia que la cara visible.';
  if (side === 'inside') return 'El interior deja de parecer archivo y empieza a parecer método.';
  return `${object.title}: frente limpio, demasiado limpio.`;
}

function describeLight(
  object: InspectableObject,
  side: InspectionSide,
  lightZone: LightZone,
  open: boolean,
  discovered: InspectionClueId[],
) {
  const clue = object.clues.find((candidate) => candidate.side === side && !discovered.includes(candidate.id));
  if (!clue) return `La luz hacia ${lightLabels[lightZone]} revela textura, no una pista nueva.`;
  if (clue.requiresOpen && !open) return 'La luz golpea la tapa, pero la pista queda debajo.';
  if (!clue.requiresLight) return 'La luz no era la llave principal acá: probá tocar la marca.';
  if (clue.lightZone === lightZone) return 'El haz engancha una marca. Ahora tocala antes de mover la mano.';
  return `La sombra se come la marca. Probá enfocar ${lightLabels[clue.lightZone ?? 'center']}.`;
}

function openTextFor(object: InspectableObject) {
  if (object.canDisassemble) return 'La carcasa cede. Ya no estás mirando un objeto: estás mirando una intención.';
  if (object.model === 'notebook') return 'La tapa abre con resistencia, como si una página empujara desde adentro.';
  if (object.model === 'folder') return 'El pliegue abre y ordena las fechas de una forma demasiado conveniente.';
  return 'El objeto abre y deja ver el lado que alguien quiso que no mires.';
}

function objectClass(object: InspectableObject) {
  if (object.model === 'photo') return styles.photoArtifact;
  if (object.model === 'keys') return styles.keysArtifact;
  if (object.model === 'notebook') return styles.notebookArtifact;
  if (object.model === 'folder') return styles.folderArtifact;
  if (object.model === 'sensor') return styles.sensorArtifact;
  return styles.paperArtifact;
}

function objectMark(
  object: InspectableObject,
  latestClue: InspectionClue | undefined,
  readyClue: InspectionClue | undefined,
  side: InspectionSide,
  open: boolean,
) {
  if (readyClue) return 'marca viva';
  if (latestClue) return latestClue.title;
  if (open && side === 'inside') return 'interior abierto';
  if (side === 'back') return object.model === 'photo' ? 'fecha al dorso' : 'reverso';
  if (side === 'base') return 'base';
  if (object.model === 'keys') return 'llaves';
  if (object.model === 'sensor') return 'punto rojo';
  if (object.model === 'notebook') return 'azul';
  if (object.model === 'folder') return 'carpeta';
  return 'papel';
}

function materialText(object: InspectableObject) {
  if (object.material === 'paper') return 'papel con fibra levantada';
  if (object.material === 'cardboard') return 'cartón doblado y seco';
  if (object.material === 'metal') return 'metal frío con grasa de dedos';
  if (object.material === 'cloth') return 'tela tibia sobre tapa dura';
  if (object.material === 'plastic') return 'plástico nuevo sobre polvo viejo';
  if (object.material === 'glass') return 'vidrio con humedad en los bordes';
  if (object.material === 'ceramic') return 'cerámica reparada';
  return 'madera gastada';
}
