import type { Point } from "./map/projection";

/** 走行時間 (ms) の下限・上限 */
export const MIN_RUN_MS = 3000;
export const MAX_RUN_MS = 6000;
/** SVG 座標 1 あたりの走行時間。東京→博多 (≒900) で 5 秒強 */
const MS_PER_UNIT = 6;

/** 走行中の位置と、イラストの向き (イラストは左向きが基準) */
export interface RunPosition extends Point {
  facing: "left" | "right";
}

/** requestAnimationFrame の差し替え口 (テスト用) */
export interface FrameScheduler {
  now(): number;
  requestFrame(cb: (time: number) => void): number;
  cancelFrame(id: number): void;
}

export interface RunOptions {
  points: readonly Point[];
  duration: number;
  onFrame(pos: RunPosition): void;
  onArrive(): void;
  scheduler?: FrameScheduler;
}

const browserScheduler: FrameScheduler = {
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
};

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function totalLength(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += distance(points[i - 1], points[i]);
  return sum;
}

/** 折れ線 points 上で、全長に対する割合 t (0〜1) の位置 */
export function pointAlong(points: readonly Point[], t: number): RunPosition {
  let facing: RunPosition["facing"] = "left";
  if (points.length === 0) return { x: 0, y: 0, facing };

  let remaining = Math.min(Math.max(t, 0), 1) * totalLength(points);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.x !== a.x) facing = b.x > a.x ? "right" : "left";
    const len = distance(a, b);
    if (remaining <= len && len > 0) {
      const r = remaining / len;
      return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r, facing };
    }
    remaining -= len;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, facing };
}

/** 経路の長さに応じた走行時間 (MIN_RUN_MS〜MAX_RUN_MS) */
export function runDuration(points: readonly Point[]): number {
  return Math.min(Math.max(totalLength(points) * MS_PER_UNIT, MIN_RUN_MS), MAX_RUN_MS);
}

const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/** points に沿って走らせる。戻り値を呼ぶと中断 (onArrive は呼ばれない) */
export function startRun({ points, duration, onFrame, onArrive, scheduler = browserScheduler }: RunOptions): () => void {
  const start = scheduler.now();
  let frameId: number | null = null;

  const tick = (time: number) => {
    const t = Math.min((time - start) / duration, 1);
    onFrame(pointAlong(points, easeInOut(t)));
    if (t < 1) {
      frameId = scheduler.requestFrame(tick);
    } else {
      frameId = null;
      onArrive();
    }
  };
  frameId = scheduler.requestFrame(tick);

  return () => {
    if (frameId !== null) scheduler.cancelFrame(frameId);
    frameId = null;
  };
}
