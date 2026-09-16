import { lines } from "../data/lines";
import { stations } from "../data/stations";
import type { LineId } from "../data/types";
import { japanLand } from "./japan-geo";
import { createProjection, JAPAN_BOUNDS, type Point } from "./projection";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAP_WIDTH = 1000;
const LINE_WIDTH = 7;
/** 選択中の列車が実際に走る区間の太さ */
const ROUTE_WIDTH = 14;
/** 走行区間を地図から浮かせる白いふち */
const ROUTE_CASING_WIDTH = 22;
/** 3歳のマウス操作でも当たるよう、見た目よりかなり太い透明な当たり線 */
const HIT_WIDTH = 32;

/**
 * 駅名を表示する主要駅と、ドットからのラベル位置 (SVG 座標のオフセット)。
 * 近い駅どうしで重ならないよう手で調整している。
 */
const MAJOR_STATION_LABELS: Readonly<Record<string, Point>> = {
  "shin-hakodate-hokuto": { x: 12, y: -8 },
  "shin-aomori": { x: -12, y: -14 },
  morioka: { x: 12, y: 6 },
  akita: { x: -12, y: 6 },
  shinjo: { x: -12, y: -6 },
  sendai: { x: 12, y: 6 },
  niigata: { x: -12, y: -10 },
  nagano: { x: 0, y: -16 },
  kanazawa: { x: -12, y: -10 },
  tsuruga: { x: -12, y: 16 },
  tokyo: { x: 12, y: 16 },
  nagoya: { x: 10, y: -14 },
  "shin-osaka": { x: 0, y: 26 },
  okayama: { x: 0, y: -16 },
  hiroshima: { x: 0, y: 26 },
  hakata: { x: -12, y: -10 },
  nagasaki: { x: 0, y: 32 },
  "kagoshima-chuo": { x: 12, y: 18 },
};

export interface JapanMap {
  /** 地図の SVG 要素 (呼び出し側で DOM に追加する) */
  element: SVGSVGElement;
  /** 指定路線だけを強調し、それ以外を薄くする。null で全路線を通常表示に戻す */
  highlightLines(lineIds: readonly LineId[] | null): void;
  /**
   * 駅列 (隣どうしが路線で隣接) の区間だけを路線色で太く描き、全路線と区間外の駅を薄くする。
   * 複数路線が同じ区間を共有するときは preferLineIds の路線の色を使う。null で消す
   */
  highlightRoute(stationIds: readonly string[] | null, preferLineIds?: readonly LineId[]): void;
  /** 路線クリック時のハンドラを登録する。戻り値を呼ぶと解除 */
  onLineClick(cb: (lineId: LineId) => void): () => void;
  /** 駅の SVG 座標 */
  getStationPoint(stationId: string): Point;
  /** 路線のポリライン (駅順の SVG 座標) */
  getLinePath(lineId: LineId): Point[];
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const toPoints = (path: readonly Point[]) =>
  path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

export interface RouteSegment {
  lineId: LineId;
  stationIds: string[];
}

/** 駅列を、隣接駅間を走る路線ごとの連続区間に分ける */
export function splitRouteByLine(stationIds: readonly string[], preferLineIds: readonly LineId[] = []): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 1; i < stationIds.length; i++) {
    const a = stationIds[i - 1];
    const b = stationIds[i];
    const candidates = lines.filter((l) => {
      const j = l.stationIds.indexOf(a);
      return j >= 0 && (l.stationIds[j + 1] === b || l.stationIds[j - 1] === b);
    });
    const line = candidates.find((l) => preferLineIds.includes(l.id)) ?? candidates[0];
    if (!line) throw new Error(`stations are not adjacent: ${a} - ${b}`);
    const last = segments.at(-1);
    if (last?.lineId === line.id) last.stationIds.push(b);
    else segments.push({ lineId: line.id, stationIds: [a, b] });
  }
  return segments;
}

