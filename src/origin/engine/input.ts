import { PointerEvent } from 'react';
import { Region } from './scenes';

export type Gesture = 'tap' | 'hold' | 'drag';

export type InputSnapshot = {
  activeId: string | null;
  holdProgress: number;
  pointer: { x: number; y: number } | null;
};

export type InputController = {
  snapshot: InputSnapshot;
  bind: (region: Region) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
  };
  cancel: () => void;
};

type Active = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  region: Region;
  mode: 'pressing' | 'holding' | 'dragging' | 'done' | 'cancelled';
  timer: number | null;
  progressTimer: number | null;
  startedAt: number;
};

export const createInputHandlers = (
  active: Active | null,
  setActive: (active: Active | null) => void,
  snapshot: InputSnapshot,
  setSnapshot: (snapshot: InputSnapshot) => void,
  sceneRect: () => DOMRect | null,
  onGesture: (region: Region, gesture: Gesture) => void,
): InputController => {
  const cancelTimers = (target: Active | null) => {
    if (target?.timer) window.clearTimeout(target.timer);
    if (target?.progressTimer) window.clearInterval(target.progressTimer);
  };

  const cancel = () => {
    cancelTimers(active);
    setActive(null);
    setSnapshot({ ...snapshot, activeId: null, holdProgress: 0 });
  };

  const updatePointer = (clientX: number, clientY: number) => {
    const rect = sceneRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1000, ((clientX - rect.left) / rect.width) * 1000));
    const y = Math.max(0, Math.min(1000, ((clientY - rect.top) / rect.height) * 1000));
    setSnapshot({ ...snapshot, pointer: { x, y } });
  };

  return {
    snapshot,
    cancel,
    bind: (region: Region) => ({
      onPointerDown: event => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        cancelTimers(active);
        updatePointer(event.clientX, event.clientY);
        const next: Active = {
          id: region.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          region,
          mode: 'pressing',
          timer: null,
          progressTimer: null,
          startedAt: performance.now(),
        };
        if (region.kind === 'hold') {
          next.progressTimer = window.setInterval(() => {
            const progress = Math.min(1, (performance.now() - next.startedAt) / 850);
            setSnapshot({ activeId: region.id, holdProgress: progress, pointer: snapshot.pointer });
          }, 40);
          next.timer = window.setTimeout(() => {
            if (next.mode !== 'pressing') return;
            next.mode = 'done';
            cancelTimers(next);
            setActive(null);
            setSnapshot({ activeId: null, holdProgress: 0, pointer: snapshot.pointer });
            onGesture(region, 'hold');
          }, 850);
        }
        setActive(next);
        setSnapshot({ ...snapshot, activeId: region.id, holdProgress: 0 });
      },
      onPointerMove: event => {
        updatePointer(event.clientX, event.clientY);
        if (!active || active.id !== region.id || active.mode === 'done') return;
        const moved = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
        if (active.region.kind === 'hold' && moved > 18) {
          active.mode = 'cancelled';
          cancelTimers(active);
          setActive(null);
          setSnapshot({ ...snapshot, activeId: null, holdProgress: 0 });
          return;
        }
        if (active.region.kind === 'drag' && moved > 26) {
          active.mode = 'done';
          cancelTimers(active);
          setActive(null);
          setSnapshot({ ...snapshot, activeId: null, holdProgress: 0 });
          onGesture(region, 'drag');
        }
      },
      onPointerUp: event => {
        updatePointer(event.clientX, event.clientY);
        if (!active || active.id !== region.id) return;
        const mode = active.mode;
        cancelTimers(active);
        setActive(null);
        setSnapshot({ ...snapshot, activeId: null, holdProgress: 0 });
        if (mode === 'pressing' && region.kind !== 'hold' && region.kind !== 'drag') onGesture(region, 'tap');
      },
      onPointerCancel: cancel,
      onPointerLeave: () => {
        if (active?.id === region.id && region.kind === 'hold') cancel();
      },
    }),
  };
};
