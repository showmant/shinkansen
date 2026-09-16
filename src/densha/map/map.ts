import { createProjection, type Point } from "../../map/projection";
import { denshaStations, HOME_STATION_ID } from "../data/stations";
import type { RailLine } from "../types";
import { prefectureShapes } from "./land-geo";
import { DENSHA_BOUNDS, lineSegments, stationLonLat } from "./rail-geo";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAP_WIDTH = 1000;
/** 画面上の太さ (拡大しても変わらないよう、ズーム率をかけて使う) */
const LINE_WIDTH = 3.2;
const ROUTE_WIDTH = 7;
const ROUTE_CASING_WIDTH = 12;
const HIT_WIDTH = 16;
const DOT_RADIUS = 2.2;
const LABEL_SIZE = 13;
const ZOOM_MS = 700;

/** 何も選んでいないときに名前を出す駅 */
const MAJOR_STATION_IDS: readonly string[] = [
  "shinjuku",
  "shibuya",
  "ikebukuro",
  "tokyo",
  "shinagawa",
  "ueno",
  "yokohama",
  "hachioji",
  "tachikawa",
  "omiya",
  "chiba",
  "odawara",
  "fujisawa",
  "kamakura",
  "ebina",
  "hashimoto",
  "shin-yokohama",
  "kawasaki",
  "yokosuka",
  "chuo-rinkan",
  "atami",
  "hanno",
  "kawagoe",
];

/** 都県名・海の名前 (経度・緯度) */
const AREA_LABELS: readonly { text: string; lon: number; lat: number; kind: "pref" | "sea" }[] = [
  { text: "とうきょう", lon: 139.33, lat: 35.74, kind: "pref" },
  { text: "かながわ", lon: 139.2, lat: 35.45, kind: "pref" },
  { text: "さいたま", lon: 139.45, lat: 35.97, kind: "pref" },
  { text: "ちば", lon: 140.07, lat: 35.8, kind: "pref" },
  { text: "やまなし", lon: 139.0, lat: 35.68, kind: "pref" },
  { text: "とうきょうわん", lon: 139.86, lat: 35.45, kind: "sea" },
  { text: "さがみわん", lon: 139.35, lat: 35.19, kind: "sea" },
];

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutePiece {
  lineId: string;
  points: Point[];
}

export interface RouteOptions {
  /** 終着駅から先、地図の外まで走る (あずさ など) ときに、最後の区間を表示範囲の端まで直線でのばす */
  extendToEdge?: boolean;
}

