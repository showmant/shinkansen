// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { lines } from "../data/lines";
import { stations } from "../data/stations";
import type { LineId } from "../data/types";
import { japanLand } from "./japan-geo";
import { createJapanMap } from "./map";

function lineGroup(svg: SVGSVGElement, id: LineId): Element {
  const el = svg.querySelector(`.map-line[data-line-id="${id}"]`);
  if (!el) throw new Error(`line ${id} not found`);
  return el;
}

describe("japanLand", () => {
  it("北海道〜九州をカバーする陸地ポリゴンがある", () => {
    const pts = japanLand.flat();
    expect(japanLand.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...pts.map(([, lat]) => lat))).toBeGreaterThan(45);
    expect(Math.min(...pts.map(([, lat]) => lat))).toBeLessThan(31.5);
  });
});

describe("createJapanMap", () => {
  it("getStationPoint が全駅で有限の数値を返す", () => {
    const map = createJapanMap();
    for (const s of stations) {
      const p = map.getStationPoint(s.id);
      expect(Number.isFinite(p.x), s.id).toBe(true);
      expect(Number.isFinite(p.y), s.id).toBe(true);
    }
  });

  it("getStationPoint は未知の駅で例外", () => {
    expect(() => createJapanMap().getStationPoint("nowhere")).toThrow();
  });

  it("getLinePath は路線の駅順に座標を返す", () => {
    const map = createJapanMap();
    for (const l of lines) {
      expect(map.getLinePath(l.id)).toEqual(l.stationIds.map((id) => map.getStationPoint(id)));
    }
  });

  it("全路線が代表色で描かれる", () => {
    const { element } = createJapanMap();
    for (const l of lines) {
      const stroke = lineGroup(element, l.id).querySelector(".map-line-stroke");
      expect(stroke?.getAttribute("stroke")).toBe(l.color);
    }
  });

  it("主要駅名がひらがなで表示される", () => {
    const { element } = createJapanMap();
    const labels = [...element.querySelectorAll(".map-station-label")].map((t) => t.textContent);
    expect(labels).toContain("とうきょう");
    expect(labels).toContain("はかた");
    expect(labels.length).toBeLessThan(stations.length);
  });

  it("highlightLines で対象以外が薄くなり、null で元に戻る", () => {
    const map = createJapanMap();
    map.highlightLines(["tokaido", "sanyo"]);
    expect(lineGroup(map.element, "tokaido").classList.contains("is-dimmed")).toBe(false);
    expect(lineGroup(map.element, "sanyo").classList.contains("is-dimmed")).toBe(false);
    expect(lineGroup(map.element, "tohoku").classList.contains("is-dimmed")).toBe(true);

    map.highlightLines(null);
    expect(map.element.querySelectorAll(".is-dimmed")).toHaveLength(0);
  });

  it("onLineClick は当たり線クリックで路線 ID を通知し、解除できる", () => {
    const map = createJapanMap();
    const cb = vi.fn();
    const off = map.onLineClick(cb);
    const hit = lineGroup(map.element, "joetsu").querySelector(".map-line-hit");
    hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).toHaveBeenCalledWith("joetsu");

    off();
    hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("当たり線は見た目の線より太い", () => {
    const g = lineGroup(createJapanMap().element, "tokaido");
    const hitWidth = Number(g.querySelector(".map-line-hit")?.getAttribute("stroke-width"));
    const strokeWidth = Number(g.querySelector(".map-line-stroke")?.getAttribute("stroke-width"));
    expect(hitWidth).toBeGreaterThan(strokeWidth * 2);
  });
});
