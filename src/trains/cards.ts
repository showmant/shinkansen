import type { Train } from "../data/types";
import { trainSvg } from "./illustration";

/** これより長い愛称はカード幅に収まるよう文字を小さくする */
const LONG_KANA = 6;

type TrainSelectListener = (trainId: string) => void;

let cards = new Map<string, HTMLButtonElement>();
const listeners = new Set<TrainSelectListener>();

/** container に全車両のカードを描画する (再描画時は中身を置き換える) */
export function renderCards(container: HTMLElement, trains: readonly Train[]): void {
  cards = new Map(trains.map((train) => [train.id, createCard(train)]));
  container.classList.add("train-cards");
  container.replaceChildren(...cards.values());
}

/** カードがクリックされたときに呼ばれる。戻り値で登録解除 */
export function onTrainSelect(cb: TrainSelectListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** 選択状態 (枠が光る) を切り替える。null で解除。onTrainSelect は発火しない */
export function setSelectedTrain(id: string | null): void {
  for (const [trainId, card] of cards) {
    const selected = trainId === id;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  }
}

/** 指定したカードを強調し、それ以外を控えめにする。null で解除 */
export function emphasizeTrains(ids: readonly string[] | null): void {
  const targets = ids ? new Set(ids) : null;
  for (const [trainId, card] of cards) {
    const emphasized = targets?.has(trainId) ?? false;
    card.classList.toggle("is-emphasized", emphasized);
    card.classList.toggle("is-dimmed", targets !== null && !emphasized);
  }
}

function createCard(train: Train): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "train-card";
  card.dataset.trainId = train.id;
  card.setAttribute("aria-pressed", "false");
  card.style.setProperty("--train-color", train.colors.stripe);

  const illustration = document.createElement("div");
  illustration.className = "train-card__illustration";
  illustration.innerHTML = trainSvg(train);

  const kana = document.createElement("span");
  kana.className = "train-card__kana";
  kana.textContent = train.kana;
  if (train.kana.length > LONG_KANA) kana.classList.add("train-card__kana--long");

  const series = document.createElement("span");
  series.className = "train-card__series";
  series.textContent = train.series;

  card.append(illustration, kana, series);
  card.addEventListener("click", () => {
    setSelectedTrain(train.id);
    listeners.forEach((cb) => cb(train.id));
  });
  return card;
}
