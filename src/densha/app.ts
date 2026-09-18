import { startRun } from "../animation";
import type { Point } from "../map/projection";
import type { Speech } from "../sound/voices";
import { expressRoute, passesHome, buildCardGroups } from "./data/groups";
import { createDenshaMap, type DenshaMap } from "./map/map";
import { arrivalSpeech, expressSpeech, lineNameSpeech, lineSpeech } from "./speech";
import { createCardPanel, expressKey, lineKey, type CardKey } from "./trains/cards";
import { denshaSvg } from "./trains/illustration";
import type { LimitedExpress, RailLine, Vehicle } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
/** 地図上を走る車両アイコンの大きさ (全体表示のときの SVG 座標) */
const RUNNER_WIDTH = 64;
/** 走行時間 (ms): 長い路線ほどゆっくり、でも待たせすぎない */
const MIN_RUN_MS = 3500;
const MAX_RUN_MS = 8000;
const MS_PER_UNIT = 40;
/** アイコンの向きを変えるのに必要な横移動 (画面上の SVG 座標)。細かい曲がりでパタパタしないように */
const FLIP_DISTANCE = 6;

type Unsubscribe = () => void;

/** 音の結線口 (読み上げる文を渡す) */
export interface DenshaApp {
  onRunStart(cb: (speech: Speech) => void): Unsubscribe;
  onRunArrive(cb: (speech: Speech) => void): Unsubscribe;
  onLineSelect(cb: (speech: Speech) => void): Unsubscribe;
  onRunStop(cb: () => void): Unsubscribe;
}

type Selection = { kind: "none" } | { kind: "card"; key: CardKey } | { kind: "mapLine"; lineId: string };

function emitter<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    on(cb: (value: T) => void): Unsubscribe {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emit(value: T) {
      listeners.forEach((cb) => cb(value));
    },
  };
}

export interface DenshaAppData {
  lines: readonly RailLine[];
  expresses: readonly LimitedExpress[];
}

/** root に タイトル・地図・情報・タブつきカード一覧 を描画し、操作を結線する */
export function createDenshaApp(root: HTMLElement, { lines, expresses }: DenshaAppData): DenshaApp {
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "でんしゃ ちず";

  const map = createDenshaMap(lines);
  const runner = createRunner(map);

  const info = document.createElement("section");
  info.className = "train-info";
  info.setAttribute("aria-live", "polite");

  const panel = createCardPanel(buildCardGroups(lines, expresses), lines, expresses);

  const mapFrame = document.createElement("div");
  mapFrame.className = "densha-map-frame";
  mapFrame.append(map.element);

  const side = document.createElement("div");
  side.className = "side";
  side.append(info, panel.element);

  const layout = document.createElement("main");
  layout.className = "layout densha-layout";
  layout.append(mapFrame, side);
  root.append(title, layout);

  const runStart = emitter<Speech>();
  const runArrive = emitter<Speech>();
  const lineSelect = emitter<Speech>();
  const runStop = emitter<void>();

  let selection: Selection = { kind: "none" };
  let cancelRun: (() => void) | null = null;

  const stopRun = () => {
    if (cancelRun) {
      cancelRun();
      cancelRun = null;
      runStop.emit();
    }
    runner.hide();
  };

  const run = (vehicle: Vehicle, points: readonly Point[], start: Speech, fact: string) => {
    runner.show(vehicle, points[0]);
    runStart.emit(start);
    const length = points.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)), 0);
    // 寄ったあと (ズーム完了後) に走り出す
    const delay = window.setTimeout(() => {
      cancelRun = startRun({
        points,
        duration: Math.min(Math.max(length * MS_PER_UNIT * map.scale(), MIN_RUN_MS), MAX_RUN_MS),
        onFrame: (pos) => runner.moveTo(pos),
        onArrive: () => {
          cancelRun = null;
          runner.arrive();
          runArrive.emit(arrivalSpeech(start.voice, fact));
        },
      });
    }, 700);
    cancelRun = () => window.clearTimeout(delay);
  };

  const lineById = (id: string) => {
    const line = lines.find((l) => l.id === id);
    if (!line) throw new Error(`unknown line: ${id}`);
    return line;
  };

  const expressesOn = (lineId: string) =>
    expresses.filter((e) => e.lineIds.includes(lineId)).map((e) => expressKey(e.id));

  const select = (next: Selection) => {
    const same =
      (next.kind === "card" && selection.kind === "card" && next.key === selection.key) ||
      (next.kind === "mapLine" && selection.kind === "mapLine" && next.lineId === selection.lineId);
    selection = same ? { kind: "none" } : next;
    stopRun();

    if (selection.kind === "none") {
      map.highlightLines(null);
      panel.setSelected(null);
      panel.emphasize(null);
      renderIdleInfo(info);
      return;
    }
    if (selection.kind === "mapLine") {
      const line = lineById(selection.lineId);
      map.highlightLines([line.id]);
      panel.setSelected(null);
      panel.emphasize([lineKey(line.id), ...expressesOn(line.id)]);
      renderInfo(info, line.vehicle, line.kana, `${line.name}`, "ひかっている でんしゃ を えらんでみてね", line.color);
      lineSelect.emit(lineNameSpeech(line));
      return;
    }

    const [kind, id] = selection.key.split(":");
    panel.setSelected(selection.key);
    panel.emphasize(null);
    if (kind === "line") {
      const line = lineById(id);
      map.highlightLines([line.id]);
      const home = passesHome(line.stationIds);
      renderInfo(info, line.vehicle, line.kana, `${line.name}・${line.vehicle.series}`, line.fact, line.color);
      run(line.vehicle, map.routePoints(line.stationIds, [line.id]), lineSpeech(line, home), line.fact);
    } else {
      const express = expresses.find((e) => e.id === id);
      if (!express) throw new Error(`unknown express: ${id}`);
      const route = expressRoute(express, lines);
      const routeOptions = { extendToEdge: express.edgeExit };
      map.highlightRoute(route, express.lineIds, routeOptions);
      renderInfo(
        info,
        express.vehicle,
        express.kana,
        `${express.name}・${express.vehicle.series}`,
        express.fact,
        lineById(express.lineIds[0]).color,
      );
      run(
        express.vehicle,
        map.routePoints(route, express.lineIds, routeOptions),
        expressSpeech(express, passesHome(route)),
        express.fact,
      );
    }
  };

  renderIdleInfo(info);
  panel.onSelect((key) => select({ kind: "card", key }));
  map.onLineClick((lineId) => select({ kind: "mapLine", lineId }));
  map.element.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".densha-line")) return;
    if (selection.kind !== "none") select({ kind: "none" });
  });

  return {
    onRunStart: runStart.on,
    onRunArrive: runArrive.on,
    onLineSelect: lineSelect.on,
    onRunStop: runStop.on,
  };
}

