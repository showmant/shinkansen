import { runDuration, startRun, type FrameScheduler } from "./animation";
import { lines } from "./data/lines";
import { stations } from "./data/stations";
import { trains } from "./data/trains";
import type { Line, LineId, Train } from "./data/types";
import { createJapanMap, type JapanMap } from "./map/map";
import { buildRoute, trainsOnLine } from "./route";
import { emphasizeTrains, onTrainSelect, renderCards, setSelectedTrain } from "./trains/cards";
import { trainSvg } from "./trains/illustration";

const SVG_NS = "http://www.w3.org/2000/svg";
/** 地図上を走る車両アイコンの大きさ (SVG 座標) */
const RUNNER_WIDTH = 96;
const RUNNER_HEIGHT = (RUNNER_WIDTH * 78) / 216;

export type Selection = { kind: "none" } | { kind: "train"; trainId: string } | { kind: "line"; lineId: LineId };
export type SelectionAction =
  | { type: "selectTrain"; trainId: string }
  | { type: "selectLine"; lineId: LineId }
  | { type: "clear" };

type Unsubscribe = () => void;

/** 後続の音 issue などが購読するイベント口 */
export interface App {
  onTrainStart(cb: (train: Train) => void): Unsubscribe;
  onTrainArrive(cb: (train: Train) => void): Unsubscribe;
  onLineSelect(cb: (line: Line) => void): Unsubscribe;
  /** リスナー解除と走行停止 */
  destroy(): void;
}

export interface AppOptions {
  scheduler?: FrameScheduler;
}

/** 選択状態の遷移。選択中のものをもう一度選ぶと解除 */
export function reduceSelection(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case "selectTrain":
      return state.kind === "train" && state.trainId === action.trainId
        ? { kind: "none" }
        : { kind: "train", trainId: action.trainId };
    case "selectLine":
      return state.kind === "line" && state.lineId === action.lineId
        ? { kind: "none" }
        : { kind: "line", lineId: action.lineId };
    case "clear":
      return { kind: "none" };
  }
}

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

const findById = <T extends { id: string }>(items: readonly T[], id: string): T => {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error(`unknown id: ${id}`);
  return item;
};

/** root に タイトル・地図・選択中の情報・カード一覧 を描画し、操作を結線する */
export function createApp(root: HTMLElement, options: AppOptions = {}): App {
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "しんかんせん ちず";

  const map = createJapanMap();
  const runner = createRunner(map);

  const info = document.createElement("section");
  info.className = "train-info";
  info.setAttribute("aria-live", "polite");

  const cards = document.createElement("section");
  cards.setAttribute("aria-label", "しんかんせん いちらん");
  renderCards(cards, trains);

  const side = document.createElement("div");
  side.className = "side";
  side.append(info, cards);

  const layout = document.createElement("main");
  layout.className = "layout";
  layout.append(map.element, side);
  root.append(title, layout);

  const trainStart = emitter<Train>();
  const trainArrive = emitter<Train>();
  const lineSelect = emitter<Line>();

  let selection: Selection = { kind: "none" };
  let cancelRun: (() => void) | null = null;

  const stopRun = () => {
    cancelRun?.();
    cancelRun = null;
    runner.hide();
  };

  const run = (train: Train, route: readonly string[]) => {
    const points = route.map((id) => map.getStationPoint(id));
    runner.show(train);
    trainStart.emit(train);
    cancelRun = startRun({
      points,
      duration: runDuration(points),
      scheduler: options.scheduler,
      onFrame: (pos) => runner.moveTo(pos.x, pos.y, pos.facing),
      onArrive: () => {
        cancelRun = null;
        runner.arrive();
        trainArrive.emit(train);
      },
    });
  };

  const dispatch = (action: SelectionAction) => {
    selection = reduceSelection(selection, action);
    stopRun();
    switch (selection.kind) {
      case "none":
        map.highlightLines(null);
        setSelectedTrain(null);
        emphasizeTrains(null);
        renderIdleInfo(info);
        break;
      case "train": {
        const train = findById(trains, selection.trainId);
        const route = buildRoute(train, lines);
        map.highlightRoute(route, train.lineIds);
        setSelectedTrain(train.id);
        emphasizeTrains(null);
        renderTrainInfo(info, train);
        run(train, route);
        break;
      }
      case "line": {
        const line = findById(lines, selection.lineId);
        map.highlightLines([line.id]);
        setSelectedTrain(null);
        emphasizeTrains(trainsOnLine(line.id, trains));
        renderLineInfo(info, line);
        lineSelect.emit(line);
        break;
      }
    }
  };

  renderIdleInfo(info);

  const offTrain = onTrainSelect((trainId) => dispatch({ type: "selectTrain", trainId }));
  const offLine = map.onLineClick((lineId) => dispatch({ type: "selectLine", lineId }));
  const onMapClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest(".map-line")) return;
    if (selection.kind !== "none") dispatch({ type: "clear" });
  };
  map.element.addEventListener("click", onMapClick);

  return {
    onTrainStart: trainStart.on,
    onTrainArrive: trainArrive.on,
    onLineSelect: lineSelect.on,
    destroy() {
      stopRun();
      offTrain();
      offLine();
      map.element.removeEventListener("click", onMapClick);
    },
  };
}

