// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trains } from "../data/trains";
import { emphasizeTrains, onTrainSelect, renderCards, setSelectedTrain } from "./cards";

let container: HTMLElement;
const cleanups: Array<() => void> = [];

function card(id: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(`[data-train-id="${id}"]`);
  if (!el) throw new Error(`card not found: ${id}`);
  return el;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  renderCards(container, trains);
});

afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  container.remove();
});

describe("renderCards", () => {
  it("全車両のカードを描画する", () => {
    expect(container.querySelectorAll(".train-card")).toHaveLength(trains.length);
  });

  it("イラスト・ひらがな愛称・形式名を表示する", () => {
    const el = card("hayabusa");
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.querySelector(".train-card__kana")?.textContent).toBe("はやぶさ");
    expect(el.querySelector(".train-card__series")?.textContent).toContain("E5系");
  });

  it("再描画しても重複しない", () => {
    renderCards(container, trains);
    expect(container.querySelectorAll(".train-card")).toHaveLength(trains.length);
  });
});

describe("選択", () => {
  it("クリックで onTrainSelect が発火し、選択状態になる", () => {
    const cb = vi.fn();
    cleanups.push(onTrainSelect(cb));
    card("komachi").click();
    expect(cb).toHaveBeenCalledWith("komachi");
    expect(card("komachi").classList.contains("is-selected")).toBe(true);
    expect(card("komachi").getAttribute("aria-pressed")).toBe("true");
  });

  it("解除したリスナーは呼ばれない", () => {
    const cb = vi.fn();
    onTrainSelect(cb)();
    card("komachi").click();
    expect(cb).not.toHaveBeenCalled();
  });

  it("setSelectedTrain で選択は 1 枚だけ、null で解除", () => {
    setSelectedTrain("nozomi");
    setSelectedTrain("toki");
    expect(container.querySelectorAll(".is-selected")).toHaveLength(1);
    expect(card("toki").classList.contains("is-selected")).toBe(true);
    setSelectedTrain(null);
    expect(container.querySelectorAll(".is-selected")).toHaveLength(0);
  });

  it("setSelectedTrain では onTrainSelect は発火しない", () => {
    const cb = vi.fn();
    cleanups.push(onTrainSelect(cb));
    setSelectedTrain("nozomi");
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("emphasizeTrains", () => {
  it("指定したカードを強調し、それ以外を控えめにする", () => {
    emphasizeTrains(["hayabusa", "komachi"]);
    expect(card("hayabusa").classList.contains("is-emphasized")).toBe(true);
    expect(card("komachi").classList.contains("is-emphasized")).toBe(true);
    expect(card("nozomi").classList.contains("is-dimmed")).toBe(true);
    expect(card("hayabusa").classList.contains("is-dimmed")).toBe(false);
  });

  it("null で強調を解除する", () => {
    emphasizeTrains(["hayabusa"]);
    emphasizeTrains(null);
    expect(container.querySelectorAll(".is-emphasized, .is-dimmed")).toHaveLength(0);
  });
});