/** 地図上を走る車両アイコン。外側で位置、次にズームに合わせた大きさ、内側で左右反転 */
function createRunner(map: DenshaMap) {
  const group = document.createElementNS(SVG_NS, "g");
  group.classList.add("map-runner", "is-hidden");
  const sizer = document.createElementNS(SVG_NS, "g");
  const flip = document.createElementNS(SVG_NS, "g");
  const hop = document.createElementNS(SVG_NS, "g");
  hop.classList.add("map-runner__hop");
  flip.append(hop);
  sizer.append(flip);
  group.append(sizer);
  map.overlay.append(group);

  let facing: "left" | "right" = "left";
  let anchorX = 0;
  map.onScale((k) => sizer.setAttribute("transform", `scale(${k.toFixed(4)})`));

  const setFacing = (next: "left" | "right") => {
    facing = next;
    if (facing === "right") flip.setAttribute("transform", "scale(-1 1)");
    else flip.removeAttribute("transform");
  };

  return {
    show(vehicle: Vehicle, start: Point | undefined) {
      hop.innerHTML = denshaSvg(vehicle, { variant: "icon" });
      const icon = hop.querySelector("svg");
      const height = (RUNNER_WIDTH * 90) / 208;
      icon?.setAttribute("x", String(-RUNNER_WIDTH / 2));
      icon?.setAttribute("y", String(-height + 4));
      icon?.setAttribute("width", String(RUNNER_WIDTH));
      icon?.setAttribute("height", String(height));
      sizer.setAttribute("transform", `scale(${map.scale().toFixed(4)})`);
      if (start) group.setAttribute("transform", `translate(${start.x.toFixed(1)} ${start.y.toFixed(1)})`);
      anchorX = start?.x ?? 0;
      setFacing("left");
      group.classList.remove("is-hidden", "is-arrived");
    },
    moveTo(pos: Point) {
      group.setAttribute("transform", `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
      // イラストは左向きが基準。ある程度動いた方向に向ける
      const threshold = FLIP_DISTANCE * map.scale();
      if (pos.x > anchorX + threshold) {
        if (facing !== "right") setFacing("right");
        anchorX = pos.x - threshold;
      } else if (pos.x < anchorX - threshold) {
        if (facing !== "left") setFacing("left");
        anchorX = pos.x + threshold;
      }
    },
    arrive() {
      group.classList.add("is-arrived");
    },
    hide() {
      group.classList.add("is-hidden");
      group.classList.remove("is-arrived");
      hop.replaceChildren();
    },
  };
}

function renderIdleInfo(info: HTMLElement) {
  const hint = document.createElement("p");
  hint.className = "train-info__hint";
  hint.textContent = "でんしゃ を えらんでね";
  info.replaceChildren(hint);
}

function renderInfo(info: HTMLElement, vehicle: Vehicle, kana: string, sub: string, fact: string, color: string) {
  const illustration = document.createElement("div");
  illustration.className = "train-info__illustration";
  illustration.innerHTML = denshaSvg(vehicle);

  const text = document.createElement("div");
  text.className = "train-info__text train-info__text--line";
  text.style.setProperty("--line-color", color);
  const heading = document.createElement("p");
  heading.className = "train-info__title";
  heading.textContent = kana;
  const subEl = document.createElement("p");
  subEl.className = "densha-info__sub";
  subEl.textContent = sub;
  const factEl = document.createElement("p");
  factEl.className = "train-info__fact";
  factEl.textContent = fact;
  text.append(heading, subEl, factEl);
  info.replaceChildren(illustration, text);
}
