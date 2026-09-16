import type { Train } from "../data/types";

/** 車種ごとにデフォルメしたノーズ形状 */
export type NoseShape =
  /** 長くなだらかなノーズ (E5/H5/E6) */
  | "long"
  /** カモノハシ (N700系一族・923形) */
  | "platypus"
  /** まるくとがった弾丸 (500系) */
  | "bullet"
  /** まるみのある短いノーズ (800系) */
  | "rounded"
  /** ずんぐりしたノーズ (E7/W7) */
  | "blunt"
  /** 短くとがったノーズ (E8) */
  | "short";

export interface TrainSvgOptions {
  /** full: 先頭車+中間車 / icon: 先頭車のみ (アニメ用) */
  variant?: "full" | "icon";
}

interface NoseSpec {
  /** ノーズの付け根の x 座標 (先端は x≒10、ここから右が平らな車体) */
  length: number;
  /** 上側の付け根 (length, TOP) から先端を通り 下端 (y=BOTTOM) に至るパス (始点の M/L は含まない) */
  outline: string;
  /** 運転席の窓 */
  cockpit: string;
  /** ライトの位置 */
  light: { x: number; y: number };
}

const TOP = 24;
const BOTTOM = 76;
const HEAD_END = 210;
const MIDDLE_START = HEAD_END + 6;
const MIDDLE_END = MIDDLE_START + 110;
const STRIPE_Y = 54;
const STRIPE_H = 7;
const OUTLINE = "#333333";
const WINDOW = "#34495e";
const LIGHT = "#fff6b0";

const NOSES: Record<NoseShape, NoseSpec> = {
  long: {
    length: 125,
    outline: "C 80 24, 42 58, 14 71 Q 6 76 16 76",
    cockpit: "M 100 29 Q 82 31 70 40 L 92 39 Z",
    light: { x: 26, y: 70 },
  },
  platypus: {
    length: 100,
    outline: "C 80 24, 74 42, 54 48 L 22 55 Q 8 59 10 67 Q 12 76 24 76",
    cockpit: "M 80 30 Q 70 34 64 42 L 80 40 Z",
    light: { x: 24, y: 60 },
  },
  bullet: {
    length: 125,
    outline: "C 64 24, 22 42, 6 50 C 22 60, 64 76, 125 76",
    cockpit: "M 96 28 Q 76 31 62 38 L 88 38 Z",
    light: { x: 22, y: 52 },
  },
  rounded: {
    length: 62,
    outline: "C 34 24, 14 40, 12 58 Q 12 76 28 76",
    cockpit: "M 50 29 Q 34 32 28 42 L 46 40 Z",
    light: { x: 18, y: 64 },
  },
  blunt: {
    length: 56,
    outline: "C 36 24, 22 30, 18 44 L 13 68 Q 13 76 24 76",
    cockpit: "M 46 28 Q 30 30 24 42 L 42 40 Z",
    light: { x: 18, y: 62 },
  },
  short: {
    length: 85,
    outline: "C 54 26, 30 50, 12 66 Q 6 76 20 76",
    cockpit: "M 66 30 Q 50 32 42 42 L 62 40 Z",
    light: { x: 20, y: 68 },
  },
};

export function noseShapeOf(train: Train): NoseShape {
  const s = train.series;
  if (s.startsWith("N700") || s.startsWith("923")) return "platypus";
  if (s.startsWith("500")) return "bullet";
  if (s.startsWith("800")) return "rounded";
  if (s.startsWith("E5") || s.startsWith("H5") || s.startsWith("E6")) return "long";
  if (s.startsWith("E7") || s.startsWith("W7")) return "blunt";
  if (s.startsWith("E8")) return "short";
  throw new Error(`nose shape is not defined for series: ${s}`);
}

let clipSeq = 0;

/** 横向き (左が先頭) の新幹線イラスト SVG 文字列を返す */
export function trainSvg(train: Train, options: TrainSvgOptions = {}): string {
  const variant = options.variant ?? "full";
  const { body, stripe, accent } = train.colors;
  const nose = NOSES[noseShapeOf(train)];
  const clipId = `train-clip-${++clipSeq}`;

  const headPath = `M ${HEAD_END} ${TOP} L ${nose.length} ${TOP} ${nose.outline} L ${HEAD_END} ${BOTTOM} Z`;
  const head = [
    `<g data-car="head">`,
    `<clipPath id="${clipId}"><path d="${headPath}"/></clipPath>`,
    `<path class="body" d="${headPath}" fill="${body}"/>`,
    `<g clip-path="url(#${clipId})">`,
    `<rect x="0" y="${STRIPE_Y}" width="${HEAD_END}" height="${STRIPE_H}" fill="${stripe}"/>`,
    `<rect x="0" y="${STRIPE_Y + STRIPE_H}" width="${HEAD_END}" height="4" fill="${accent}"/>`,
    `</g>`,
    `<path d="${headPath}" fill="none" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<path d="${nose.cockpit}" fill="${WINDOW}"/>`,
    `<ellipse cx="${nose.light.x}" cy="${nose.light.y}" rx="4" ry="2.5" fill="${LIGHT}" stroke="${OUTLINE}" stroke-width="1"/>`,
    windows(Math.max(nose.length + 12, 100), HEAD_END - 10),
    wheels(Math.max(nose.length, 60), HEAD_END),
    `</g>`,
  ].join("");

  const middle =
    variant === "full"
      ? [
          `<g data-car="middle">`,
          `<rect class="body" x="${MIDDLE_START}" y="${TOP}" width="${MIDDLE_END - MIDDLE_START}" height="${BOTTOM - TOP}" rx="6" fill="${body}"/>`,
          `<rect x="${MIDDLE_START + 1}" y="${STRIPE_Y}" width="${MIDDLE_END - MIDDLE_START - 2}" height="${STRIPE_H}" fill="${stripe}"/>`,
          `<rect x="${MIDDLE_START + 1}" y="${STRIPE_Y + STRIPE_H}" width="${MIDDLE_END - MIDDLE_START - 2}" height="4" fill="${accent}"/>`,
          `<rect x="${MIDDLE_START}" y="${TOP}" width="${MIDDLE_END - MIDDLE_START}" height="${BOTTOM - TOP}" rx="6" fill="none" stroke="${OUTLINE}" stroke-width="2.5"/>`,
          windows(MIDDLE_START + 12, MIDDLE_END - 10),
          wheels(MIDDLE_START, MIDDLE_END),
          `</g>`,
        ].join("")
      : "";

  const width = (variant === "full" ? MIDDLE_END : HEAD_END) + 6;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 16 ${width} 78" role="img" aria-label="${train.nickname}">`,
    `<rect x="0" y="89" width="${width}" height="3" fill="#9aa5b1"/>`,
    head,
    middle,
    `</svg>`,
  ].join("");
}

function windows(from: number, to: number): string {
  const rects: string[] = [];
  for (let x = from; x + 14 <= to; x += 22) {
    rects.push(`<rect x="${x}" y="34" width="14" height="10" rx="3" fill="${WINDOW}"/>`);
  }
  return rects.join("");
}

function wheels(from: number, to: number): string {
  return [from + 26, to - 26]
    .map((cx) => `<circle cx="${cx}" cy="82" r="6" fill="#555555" stroke="${OUTLINE}" stroke-width="1.5"/>`)
    .join("");
}
