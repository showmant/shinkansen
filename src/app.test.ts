// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrameScheduler } from "./animation";
import { createApp, reduceSelection, type App, type Selection } from "./app";

describe("reduceSelection", () => {
  const none: Selection = { kind: "none" };

  it("カード選択 → 別カード選択 → 同じカードで解除", () => {
    const a = reduceSelection(none, { type: "selectTrain", trainId: "nozomi" });
    expect(a).toEqual({ kind: "train", trainId: "nozomi" });
    const b = reduceSelection(a, { type: "selectTrain", trainId: "toki" });
    expect(b).toEqual({ kind: "train", trainId: "toki" });
    expect(reduceSelection(b, { type: "selectTrain", trainId: "toki" })).toEqual(none);
  });

  it("路線選択は列車選択を置き換え、同じ路線で解除", () => {
    const train: Selection = { kind: "train", trainId: "nozomi" };
    const line = reduceSelection(train, { type: "selectLine", lineId: "tohoku" });
    expect(line).toEqual({ kind: "line", lineId: "tohoku" });
    expect(reduceSelection(line, { type: "selectLine", lineId: "joetsu" })).toEqual({ kind: "line", lineId: "joetsu" });
    expect(reduceSelection(line, { type: "selectLine", lineId: "tohoku" })).toEqual(none);
  });

  it("clear はどの状態からも未選択に戻す", () => {
    expect(reduceSelection({ kind: "train", trainId: "nozomi" }, { type: "clear" })).toEqual(none);
    expect(reduceSelection({ kind: "line", lineId: "tohoku" }, { type: "clear" })).toEqual(none);
    expect(reduceSelection(none, { type: "clear" })).toEqual(none);
  });
});