export function createJapanMap(): JapanMap {
  const projection = createProjection(JAPAN_BOUNDS, MAP_WIDTH);
  const stationPoints = new Map(stations.map((s) => [s.id, projection.project(s.lat, s.lon)]));

  const getStationPoint = (stationId: string): Point => {
    const p = stationPoints.get(stationId);
    if (!p) throw new Error(`unknown station: ${stationId}`);
    return { ...p };
  };

  const getLinePath = (lineId: LineId): Point[] => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) throw new Error(`unknown line: ${lineId}`);
    return line.stationIds.map(getStationPoint);
  };

  const element = svg("svg", {
    class: "japan-map",
    viewBox: `0 0 ${MAP_WIDTH} ${projection.height.toFixed(0)}`,
    role: "img",
    "aria-label": "にほん の しんかんせん ちず",
  });

  element.append(svg("rect", { class: "map-sea", x: 0, y: 0, width: "100%", height: "100%" }));

  const land = svg("g", { class: "map-land" });
  for (const ring of japanLand) {
    land.append(
      svg("polygon", {
        points: toPoints(ring.map(([lon, lat]) => projection.project(lat, lon))),
      }),
    );
  }
  element.append(land);

  const lineLayer = svg("g", { class: "map-lines" });
  for (const line of lines) {
    const points = toPoints(getLinePath(line.id));
    const group = svg("g", { class: "map-line", "data-line-id": line.id });
    group.append(
      svg("polyline", {
        class: "map-line-stroke",
        points,
        stroke: line.color,
        "stroke-width": LINE_WIDTH,
      }),
      svg("polyline", { class: "map-line-hit", points, stroke: "transparent", "stroke-width": HIT_WIDTH }),
    );
    lineLayer.append(group);
  }
  element.append(lineLayer);

  const routeLayer = svg("g", { class: "map-route", "pointer-events": "none" });
  element.append(routeLayer);

  const stationLayer = svg("g", { class: "map-stations" });
  for (const s of stations) {
    const p = getStationPoint(s.id);
    const offset = MAJOR_STATION_LABELS[s.id];
    const lineIds = lines.filter((l) => l.stationIds.includes(s.id)).map((l) => l.id);
    const group = svg("g", {
      class: offset ? "map-station is-major" : "map-station",
      "data-station-id": s.id,
      "data-line-ids": lineIds.join(" "),
    });
    group.append(svg("circle", { class: "map-station-dot", cx: p.x, cy: p.y, r: offset ? 7 : 4 }));
    if (offset) {
      const label = svg("text", {
        class: "map-station-label",
        x: p.x + offset.x,
        y: p.y + offset.y,
        "text-anchor": offset.x > 0 ? "start" : offset.x < 0 ? "end" : "middle",
      });
      label.textContent = s.kana;
      group.append(label);
    }
    stationLayer.append(group);
  }
  element.append(stationLayer);

  const clickHandlers = new Set<(lineId: LineId) => void>();
  element.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const group = target.closest<SVGGElement>(".map-line");
    const lineId = group?.dataset.lineId as LineId | undefined;
    if (!lineId) return;
    for (const cb of clickHandlers) cb(lineId);
  });

  const dimStations = (isActive: ((g: SVGGElement) => boolean) | null) => {
    for (const g of element.querySelectorAll<SVGGElement>(".map-station")) {
      g.classList.toggle("is-dimmed", isActive !== null && !isActive(g));
    }
  };

  return {
    element,
    getStationPoint,
    getLinePath,
    highlightRoute(stationIds, preferLineIds = []) {
      routeLayer.replaceChildren();
      for (const g of element.querySelectorAll<SVGGElement>(".map-line")) {
        g.classList.toggle("is-dimmed", stationIds !== null);
      }
      if (!stationIds) {
        dimStations(null);
        return;
      }
      const onRoute = new Set(stationIds);
      dimStations((g) => onRoute.has(g.dataset.stationId ?? ""));

      const segments = splitRouteByLine(stationIds, preferLineIds);
      const casings = segments.map((seg) =>
        svg("polyline", {
          class: "map-route-casing",
          points: toPoints(seg.stationIds.map(getStationPoint)),
          stroke: "#ffffff",
          "stroke-width": ROUTE_CASING_WIDTH,
        }),
      );
      const strokes = segments.map((seg) =>
        svg("polyline", {
          class: "map-route-segment",
          points: toPoints(seg.stationIds.map(getStationPoint)),
          stroke: lines.find((l) => l.id === seg.lineId)?.color ?? "#000000",
          "stroke-width": ROUTE_WIDTH,
          "data-line-id": seg.lineId,
          "data-station-ids": seg.stationIds.join(" "),
        }),
      );
      routeLayer.append(...casings, ...strokes);
    },
    highlightLines(lineIds) {
      routeLayer.replaceChildren();
      const active = lineIds ? new Set<string>(lineIds) : null;
      for (const g of element.querySelectorAll<SVGGElement>(".map-line")) {
        g.classList.toggle("is-dimmed", active !== null && !active.has(g.dataset.lineId ?? ""));
      }
      dimStations(active && ((g) => (g.dataset.lineIds ?? "").split(" ").some((id) => active.has(id))));
    },
    onLineClick(cb) {
      clickHandlers.add(cb);
      return () => {
        clickHandlers.delete(cb);
      };
    },
  };
}