export interface DenshaMap {
  element: SVGSVGElement;
  /** 走るアイコンなどを載せる一番上の層 */
  overlay: SVGGElement;
  /** 指定路線だけを強調して寄る。null で全体表示 */
  highlightLines(lineIds: readonly string[] | null): void;
  /** 駅列の区間を太く描いて寄る */
  highlightRoute(stationIds: readonly string[], preferLineIds: readonly string[], options?: RouteOptions): RoutePiece[];
  onLineClick(cb: (lineId: string) => void): () => void;
  /** 駅列に沿った走行用の折れ線 (SVG 座標) */
  routePoints(stationIds: readonly string[], preferLineIds: readonly string[], options?: RouteOptions): Point[];
  /** 現在の拡大率 (1 = 全体表示。数字が小さいほど寄っている) */
  scale(): number;
  onScale(cb: (scale: number) => void): () => void;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const toPoints = (path: readonly Point[]) => path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

export function createDenshaMap(lines: readonly RailLine[]): DenshaMap {
  const projection = createProjection(DENSHA_BOUNDS, MAP_WIDTH);
  const fullView: ViewBox = { x: 0, y: 0, width: MAP_WIDTH, height: projection.height };
  const project = (lon: number, lat: number) => projection.project(lat, lon);
  const flat = (coords: readonly number[]): Point[] => {
    const points: Point[] = [];
    for (let i = 0; i < coords.length; i += 2) points.push(project(coords[i], coords[i + 1]));
    return points;
  };

  const stationPoint = (id: string): Point => {
    const ll = stationLonLat[id];
    if (!ll) throw new Error(`unknown station: ${id}`);
    return project(ll[0], ll[1]);
  };
  const kanaOf = new Map(denshaStations.map((s) => [s.id, s.kana]));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const linePoints = new Map(
    lines.map((line) => {
      const segs = lineSegments[line.id] ?? [];
      const points = segs.flatMap((seg, i) => (i === 0 ? flat(seg) : flat(seg).slice(1)));
      return [line.id, points];
    }),
  );

  const element = svg("svg", {
    class: "densha-map",
    viewBox: `0 0 ${MAP_WIDTH} ${projection.height.toFixed(0)}`,
    role: "img",
    "aria-label": "とうきょう と かながわ の でんしゃ ちず",
  });
  // 線の太さは CSS で「太さ × ズーム率 (--k)」にして、寄っても画面上の太さを保つ
  for (const [name, value] of Object.entries({
    "--line-width": LINE_WIDTH,
    "--route-width": ROUTE_WIDTH,
    "--route-casing-width": ROUTE_CASING_WIDTH,
    "--hit-width": HIT_WIDTH,
    "--label-size": LABEL_SIZE,
  })) {
    element.style.setProperty(name, String(value));
  }
  element.append(svg("rect", { class: "map-sea", x: -5000, y: -5000, width: 11000, height: 11000 }));

  const land = svg("g", { class: "densha-land" });
  for (const pref of prefectureShapes) {
    for (const ring of pref.rings) {
      land.append(svg("polygon", { class: pref.focus ? "is-focus" : "", points: toPoints(flat(ring)) }));
    }
  }
  element.append(land);

  const areaLayer = svg("g", { class: "densha-areas" });
  for (const area of AREA_LABELS) {
    const p = project(area.lon, area.lat);
    const text = svg("text", { class: `densha-area densha-area--${area.kind}`, x: p.x, y: p.y, "text-anchor": "middle" });
    text.textContent = area.text;
    areaLayer.append(text);
  }
  element.append(areaLayer);

  const lineLayer = svg("g", { class: "densha-lines" });
  for (const line of lines) {
    const points = toPoints(linePoints.get(line.id) ?? []);
    const group = svg("g", { class: "densha-line", "data-line-id": line.id });
    group.append(
      svg("polyline", { class: "densha-line-stroke", points, stroke: line.color }),
      svg("polyline", { class: "densha-line-hit", points, stroke: "transparent" }),
    );
    lineLayer.append(group);
  }
  element.append(lineLayer);

  const routeLayer = svg("g", { class: "densha-route", "pointer-events": "none" });
  element.append(routeLayer);

  const stationLayer = svg("g", { class: "densha-stations" });
  const stationGroups = new Map<string, { group: SVGGElement; dot: SVGCircleElement; label: SVGTextElement; p: Point }>();
  for (const s of denshaStations) {
    const p = stationPoint(s.id);
    const lineIds = lines.filter((l) => l.stationIds.includes(s.id)).map((l) => l.id);
    const group = svg("g", { class: "densha-station", "data-station-id": s.id, "data-line-ids": lineIds.join(" ") });
    const dot = svg("circle", { class: "densha-station-dot", cx: p.x, cy: p.y, r: DOT_RADIUS });
    const label = svg("text", { class: "densha-station-label is-hidden", x: p.x, y: p.y });
    label.textContent = s.kana;
    group.append(dot, label);
    stationLayer.append(group);
    stationGroups.set(s.id, { group, dot, label, p });
  }
  element.append(stationLayer);

  // おうち (町田駅)
  const homePoint = stationPoint(HOME_STATION_ID);
  const home = svg("g", { class: "densha-home", "pointer-events": "none" });
  const homeInner = svg("g");
  homeInner.innerHTML = [
    `<circle r="17" cy="-26" fill="#fff" stroke="#e8534a" stroke-width="3"/>`,
    `<path d="M -10 -26 L 0 -36 L 10 -26 L 10 -15 L -10 -15 Z" fill="#ffb74d" stroke="#8d4a1f" stroke-width="2" stroke-linejoin="round"/>`,
    `<path d="M -13 -25 L 0 -38 L 13 -25" fill="none" stroke="#e8534a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<rect x="-3" y="-23" width="6" height="8" fill="#8d4a1f"/>`,
    `<path d="M 0 -9 L -5 -3 L 5 -3 Z" fill="#e8534a"/>`,
    `<text class="densha-home-label" y="-48" text-anchor="middle">まちだ (おうち)</text>`,
  ].join("");
  home.append(homeInner);
  element.append(home);

  const overlay = svg("g", { class: "densha-overlay" });
  element.append(overlay);

  // ---- ズーム ----
  let view: ViewBox = { ...fullView };
  let zoomFrame: number | null = null;
  const scaleListeners = new Set<(scale: number) => void>();
  const scale = () => view.width / MAP_WIDTH;
  let labelIds: readonly string[] = MAJOR_STATION_IDS;
  let alwaysIds = new Set<string>();

  const applyView = () => {
    element.setAttribute("viewBox", `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`);
    const k = scale();
    element.style.setProperty("--k", k.toFixed(4));
    for (const { dot } of stationGroups.values()) dot.setAttribute("r", (DOT_RADIUS * Math.max(k, 0.35)).toFixed(2));
    homeInner.setAttribute("transform", `translate(${homePoint.x.toFixed(1)} ${homePoint.y.toFixed(1)}) scale(${k.toFixed(4)})`);
    scaleListeners.forEach((cb) => cb(k));
  };

  const placeLabels = () => {
    const k = scale();
    const size = LABEL_SIZE * k;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const overlaps = (b: { x: number; y: number; w: number; h: number }) =>
      placed.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
    // おうちマークの場所はあけておく
    placed.push({ x: homePoint.x - 60 * k, y: homePoint.y - 60 * k, w: 120 * k, h: 60 * k });
    for (const { label } of stationGroups.values()) label.classList.add("is-hidden");
    const ordered = [...alwaysIds, ...labelIds.filter((id) => !alwaysIds.has(id))];
    for (const id of ordered) {
      const entry = stationGroups.get(id);
      if (!entry || id === HOME_STATION_ID) continue;
      const text = kanaOf.get(id) ?? "";
      // 白ふちの分だけ余白をとって、となりの駅名とくっつかないようにする
      const w = text.length * size + size * 0.6;
      const h = size * 1.45;
      const gap = 3 * k;
      const candidates = [
        { x: entry.p.x + gap, y: entry.p.y - h / 2, anchor: "start" },
        { x: entry.p.x - gap - w, y: entry.p.y - h / 2, anchor: "end" },
        { x: entry.p.x - w / 2, y: entry.p.y - gap - h, anchor: "middle" },
        { x: entry.p.x - w / 2, y: entry.p.y + gap, anchor: "middle" },
      ];
      const spot = candidates.find((c) => !overlaps({ x: c.x, y: c.y, w, h }));
      if (!spot) continue;
      placed.push({ x: spot.x, y: spot.y, w, h });
      const tx = spot.anchor === "start" ? spot.x : spot.anchor === "end" ? spot.x + w : spot.x + w / 2;
      const pad = size * 0.3;
      entry.label.setAttribute("x", (spot.anchor === "start" ? tx + pad : spot.anchor === "end" ? tx - pad : tx).toFixed(1));
      entry.label.setAttribute("y", (spot.y + h / 2 + size * 0.36).toFixed(1));
      entry.label.setAttribute("text-anchor", spot.anchor);
      entry.label.classList.remove("is-hidden");
    }
  };

  const zoomTo = (target: ViewBox) => {
    if (zoomFrame !== null) cancelAnimationFrame(zoomFrame);
    const from = { ...view };
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    for (const { label } of stationGroups.values()) label.classList.add("is-hidden");
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min((now - start) / ZOOM_MS, 1);
      const e = (1 - Math.cos(Math.PI * t)) / 2;
      view = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        width: from.width + (target.width - from.width) * e,
        height: from.height + (target.height - from.height) * e,
      };
      applyView();
      if (t < 1) {
        zoomFrame = requestAnimationFrame(tick);
      } else {
        zoomFrame = null;
        placeLabels();
      }
    };
    zoomFrame = requestAnimationFrame(tick);
  };

  /** 点の集まりが収まる、地図と同じ縦横比の表示範囲 */
  const fit = (points: readonly Point[]): ViewBox => {
    if (points.length === 0) return { ...fullView };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const aspect = fullView.width / fullView.height;
    // 端の駅名やおうちマークが切れないよう余白を多めに
    let width = Math.max((maxX - minX) * 1.35, 150);
    let height = Math.max((maxY - minY) * 1.35, 150 / aspect);
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    width = Math.min(width, fullView.width);
    height = Math.min(height, fullView.height);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { x: cx - width / 2, y: cy - height / 2, width, height };
  };

  const dimLines = (active: Set<string> | null) => {
    for (const g of element.querySelectorAll<SVGGElement>(".densha-line")) {
      g.classList.toggle("is-dimmed", active !== null && !active.has(g.dataset.lineId ?? ""));
    }
  };
  const dimStations = (active: Set<string> | null) => {
    for (const [id, { group }] of stationGroups) group.classList.toggle("is-dimmed", active !== null && !active.has(id));
  };

  /** 隣り合う駅 a→b の線形 (路線の向きに合わせて反転) */
  const segmentBetween = (a: string, b: string, preferLineIds: readonly string[]): RoutePiece => {
    const candidates = lines.filter((l) => {
      const i = l.stationIds.indexOf(a);
      return i >= 0 && (l.stationIds[i + 1] === b || l.stationIds[i - 1] === b);
    });
    const line = candidates.find((l) => preferLineIds.includes(l.id)) ?? candidates[0];
    if (!line) throw new Error(`stations are not adjacent: ${a} - ${b}`);
    const segs = lineSegments[line.id] ?? [];
    const i = line.stationIds.indexOf(a);
    if (line.stationIds[i + 1] === b) return { lineId: line.id, points: flat(segs[i]) };
    return { lineId: line.id, points: flat(segs[i - 1]).reverse() };
  };

  /** 折れ線の最後の向きのまま、表示範囲 (地図全体) の端まで直線でのばした点を返す */
  const edgePoint = (points: readonly Point[]): Point | null => {
    if (points.length < 2) return null;
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const ts = [
      dx > 0 ? (fullView.width - b.x) / dx : null,
      dx < 0 ? (fullView.x - b.x) / dx : null,
      dy > 0 ? (fullView.height - b.y) / dy : null,
      dy < 0 ? (fullView.y - b.y) / dy : null,
    ].filter((t): t is number => t !== null && t > 0);
    if (ts.length === 0) return null;
    const t = Math.min(...ts);
    return { x: b.x + dx * t, y: b.y + dy * t };
  };

  const routePieces = (stationIds: readonly string[], preferLineIds: readonly string[], options: RouteOptions = {}): RoutePiece[] => {
    const pieces: RoutePiece[] = [];
    for (let i = 1; i < stationIds.length; i++) {
      const seg = segmentBetween(stationIds[i - 1], stationIds[i], preferLineIds);
      const last = pieces.at(-1);
      if (last?.lineId === seg.lineId) last.points.push(...seg.points.slice(1));
      else pieces.push(seg);
    }
    if (options.extendToEdge) {
      const last = pieces.at(-1);
      const edge = last && edgePoint(last.points);
      if (edge) last.points.push(edge);
    }
    return pieces;
  };

  const drawRoute = (pieces: readonly RoutePiece[]) => {
    routeLayer.replaceChildren(
      ...pieces.map((piece) => svg("polyline", { class: "densha-route-casing", points: toPoints(piece.points) })),
      ...pieces.map((piece) =>
        svg("polyline", {
          class: "densha-route-segment",
          points: toPoints(piece.points),
          stroke: lineById.get(piece.lineId)?.color ?? "#000000",
          "data-line-id": piece.lineId,
        }),
      ),
    );
  };

  const clickHandlers = new Set<(lineId: string) => void>();
  element.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const lineId = target.closest<SVGGElement>(".densha-line")?.dataset.lineId;
    if (lineId) clickHandlers.forEach((cb) => cb(lineId));
  });

  applyView();
  placeLabels();

  return {
    element,
    overlay,
    scale,
    onScale(cb) {
      scaleListeners.add(cb);
      return () => {
        scaleListeners.delete(cb);
      };
    },
    highlightLines(lineIds) {
      const active = lineIds ? new Set(lineIds) : null;
      dimLines(active);
      if (!active) {
        routeLayer.replaceChildren();
        dimStations(null);
        alwaysIds = new Set();
        labelIds = MAJOR_STATION_IDS;
        zoomTo(fullView);
        return;
      }
      const selected = lines.filter((l) => active.has(l.id));
      const stationIds = selected.flatMap((l) => l.stationIds);
      dimStations(new Set(stationIds));
      drawRoute(selected.map((l) => ({ lineId: l.id, points: linePoints.get(l.id) ?? [] })));
      alwaysIds = new Set(selected.flatMap((l) => [l.stationIds[0], l.stationIds[l.stationIds.length - 1]]));
      labelIds = stationIds;
      zoomTo(fit(selected.flatMap((l) => linePoints.get(l.id) ?? [])));
    },
    highlightRoute(stationIds, preferLineIds, options) {
      const pieces = routePieces(stationIds, preferLineIds, options);
      dimLines(new Set());
      dimStations(new Set(stationIds));
      drawRoute(pieces);
      alwaysIds = new Set([stationIds[0], stationIds[stationIds.length - 1]]);
      labelIds = stationIds;
      zoomTo(fit(pieces.flatMap((p) => p.points)));
      return pieces;
    },
    routePoints(stationIds, preferLineIds, options) {
      return routePieces(stationIds, preferLineIds, options).flatMap((p, i) => (i === 0 ? p.points : p.points.slice(1)));
    },
    onLineClick(cb) {
      clickHandlers.add(cb);
      return () => {
        clickHandlers.delete(cb);
      };
    },
  };
}
