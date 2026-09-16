import { describe, expect, it, vi } from "vitest";
import { createEffects, type AudioContextLike } from "./effects";

/** Web Audio API の最小モック */
function fakeContext() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const ctx = {
    currentTime: 0,
    state: "suspended" as AudioContextState,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createOscillator: vi.fn(() => {
      const osc = {
        type: "sine",
        frequency: param(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })),
  };
  return { ctx: ctx as unknown as AudioContextLike, raw: ctx, oscillators };
}

describe("createEffects", () => {
  it("AudioContext は最初に音を出すときまで作らない", () => {
    const factory = vi.fn(() => fakeContext().ctx);
    createEffects({ createContext: factory, isMuted: () => false });
    expect(factory).not.toHaveBeenCalled();
  });

  it("unlock で AudioContext を作って resume する (自動再生制限対策)", () => {
    const { ctx, raw } = fakeContext();
    const effects = createEffects({ createContext: () => ctx, isMuted: () => false });
    effects.unlock();
    expect(raw.resume).toHaveBeenCalled();
  });

  it("チャイム・到着音はオシレーターを鳴らす", () => {
    const { ctx, oscillators } = fakeContext();
    const effects = createEffects({ createContext: () => ctx, isMuted: () => false });
    effects.chime();
    const afterChime = oscillators.length;
    expect(afterChime).toBeGreaterThan(0);
    effects.arrive();
    expect(oscillators.length).toBeGreaterThan(afterChime);
    oscillators.forEach((o) => expect(o.start).toHaveBeenCalled());
  });

  it("モーター音は開始して、止めるとフェードアウト後に停止する", () => {
    const { ctx, oscillators } = fakeContext();
    const effects = createEffects({ createContext: () => ctx, isMuted: () => false });
    effects.startMotor();
    expect(oscillators.length).toBeGreaterThan(0);
    oscillators.forEach((o) => expect(o.stop).not.toHaveBeenCalled());
    effects.stopMotor();
    oscillators.forEach((o) => expect(o.stop).toHaveBeenCalled());
  });

  it("モーター音を二重に開始しても前のものを止める", () => {
    const { ctx, oscillators } = fakeContext();
    const effects = createEffects({ createContext: () => ctx, isMuted: () => false });
    effects.startMotor();
    const first = [...oscillators];
    effects.startMotor();
    first.forEach((o) => expect(o.stop).toHaveBeenCalled());
  });

  it("ミュート中は何も鳴らさない", () => {
    const factory = vi.fn(() => fakeContext().ctx);
    const effects = createEffects({ createContext: factory, isMuted: () => true });
    effects.chime();
    effects.startMotor();
    effects.arrive();
    expect(factory).not.toHaveBeenCalled();
  });

  it("Web Audio API 非対応でもエラーにならない", () => {
    const effects = createEffects({ createContext: () => null, isMuted: () => false });
    expect(() => {
      effects.unlock();
      effects.chime();
      effects.startMotor();
      effects.stopMotor();
      effects.arrive();
      effects.stopAll();
    }).not.toThrow();
  });

  it("AudioContext 生成が例外を投げてもエラーにならない", () => {
    const effects = createEffects({
      createContext: () => {
        throw new Error("boom");
      },
      isMuted: () => false,
    });
    expect(() => effects.chime()).not.toThrow();
  });
});
