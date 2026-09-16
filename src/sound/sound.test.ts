import { describe, expect, it, vi } from "vitest";
import { lines } from "../data/lines";
import { trains } from "../data/trains";
import type { Line, Train } from "../data/types";
import type { Effects } from "./effects";
import { connectSound, type SoundEvents } from "./sound";
import type { Speaker } from "./speech";

function fakeEvents() {
  const handlers = {
    start: [] as ((t: Train) => void)[],
    arrive: [] as ((t: Train) => void)[],
    line: [] as ((l: Line) => void)[],
    stop: [] as (() => void)[],
  };
  const sub =
    <T>(list: T[]) =>
    (cb: T) => {
      list.push(cb);
      return () => list.splice(list.indexOf(cb), 1);
    };
  const events: SoundEvents = {
    onTrainStart: sub(handlers.start),
    onTrainArrive: sub(handlers.arrive),
    onLineSelect: sub(handlers.line),
    onRunStop: sub(handlers.stop),
  };
  return { events, handlers };
}

const fakeSpeaker = () => ({ speak: vi.fn(), cancel: vi.fn() }) satisfies Speaker;
const fakeEffects = () =>
  ({
    unlock: vi.fn(),
    chime: vi.fn(),
    startMotor: vi.fn(),
    stopMotor: vi.fn(),
    arrive: vi.fn(),
    stopAll: vi.fn(),
  }) satisfies Effects;

const hayabusa = trains.find((t) => t.id === "hayabusa") as Train;
const tokaido = lines.find((l) => l.id === "tokaido") as Line;

describe("connectSound", () => {
  it("発車でチャイム・モーター音・愛称の読み上げ", () => {
    const { events, handlers } = fakeEvents();
    const speaker = fakeSpeaker();
    const effects = fakeEffects();
    connectSound(events, { speaker, effects });
    handlers.start.forEach((cb) => cb(hayabusa));
    expect(effects.chime).toHaveBeenCalled();
    expect(effects.startMotor).toHaveBeenCalled();
    expect(speaker.speak).toHaveBeenCalledWith(expect.stringContaining("しんはこだてほくと"));
  });

  it("到着でモーター停止・ポーン音・fact の読み上げ", () => {
    const { events, handlers } = fakeEvents();
    const speaker = fakeSpeaker();
    const effects = fakeEffects();
    connectSound(events, { speaker, effects });
    handlers.arrive.forEach((cb) => cb(hayabusa));
    expect(effects.stopMotor).toHaveBeenCalled();
    expect(effects.arrive).toHaveBeenCalled();
    expect(speaker.speak).toHaveBeenCalledWith(expect.stringContaining(hayabusa.fact));
  });

  it("路線クリックで路線名を読む", () => {
    const { events, handlers } = fakeEvents();
    const speaker = fakeSpeaker();
    const effects = fakeEffects();
    connectSound(events, { speaker, effects });
    handlers.line.forEach((cb) => cb(tokaido));
    expect(speaker.speak).toHaveBeenCalledWith("とうかいどう しんかんせん");
  });

  it("走行中断でモーター音と読み上げを止める", () => {
    const { events, handlers } = fakeEvents();
    const speaker = fakeSpeaker();
    const effects = fakeEffects();
    connectSound(events, { speaker, effects });
    handlers.stop.forEach((cb) => cb());
    expect(effects.stopMotor).toHaveBeenCalled();
    expect(speaker.cancel).toHaveBeenCalled();
  });

  it("解除すると反応しなくなる", () => {
    const { events, handlers } = fakeEvents();
    const speaker = fakeSpeaker();
    const effects = fakeEffects();
    connectSound(events, { speaker, effects })();
    expect(handlers.start).toHaveLength(0);
    expect(handlers.arrive).toHaveLength(0);
    expect(handlers.line).toHaveLength(0);
    expect(handlers.stop).toHaveLength(0);
  });
});