/** 地図上を走る車両アイコン。外側で位置、内側で左右反転、最内側で到着時のジャンプ */
function createRunner(map: JapanMap) {
  const group = document.createElementNS(SVG_NS, "g");
  group.classList.add("map-runner", "is-hidden");
  const flip = document.createElementNS(SVG_NS, "g");
  const hop = document.createElementNS(SVG_NS, "g");
  hop.classList.add("map-runner__hop");
  flip.append(hop);
  group.append(flip);
  map.element.append(group);

  return {
    show(train: Train) {
      hop.innerHTML = trainSvg(train, { variant: "icon" });
      const icon = hop.querySelector("svg");
      icon?.setAttribute("x", String(-RUNNER_WIDTH / 2));
      icon?.setAttribute("y", String(-RUNNER_HEIGHT + 6));
      icon?.setAttribute("width", String(RUNNER_WIDTH));
      icon?.setAttribute("height", String(RUNNER_HEIGHT));
      group.classList.remove("is-hidden", "is-arrived");
    },
    moveTo(x: number, y: number, facing: "left" | "right") {
      group.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (facing === "right") flip.setAttribute("transform", "scale(-1 1)");
      else flip.removeAttribute("transform");
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

const stationKana = (id: string) => findById(stations, id).kana;

function renderIdleInfo(info: HTMLElement) {
  const hint = document.createElement("p");
  hint.className = "train-info__hint";
  hint.textContent = "しんかんせん を えらんでね";
  info.replaceChildren(hint);
}

function renderTrainInfo(info: HTMLElement, train: Train) {
  const illustration = document.createElement("div");
  illustration.className = "train-info__illustration";
  illustration.innerHTML = trainSvg(train);

  const text = document.createElement("div");
  text.className = "train-info__text";
  const heading = document.createElement("p");
  heading.className = "train-info__title";
  heading.textContent = `${train.kana} / ${stationKana(train.from)} → ${stationKana(train.to)}`;
  const fact = document.createElement("p");
  fact.className = "train-info__fact";
  fact.textContent = train.fact;
  text.append(heading, fact);

  info.replaceChildren(illustration, text);
}

function renderLineInfo(info: HTMLElement, line: Line) {
  const text = document.createElement("div");
  text.className = "train-info__text train-info__text--line";
  text.style.setProperty("--line-color", line.color);
  const heading = document.createElement("p");
  heading.className = "train-info__title";
  heading.textContent = line.kana;
  const hint = document.createElement("p");
  hint.className = "train-info__fact";
  hint.textContent = "ひかっている しんかんせん が はしるよ";
  text.append(heading, hint);
  info.replaceChildren(text);
}
