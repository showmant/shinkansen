import { lines as shinkansenLines } from "../data/lines";
import { stations as shinkansenStations } from "../data/stations";
import type { LineId } from "../data/types";
import { railLines } from "../densha/data/lines";
import { createDenshaMap } from "../densha/map/map";
import { createJapanMap } from "../map/map";
import type { Point } from "../map/projection";
import type { Genre, MapView } from "./questions";

const SVG_NS = "http://www.w3.org/2000/svg";
const ZOOM_MS = 700;

/** クイズで使う地図 (しんかんせん・でんしゃ 共通の口) */
export interface QuizMap {
  element: SVGSVGElement;
  /** 問題の地図を出す */
  show(view: MapView): void;
  /** 答え合わせ: 「？」の駅名を出す */
  reveal(view: MapView, answerLabel: string): void;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * 駅の上に立てる吹き出し (「？」や「ここ」)。k は地図の拡大率で、
 * 寄っても画面上の大きさが変わらないように scale(k) する。
 */
function createMarker(layer: SVGGElement) {
  const group = svg("g", { class: "quiz-marker", "pointer-events": "none" });
  const ring = svg("circle", { class: "quiz-marker__ring", r: 14 });
  const tail = svg("path", { class: "quiz-marker__bubble", d: "M -9 -30 L 0 -10 L 9 -30 Z" });
  const bubble = svg("rect", { class: "quiz-marker__bubble", y: -74, height: 48, rx: 24 });
  const text = svg("text", { class: "quiz-marker__text", y: -40, "text-anchor": "middle" });
  group.append(ring, tail, bubble, text);
  group.style.display = "none";
  layer.append(group);

  let point: Point | null = null;
  let k = 1;
  const render = () => {
    if (!point) return;
    group.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) scale(${k.toFixed(4)})`);
  };
  return {
    /** answer: 答え合わせで出す駅名 (色を変える) */
    show(p: Point, label: string, answer = false) {
      point = p;
      text.textContent = label;
      const width = Math.max(48, [...label].length * 28 + 28);
      bubble.setAttribute("x", String(-width / 2));
      bubble.setAttribute("width", String(width));
      group.classList.toggle("is-answer", answer);
      group.style.display = "";
      render();
    },
    hide() {
      point = null;
      group.style.display = "none";
    },
    setScale(next: number) {
      k = next;
      render();
    },
  };
}

// ---- でんしゃ ----

function denshaQuizMap(): QuizMap {
  const map = createDenshaMap(railLines);
  const marker = createMarker(map.overlay);
  map.onScale((k) => marker.setScale(k));
  marker.setScale(map.scale());

  const stationPoint = (id: string): Point => {
    const dot = map.element.querySelector<SVGCircleElement>(`.densha-station[data-station-id="${id}"] .densha-station-dot`);
    return { x: Number(dot?.getAttribute("cx") ?? 0), y: Number(dot?.getAttribute("cy") ?? 0) };
  };
  const hideLabelOf = (id: string | null) => {
    for (const g of map.element.querySelectorAll<SVGGElement>(".densha-station.is-quiz-hidden")) {
      g.classList.remove("is-quiz-hidden");
    }
    if (id) map.element.querySelector(`.densha-station[data-station-id="${id}"]`)?.classList.add("is-quiz-hidden");
  };

  return {
    element: map.element,
    show(view) {
      marker.hide();
      hideLabelOf(null);
      if (view.kind === "gap") {
        map.highlightRoute(view.stationIds, [view.lineId]);
        hideLabelOf(view.hiddenId);
        marker.show(stationPoint(view.hiddenId), "？");
      } else if (view.kind === "line") {
        map.highlightLines([view.lineId]);
      } else {
        map.focusStation(view.stationId);
        marker.show(stationPoint(view.stationId), "ここ");
      }
    },
    reveal(view, answerLabel) {
      if (view.kind === "gap") marker.show(stationPoint(view.hiddenId), answerLabel, true);
    },
  };
}

// ---- しんかんせん ----

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 表示範囲を決めるとき、最低これだけの幅はとる (寄りすぎると まわりが わからない) */
const SHINKANSEN_MIN_WIDTH = 260;
const SHINKANSEN_FOCUS_RADIUS = 110;
const LABEL_SIZE = 22;

/**
 * しんかんせんの地図 (createJapanMap) はそのまま使い、拡大 (viewBox) と
 * 駅名ラベルだけクイズ側で持つ。線の太さは quiz.css で「太さ × 拡大率 (--k)」にする。
 */
function shinkansenQuizMap(): QuizMap {
  const map = createJapanMap();
  const element = map.element;
  element.classList.add("quiz-japan-map");
  const [, , fullWidth, fullHeight] = (element.getAttribute("viewBox") ?? "0 0 1000 1000").split(" ").map(Number);
  const fullView: ViewBox = { x: 0, y: 0, width: fullWidth, height: fullHeight };
  let view: ViewBox = { ...fullView };
  let frame: number | null = null;

  const labelLayer = svg("g", { class: "quiz-labels", "pointer-events": "none" });
  const markerLayer = svg("g");
  element.append(labelLayer, markerLayer);
  const marker = createMarker(markerLayer);
  const kanaOf = new Map(shinkansenStations.map((s) => [s.id, s.kana]));
  const dots = [...element.querySelectorAll<SVGCircleElement>(".map-station-dot")].map((dot) => ({
    dot,
    r: Number(dot.getAttribute("r") ?? 4),
  }));

  const scale = () => view.width / fullView.width;
  const applyView = () => {
    element.setAttribute("viewBox", `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`);
    const k = scale();
    element.style.setProperty("--k", k.toFixed(4));
    // 駅の丸も寄ったぶんだけ小さくして、画面上の大きさを保つ
    for (const { dot, r } of dots) dot.setAttribute("r", (r * Math.max(k, 0.5)).toFixed(2));
    marker.setScale(k);
  };

  const zoomTo = (target: ViewBox) => {
    if (frame !== null) cancelAnimationFrame(frame);
    const from = { ...view };
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
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
      frame = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frame = requestAnimationFrame(tick);
  };

  /** 点の集まりが収まる、地図と同じ縦横比の表示範囲 */
  const fit = (points: readonly Point[]): ViewBox => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const aspect = fullView.width / fullView.height;
    let width = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.4, SHINKANSEN_MIN_WIDTH);
    let height = Math.max((Math.max(...ys) - Math.min(...ys)) * 1.4, SHINKANSEN_MIN_WIDTH / aspect);
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    width = Math.min(width, fullView.width);
    height = Math.min(height, fullView.height);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { x: cx - width / 2, y: cy - height / 2, width, height };
  };

  /** 駅名を、となりの駅名と重ならない位置 (右・左・上・下) に置く。k は寄ったあとの拡大率 */
  const placeLabels = (ids: readonly string[], k: number, skipId: string | null) => {
    labelLayer.replaceChildren();
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const overlaps = (b: { x: number; y: number; w: number; h: number }) =>
      placed.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
    const size = LABEL_SIZE * k;
    for (const id of ids) {
      const p = map.getStationPoint(id);
      if (id === skipId) {
        // 吹き出しの場所はあけておく
        placed.push({ x: p.x - 40 * k, y: p.y - 80 * k, w: 80 * k, h: 80 * k });
        continue;
      }
      const text = kanaOf.get(id) ?? "";
      const w = text.length * size + size * 0.4;
      const h = size * 1.3;
      const gap = 10 * k;
      const candidates = [
        { x: p.x + gap, y: p.y - h / 2, anchor: "start" },
        { x: p.x - gap - w, y: p.y - h / 2, anchor: "end" },
        { x: p.x - w / 2, y: p.y + gap, anchor: "middle" },
        { x: p.x - w / 2, y: p.y - gap - h, anchor: "middle" },
      ];
      const spot = candidates.find((c) => !overlaps({ x: c.x, y: c.y, w, h }));
      if (!spot) continue;
      placed.push({ x: spot.x, y: spot.y, w, h });
      const x = spot.anchor === "start" ? spot.x : spot.anchor === "end" ? spot.x + w : spot.x + w / 2;
      const label = svg("text", {
        class: "quiz-label",
        x: x.toFixed(1),
        y: (spot.y + h / 2 + size * 0.36).toFixed(1),
        "text-anchor": spot.anchor,
      });
      label.textContent = text;
      labelLayer.append(label);
    }
  };

  const lineStations = (lineId: string) => shinkansenLines.find((l) => l.id === lineId)?.stationIds ?? [];

  return {
    element,
    show(v) {
      marker.hide();
      let target: ViewBox;
      if (v.kind === "gap") {
        map.highlightRoute(v.stationIds, [v.lineId as LineId]);
        target = fit(v.stationIds.map(map.getStationPoint));
        placeLabels(v.stationIds, target.width / fullView.width, v.hiddenId);
        marker.show(map.getStationPoint(v.hiddenId), "？");
      } else if (v.kind === "line") {
        const ids = lineStations(v.lineId);
        map.highlightLines([v.lineId as LineId]);
        target = fit(ids.map(map.getStationPoint));
        placeLabels(ids, target.width / fullView.width, null);
      } else {
        map.highlightLines(null);
        const p = map.getStationPoint(v.stationId);
        const r = SHINKANSEN_FOCUS_RADIUS;
        target = fit([
          { x: p.x - r, y: p.y - r },
          { x: p.x + r, y: p.y + r },
        ]);
        placeLabels([v.stationId], target.width / fullView.width, v.stationId);
        marker.show(p, "ここ");
      }
      zoomTo(target);
    },
    reveal(v, answerLabel) {
      if (v.kind === "gap") marker.show(map.getStationPoint(v.hiddenId), answerLabel, true);
    },
  };
}

export const createQuizMap = (genre: Genre): QuizMap => (genre === "shinkansen" ? shinkansenQuizMap() : denshaQuizMap());
