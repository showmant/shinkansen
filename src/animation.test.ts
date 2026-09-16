import { describe, expect, it, vi } from "vitest";
import { MAX_RUN_MS, MIN_RUN_MS, pointAlong, runDuration, startRun, type FrameScheduler } from "./animation";

const L = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];

/** テスト用に手動で時間を進めるスケジューラ */
function fakeScheduler() {
  let time = 0;
  let seq = 0;
  const pending = new Map<number, (t: number) => void>();
  const scheduler: FrameScheduler = {
    now: () => time,
    requestFrame(cb) {
      pending.set(++seq, cb);
      return seq;
    },
    cancelFrame(id) {
      pending.delete(id);
    },
  };
  const advance = (ms: number) => {
    time += ms;
    const cbs = [...pending.values()];
    pending.clear();
    cbs.forEach((cb) => cb(time));
  };
  return { scheduler, advance, pendingCount: () => pending.size };
}

describe("pointAlong", () => {
  it("t=0 で始点、t=1 で終点", () => {
    expect(pointAlong(L, 0)).toMatchObject({ x: 0, y: 0 });
    expect(pointAlong(L, 1)).toMatchObject({ x: 100, y: 100 });
  });

  it("全長に対する割合で位置を決める (折れ線をまたぐ)", () => {
    expect(pointAlong(L, 0.25)).toMatchObject({ x: 50, y: 0 });
    expect(pointAlong(L, 0.75)).toMatchObject({ x: 100, y: 50 });
  });

  it("範囲外の t はクランプする", () => {
    expect(pointAlong(L, -1)).toMatchObject({ x: 0, y: 0 });
    expect(pointAlong(L, 2)).toMatchObject({ x: 100, y: 100 });
  });

  it("左向きに進む区間では facing が left、右向きなら right", () => {
    expect(pointAlong(L, 0.1).facing).toBe("right");
    const back = [...L].reverse();
    expect(pointAlong(back, 0.9).facing).toBe("left");
  });

  it("真下に進む区間では直前の左右の向きを保つ", () => {
    expect(pointAlong(L, 0.75).facing).toBe("right");
    expect(pointAlong([{ x: 0, y: 0 }, { x: 0, y: 10 }], 0.5).facing).toBe("left");
  });

  it("点が 1 つだけでも落ちない", () => {
    expect(pointAlong([{ x: 3, y: 4 }], 0.5)).toMatchObject({ x: 3, y: 4 });
  });
});

describe("runDuration", () => {
  it("短い経路でも最小時間、長い経路でも最大時間に収まる", () => {
    expect(runDuration([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(MIN_RUN_MS);
    expect(runDuration([{ x: 0, y: 0 }, { x: 100000, y: 0 }])).toBe(MAX_RUN_MS);
    expect(MIN_RUN_MS).toBeGreaterThanOrEqual(3000);
    expect(MAX_RUN_MS).toBeLessThanOrEqual(6000);
  });
});

describe("startRun", () => {
  it("フレームごとに位置を通知し、終点に着いたら onArrive を 1 回だけ呼ぶ", () => {
    const { scheduler, advance, pendingCount } = fakeScheduler();
    const onFrame = vi.fn();
    const onArrive = vi.fn();
    startRun({ points: L, duration: 1000, onFrame, onArrive, scheduler });

    advance(0);
    expect(onFrame).toHaveBeenLastCalledWith(expect.objectContaining({ x: 0, y: 0 }));
    advance(500);
    expect(onArrive).not.toHaveBeenCalled();
    advance(600);
    expect(onFrame).toHaveBeenLastCalledWith(expect.objectContaining({ x: 100, y: 100 }));
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(pendingCount()).toBe(0);
  });

  it("cancel すると以降のフレームも onArrive も呼ばれない", () => {
    const { scheduler, advance, pendingCount } = fakeScheduler();
    const onFrame = vi.fn();
    const onArrive = vi.fn();
    const cancel = startRun({ points: L, duration: 1000, onFrame, onArrive, scheduler });
    advance(100);
    const calls = onFrame.mock.calls.length;
    cancel();
    advance(2000);
    expect(onFrame).toHaveBeenCalledTimes(calls);
    expect(onArrive).not.toHaveBeenCalled();
    expect(pendingCount()).toBe(0);
  });
});
