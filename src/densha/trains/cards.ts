import type { LimitedExpress, RailLine } from "../types";
import { denshaSvg } from "./illustration";

/** カードの識別子 */
export type CardKey = `line:${string}` | `express:${string}`;

export interface CardGroup {
  id: string;
  /** タブの文字 */
  label: string;
  /** タブの色 */
  color: string;
  keys: readonly CardKey[];
}

export interface CardPanel {
  element: HTMLElement;
  onSelect(cb: (key: CardKey) => void): () => void;
  /** 枠が光る選択状態。null で解除 */
  setSelected(key: CardKey | null): void;
  /** 指定カードを強調して、そのカードがあるタブを開く。null で解除 */
  emphasize(keys: readonly CardKey[] | null): void;
}

/** これより長いひらがなは文字を小さくする */
const LONG_KANA = 7;

export const lineKey = (id: string): CardKey => `line:${id}`;
export const expressKey = (id: string): CardKey => `express:${id}`;

/** 会社ごとのタブ + カード一覧 */
export function createCardPanel(
  groups: readonly CardGroup[],
  lines: readonly RailLine[],
  expresses: readonly LimitedExpress[],
): CardPanel {
  const element = document.createElement("section");
  element.className = "densha-cards";
  element.setAttribute("aria-label", "でんしゃ いちらん");

  const tabs = document.createElement("div");
  tabs.className = "densha-tabs";
  tabs.setAttribute("role", "tablist");
  const grid = document.createElement("div");
  grid.className = "densha-card-grid";
  grid.setAttribute("role", "tabpanel");
  element.append(tabs, grid);

  const listeners = new Set<(key: CardKey) => void>();
  const cards = new Map<CardKey, HTMLButtonElement>();
  const make = (key: CardKey) => {
    const existing = cards.get(key);
    if (existing) return existing;
    const [kind, id] = key.split(":") as ["line" | "express", string];
    const card =
      kind === "line"
        ? createLineCard(lines.find((l) => l.id === id))
        : createExpressCard(expresses.find((e) => e.id === id));
    card.dataset.cardKey = key;
    card.addEventListener("click", () => listeners.forEach((cb) => cb(key)));
    cards.set(key, card);
    return card;
  };

  let activeGroup = groups[0]?.id ?? "";
  let selected: CardKey | null = null;
  let emphasized: Set<CardKey> | null = null;
  const tabButtons = new Map<string, HTMLButtonElement>();

  const render = () => {
    const group = groups.find((g) => g.id === activeGroup) ?? groups[0];
    if (!group) return;
    for (const [id, button] of tabButtons) button.setAttribute("aria-selected", String(id === group.id));
    grid.replaceChildren(...group.keys.map(make));
    grid.scrollTop = 0;
    refresh();
  };

  const refresh = () => {
    for (const [key, card] of cards) {
      const isSelected = key === selected;
      card.classList.toggle("is-selected", isSelected);
      card.setAttribute("aria-pressed", String(isSelected));
      const isEmphasized = emphasized?.has(key) ?? false;
      card.classList.toggle("is-emphasized", isEmphasized);
      card.classList.toggle("is-dimmed", emphasized !== null && !isEmphasized);
    }
  };

  for (const group of groups) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "densha-tab";
    button.setAttribute("role", "tab");
    button.style.setProperty("--tab-color", group.color);
    button.textContent = group.label;
    button.addEventListener("click", () => {
      activeGroup = group.id;
      render();
    });
    tabButtons.set(group.id, button);
    tabs.append(button);
  }
  render();

  return {
    element,
    onSelect(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    setSelected(key) {
      selected = key;
      refresh();
    },
    emphasize(keys) {
      emphasized = keys ? new Set(keys) : null;
      if (keys && keys.length > 0) {
        const current = groups.find((g) => g.id === activeGroup);
        if (!current?.keys.includes(keys[0])) {
          // 路線カードがあるタブ (会社のタブを優先) を開く
          const target =
            groups.find((g) => g.id !== "machida" && g.id !== "express" && g.keys.includes(keys[0])) ??
            groups.find((g) => g.keys.includes(keys[0]));
          if (target) {
            activeGroup = target.id;
            render();
          }
        }
        cards.get(keys[0])?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      refresh();
    },
  };
}

function baseCard(className: string, color: string, svg: string, kana: string, sub: string): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = className;
  card.setAttribute("aria-pressed", "false");
  card.style.setProperty("--card-color", color);

  const illustration = document.createElement("div");
  illustration.className = "densha-card__illustration";
  illustration.innerHTML = svg;

  const kanaEl = document.createElement("span");
  kanaEl.className = "densha-card__kana";
  kanaEl.textContent = kana;
  if (kana.length > LONG_KANA) kanaEl.classList.add("densha-card__kana--long");

  const subEl = document.createElement("span");
  subEl.className = "densha-card__sub";
  subEl.textContent = sub;

  card.append(illustration, kanaEl, subEl);
  return card;
}

function createLineCard(line: RailLine | undefined): HTMLButtonElement {
  if (!line) throw new Error("unknown line card");
  return baseCard(
    "densha-card",
    line.color,
    denshaSvg(line.vehicle, { label: `${line.name} ${line.vehicle.series}` }),
    line.kana,
    `${line.name}・${line.vehicle.series}`,
  );
}

function createExpressCard(express: LimitedExpress | undefined): HTMLButtonElement {
  if (!express) throw new Error("unknown express card");
  const card = baseCard(
    "densha-card densha-card--express",
    isLight(express.vehicle.colors.body) ? express.vehicle.colors.stripe : express.vehicle.colors.body,
    denshaSvg(express.vehicle, { label: `${express.name} ${express.vehicle.series}` }),
    express.kana,
    `${express.name}・${express.vehicle.series}`,
  );
  const badge = document.createElement("span");
  badge.className = "densha-card__badge";
  badge.textContent = "とっきゅう";
  card.prepend(badge);
  return card;
}

/** 白っぽい色か (白い車体の特急は帯の色でカードを縁取る) */
function isLight(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 190;
}
