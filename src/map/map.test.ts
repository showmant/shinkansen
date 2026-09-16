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

describe("highlightRoute", () => {
  const segments = (svg: SVGSVGElement) =>
    [...svg.querySelectorAll<SVGPolylineElement>(".map-route-segment")].map((el) => ({
      lineId: el.dataset.lineId,
      stationIds: el.dataset.stationIds?.split(" "),
      stroke: el.getAttribute("stroke"),
    }));
  const station = (svg: SVGSVGElement, id: string) => {
    const el = svg.querySelector(`.map-station[data-station-id="${id}"]`);
    if (!el) throw new Error(`station ${id} not found`);
    return el;
  };

  it("走行区間だけを路線ごとの色で太く描き、路線全体と区間外の駅は薄くする", () => {
    const map = createJapanMap();
    map.highlightRoute(["tokyo", "ueno", "omiya", "takasaki", "echigo-yuzawa", "nagaoka", "niigata"]);

    const tohoku = lines.find((l) => l.id === "tohoku");
    const joetsu = lines.find((l) => l.id === "joetsu");
    expect(segments(map.element)).toEqual([
      { lineId: "tohoku", stationIds: ["tokyo", "ueno", "omiya"], stroke: tohoku?.color },
      { lineId: "joetsu", stationIds: ["omiya", "takasaki", "echigo-yuzawa", "nagaoka", "niigata"], stroke: joetsu?.color },
    ]);
    const routeWidth = Number(map.element.querySelector(".map-route-segment")?.getAttribute("stroke-width"));
    const lineWidth = Number(map.element.querySelector(".map-line-stroke")?.getAttribute("stroke-width"));
    expect(routeWidth).toBeGreaterThan(lineWidth);

    expect(map.element.querySelectorAll(".map-line:not(.is-dimmed)")).toHaveLength(0);
    expect(station(map.element, "omiya").classList.contains("is-dimmed")).toBe(false);
    expect(station(map.element, "niigata").classList.contains("is-dimmed")).toBe(false);
    expect(station(map.element, "sendai").classList.contains("is-dimmed")).toBe(true);
  });

  it("区間を複数路線が共有するときは preferLineIds の路線の色を使う", () => {
    const map = createJapanMap();
    map.highlightRoute(["omiya", "takasaki", "karuizawa"], ["hokuriku"]);
    expect(segments(map.element).map((s) => s.lineId)).toEqual(["joetsu", "hokuriku"]);

    // 大宮→高崎は上越のみなので preferLineIds に無くても上越の色
    map.highlightRoute(["takasaki", "karuizawa"], ["joetsu"]);
    expect(segments(map.element).map((s) => s.lineId)).toEqual(["hokuriku"]);
  });

  it("null や highlightLines で走行区間を消す", () => {
    const map = createJapanMap();
    map.highlightRoute(["tokyo", "ueno"]);
    map.highlightRoute(null);
    expect(map.element.querySelectorAll(".map-route-segment, .is-dimmed")).toHaveLength(0);

    map.highlightRoute(["tokyo", "ueno"]);
    map.highlightLines(["tohoku"]);
    expect(map.element.querySelectorAll(".map-route-segment")).toHaveLength(0);
    expect(lineGroup(map.element, "tohoku").classList.contains("is-dimmed")).toBe(false);
  });

  it("走行区間はクリックを遮らない (下の路線の当たり線に通す)", () => {
    const map = createJapanMap();
    map.highlightRoute(["tokyo", "ueno"]);
    expect(map.element.querySelector(".map-route")?.getAttribute("pointer-events")).toBe("none");
  });
});