describe("createApp", () => {
  let root: HTMLElement;
  let app: App;
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
  /** 走行完了まで十分に時間を進める */
  const runToEnd = () => {
    for (let i = 0; i < 100 && pending.size > 0; i++) {
      time += 100;
      const cbs = [...pending.values()];
      pending.clear();
      cbs.forEach((cb) => cb(time));
    }
  };

  const $ = <E extends Element>(selector: string): E => {
    const el = root.querySelector<E>(selector);
    if (!el) throw new Error(`not found: ${selector}`);
    return el;
  };
  const card = (id: string) => $<HTMLButtonElement>(`.train-card[data-train-id="${id}"]`);
  const lineGroup = (id: string) => $<SVGGElement>(`.map-line[data-line-id="${id}"]`);
  const clickLine = (id: string) =>
    lineGroup(id).querySelector(".map-line-hit")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const clickSea = () => $(".map-sea").dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const runner = () => $<SVGGElement>(".map-runner");
  const routeSegments = () =>
    [...root.querySelectorAll<SVGPolylineElement>(".map-route-segment")].map((el) => ({
      lineId: el.dataset.lineId,
      stationIds: el.dataset.stationIds?.split(" ") ?? [],
    }));
  const stationDimmed = (id: string) => $(`.map-station[data-station-id="${id}"]`).classList.contains("is-dimmed");

  beforeEach(() => {
    time = 0;
    pending.clear();
    root = document.createElement("div");
    document.body.append(root);
    app = createApp(root, { scheduler });
  });

  afterEach(() => {
    app.destroy();
    root.remove();
  });

  it("最初は何も選ばれておらず、走る車両は出ていない", () => {
    expect(root.querySelectorAll(".is-dimmed, .is-selected")).toHaveLength(0);
    expect(runner().classList.contains("is-hidden")).toBe(true);
    expect($(".train-info").textContent).toContain("えらんでね");
  });

  it("カードクリックで路線が光り、情報が出て、車両が走り出し、着くと跳ねる", () => {
    const onStart = vi.fn();
    const onArrive = vi.fn();
    app.onTrainStart(onStart);
    app.onTrainArrive(onArrive);

    card("hayabusa").click();
    expect(routeSegments().map((s) => s.lineId)).toEqual(["tohoku", "hokkaido"]);
    expect(card("hayabusa").classList.contains("is-selected")).toBe(true);
    expect($(".train-info__title").textContent).toBe("はやぶさ / とうきょう → しんはこだてほくと");
    expect($(".train-info__fact").textContent).toContain("ほっかいどう");
    expect($(".train-info__illustration svg")).not.toBeNull();
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: "hayabusa" }));
    expect(runner().classList.contains("is-hidden")).toBe(false);
    expect(runner().querySelector("svg")).not.toBeNull();

    runToEnd();
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith(expect.objectContaining({ id: "hayabusa" }));
    expect(runner().classList.contains("is-arrived")).toBe(true);
  });

  it("選択時は路線全体ではなく実際の走行区間だけを光らせる (とき: 東北は大宮まで)", () => {
    card("toki").click();
    expect(routeSegments()).toEqual([
      { lineId: "tohoku", stationIds: ["tokyo", "ueno", "omiya"] },
      { lineId: "joetsu", stationIds: ["omiya", "takasaki", "echigo-yuzawa", "nagaoka", "niigata"] },
    ]);
    expect(root.querySelectorAll(".map-line:not(.is-dimmed)")).toHaveLength(0);
    expect(stationDimmed("omiya")).toBe(false);
    expect(stationDimmed("sendai")).toBe(true);
    expect(stationDimmed("shin-aomori")).toBe(true);
  });

  it("路線をまたいで他路線を経由する区間も光る (かがやき: 大宮→高崎)", () => {
    card("kagayaki").click();
    expect(routeSegments().map((s) => s.lineId)).toEqual(["tohoku", "joetsu", "hokuriku"]);
    expect(routeSegments()[1].stationIds).toEqual(["omiya", "takasaki"]);
    expect(stationDimmed("takasaki")).toBe(false);
    expect(stationDimmed("niigata")).toBe(true);
  });

  it("別カードに切り替えると走行区間も置き換わり、解除で消える", () => {
    card("toki").click();
    card("nozomi").click();
    expect(routeSegments().map((s) => s.lineId)).toEqual(["tokaido", "sanyo"]);
    card("nozomi").click();
    expect(routeSegments()).toHaveLength(0);
    expect(root.querySelectorAll(".is-dimmed")).toHaveLength(0);
  });

  it("走行中に別カードを押すと前の走行は中断され、新しい方だけ到着する", () => {
    const onArrive = vi.fn();
    app.onTrainArrive(onArrive);
    card("nozomi").click();
    time += 500;
    card("komachi").click();
    card("toki").click();
    runToEnd();
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith(expect.objectContaining({ id: "toki" }));
    expect(root.querySelectorAll(".is-selected")).toHaveLength(1);
    expect(root.querySelectorAll(".map-runner")).toHaveLength(1);
  });

  it("同じカードをもう一度押すと選択解除して全路線表示に戻る", () => {
    card("nozomi").click();
    card("nozomi").click();
    expect(root.querySelectorAll(".is-dimmed, .is-selected")).toHaveLength(0);
    expect(runner().classList.contains("is-hidden")).toBe(true);
    expect(pending.size).toBe(0);
  });

  it("路線クリックでその路線を走る車両カードが強調される", () => {
    const onLine = vi.fn();
    app.onLineSelect(onLine);
    card("nozomi").click();
    clickLine("yamagata");
    expect(routeSegments()).toHaveLength(0);
    expect(lineGroup("yamagata").classList.contains("is-dimmed")).toBe(false);
    expect(onLine).toHaveBeenCalledWith(expect.objectContaining({ id: "yamagata" }));
    expect(card("tsubasa").classList.contains("is-emphasized")).toBe(true);
    expect(card("nozomi").classList.contains("is-dimmed")).toBe(true);
    expect(root.querySelectorAll(".is-selected")).toHaveLength(0);
    expect(lineGroup("tokaido").classList.contains("is-dimmed")).toBe(true);
    expect(runner().classList.contains("is-hidden")).toBe(true);
    expect($(".train-info").textContent).toContain("やまがたしんかんせん");
  });

  it("地図の余白クリックで選択解除", () => {
    clickLine("tohoku");
    clickSea();
    expect(root.querySelectorAll(".is-dimmed, .is-emphasized, .is-selected")).toHaveLength(0);

    card("kamome").click();
    clickSea();
    expect(root.querySelectorAll(".is-dimmed, .is-selected")).toHaveLength(0);
    expect(runner().classList.contains("is-hidden")).toBe(true);
  });

  it("イベント購読は解除できる", () => {
    const onStart = vi.fn();
    app.onTrainStart(onStart)();
    card("nozomi").click();
    expect(onStart).not.toHaveBeenCalled();
  });
});
