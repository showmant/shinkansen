import type { TrainShape, Vehicle } from "../types";

export interface DenshaSvgOptions {
  /** full: 先頭車+中間車 / icon: 先頭車のみ (地図を走るアイコン) */
  variant?: "full" | "icon";
  /** 読み上げ・代替テキスト */
  label?: string;
}

const TOP = 26;
const BOTTOM = 76;
const OUTLINE = "#333333";
const WINDOW = "#34495e";
const GLASS = "#5d7894";
const LIGHT = "#fff6b0";
const DOOR = "#b9c0c7";

interface Front {
  /** 前面の輪郭。左上 (x, TOP) の付け根から時計回りに左下 (x, BOTTOM) までの、先頭部分だけのパス */
  outline: string;
  /** 平らな車体が始まる x */
  base: number;
  /** 前面の窓 */
  windshield: string;
  light: { x: number; y: number };
}

const FRONTS: Record<TrainShape, Front> = {
  flat: {
    base: 22,
    outline: "M 22 26 L 16 26 Q 10 26 10 32 L 10 70 Q 10 76 16 76 L 22 76",
    windshield: "M 12 32 L 28 32 L 28 50 L 12 50 Z",
    light: { x: 16, y: 62 },
  },
  slant: {
    base: 34,
    outline: "M 34 26 L 26 26 Q 18 26 15 34 L 8 66 Q 7 76 16 76 L 34 76",
    windshield: "M 22 31 L 38 31 L 38 50 L 13 50 Z",
    light: { x: 14, y: 64 },
  },
  round: {
    base: 60,
    outline: "M 60 26 C 26 26 8 40 8 60 Q 8 76 24 76 L 60 76",
    windshield: "M 52 31 C 34 32 20 38 15 52 L 52 52 Z",
    light: { x: 16, y: 66 },
  },
  nose: {
    base: 78,
    outline: "M 78 26 C 52 26 30 38 12 58 Q 4 68 10 74 Q 12 76 20 76 L 78 76",
    windshield: "M 70 31 C 56 32 44 38 34 48 L 70 48 Z",
    light: { x: 16, y: 68 },
  },
  observation: {
    base: 70,
    outline: "M 70 26 L 70 18 Q 70 14 64 14 L 54 14 C 40 18 22 34 10 58 Q 6 68 10 74 Q 12 76 20 76 L 70 76",
    windshield: "M 50 18 C 38 24 24 38 15 56 L 64 56 L 64 20 Z",
    light: { x: 15, y: 68 },
  },
  tram: {
    base: 26,
    outline: "M 26 26 Q 12 26 11 38 L 10 68 Q 10 76 18 76 L 26 76",
    windshield: "M 13 33 L 30 33 L 30 52 L 12 52 Z",
    light: { x: 16, y: 64 },
  },
  monorail: {
    base: 44,
    outline: "M 44 26 C 22 26 10 36 9 54 L 9 78 Q 9 84 16 84 L 44 84",
    windshield: "M 40 31 C 26 32 16 38 13 50 L 40 50 Z",
    light: { x: 15, y: 62 },
  },
  suspended: {
    base: 44,
    outline: "M 44 26 C 24 26 12 36 10 52 Q 9 76 30 76 L 44 76",
    windshield: "M 40 31 C 26 32 17 38 14 50 L 40 50 Z",
    light: { x: 18, y: 64 },
  },
};

let clipSeq = 0;

/** 横向き (左が先頭) の電車イラスト SVG 文字列。路線カラーの帯が分かる通勤電車デフォルメ */
export function denshaSvg(vehicle: Vehicle, options: DenshaSvgOptions = {}): string {
  const variant = options.variant ?? "full";
  const { shape, colors } = vehicle;
  const front = FRONTS[shape];
  const isTram = shape === "tram";
  const isMonorail = shape === "monorail";
  const isSuspended = shape === "suspended";
  const bottom = isMonorail ? 84 : BOTTOM;
  const headEnd = isTram ? 150 : 200;
  const middleStart = headEnd + 6;
  const middleEnd = middleStart + (isTram ? 100 : 120);
  const width = (variant === "full" ? middleEnd : headEnd) + 8;
  const clipId = `densha-clip-${++clipSeq}`;
  const stripeY = isTram ? 56 : 54;
  /** 特急・路面電車は窓をひと続きに描き、通勤電車は扉と窓を交互に描く */
  const continuous = isTram || shape === "observation" || shape === "nose";

  const headPath = `${front.outline} L ${headEnd} ${bottom} L ${headEnd} ${TOP} Z`;
  const paint = (clip: string, from: number, to: number, withFront: boolean) =>
    [
      colors.lower ? `<rect x="0" y="54" width="${to}" height="${bottom - 54}" fill="${colors.lower}" clip-path="url(#${clip})"/>` : "",
      `<rect x="${from}" y="${stripeY}" width="${to - from}" height="6" fill="${colors.stripe}" clip-path="url(#${clip})"/>`,
      `<rect x="${from}" y="${stripeY + 6}" width="${to - from}" height="3" fill="${colors.accent}" clip-path="url(#${clip})"/>`,
      `<rect x="${from}" y="${TOP}" width="${to - from}" height="4" fill="${colors.accent}" clip-path="url(#${clip})"/>`,
      withFront && colors.front
        ? `<path d="${front.outline} L ${front.base + 6} ${bottom} L ${front.base + 6} ${TOP} Z" fill="${colors.front}" opacity="0.9"/>`
        : "",
    ].join("");

  const headClip = `${clipId}-h`;
  const head = [
    `<g data-car="head">`,
    `<clipPath id="${headClip}"><path d="${headPath}"/></clipPath>`,
    `<path d="${headPath}" fill="${colors.body}"/>`,
    paint(headClip, 0, headEnd, true),
    `<path d="${front.windshield}" fill="${GLASS}" stroke="${OUTLINE}" stroke-width="1.5" stroke-linejoin="round"/>`,
    `<path d="${headPath}" fill="none" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<ellipse cx="${front.light.x}" cy="${front.light.y}" rx="3.5" ry="2.5" fill="${LIGHT}" stroke="${OUTLINE}" stroke-width="1"/>`,
    sideWindows(front.base + 12, headEnd - 8, continuous),
    continuous ? "" : doors(front.base + 12, headEnd - 12, bottom),
    running(front.base, headEnd, vehicle),
    `</g>`,
  ].join("");

  const midClip = `${clipId}-m`;
  const midPath = `M ${middleStart + 6} ${TOP} L ${middleEnd - 6} ${TOP} Q ${middleEnd} ${TOP} ${middleEnd} ${TOP + 6} L ${middleEnd} ${bottom - 6} Q ${middleEnd} ${bottom} ${middleEnd - 6} ${bottom} L ${middleStart + 6} ${bottom} Q ${middleStart} ${bottom} ${middleStart} ${bottom - 6} L ${middleStart} ${TOP + 6} Q ${middleStart} ${TOP} ${middleStart + 6} ${TOP} Z`;
  const middle =
    variant === "full"
      ? [
          `<g data-car="middle">`,
          `<clipPath id="${midClip}"><path d="${midPath}"/></clipPath>`,
          `<path d="${midPath}" fill="${colors.body}"/>`,
          paint(midClip, middleStart, middleEnd, false),
          `<path d="${midPath}" fill="none" stroke="${OUTLINE}" stroke-width="2.5"/>`,
          sideWindows(middleStart + 12, middleEnd - 10, continuous),
          continuous ? "" : doors(middleStart + 12, middleEnd - 12, bottom),
          running(middleStart, middleEnd, vehicle),
          `</g>`,
        ].join("")
      : "";

  const top = isSuspended ? 0 : 6;
  const label = escapeXml(options.label ?? vehicle.series);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top} ${width} ${96 - top}" role="img" aria-label="${label}">`,
    ground(width, vehicle),
    head,
    middle,
    `</svg>`,
  ].join("");
}

function sideWindows(from: number, to: number, continuous: boolean): string {
  if (continuous) {
    return to - from > 20 ? `<rect x="${from}" y="33" width="${to - from}" height="14" rx="4" fill="${WINDOW}"/>` : "";
  }
  const rects: string[] = [];
  for (let x = from; x + 32 <= to; x += 40) {
    rects.push(`<rect x="${x + 16}" y="33" width="16" height="13" rx="2" fill="${WINDOW}"/>`);
  }
  return rects.join("");
}

function doors(from: number, to: number, bottom: number): string {
  const rects: string[] = [];
  for (let x = from; x + 12 <= to; x += 40) {
    rects.push(
      `<rect x="${x}" y="32" width="12" height="${bottom - 36}" rx="1.5" fill="none" stroke="${DOOR}" stroke-width="1.5"/>`,
      `<rect x="${x + 2}" y="35" width="8" height="10" rx="1" fill="${WINDOW}"/>`,
    );
  }
  return rects.join("");
}

/** 車輪・パンタグラフ・モノレールの台車 */
function running(from: number, to: number, vehicle: Vehicle): string {
  const { shape } = vehicle;
  if (shape === "monorail") return "";
  if (shape === "suspended") {
    return [from + 30, to - 30]
      .map((x) => `<rect x="${x - 5}" y="12" width="10" height="15" fill="#6b7580" stroke="${OUTLINE}" stroke-width="1.5"/>`)
      .join("");
  }
  const wheels = [from + 22, from + 40, to - 40, to - 22]
    .map((cx) => `<circle cx="${cx}" cy="81" r="5" fill="#555555" stroke="${OUTLINE}" stroke-width="1.5"/>`)
    .join("");
  const pantoX = (from + to) / 2;
  const pantograph = `<path d="M ${pantoX - 14} 26 L ${pantoX} 14 L ${pantoX + 10} 14 M ${pantoX - 4} 14 L ${pantoX + 14} 14" fill="none" stroke="${OUTLINE}" stroke-width="2" stroke-linecap="round"/>`;
  return pantograph + wheels;
}

function ground(width: number, vehicle: Vehicle): string {
  if (vehicle.shape === "monorail") {
    return `<rect x="0" y="84" width="${width}" height="12" rx="2" fill="#b5bcc4" stroke="#8a939c" stroke-width="1"/>`;
  }
  if (vehicle.shape === "suspended") {
    return `<rect x="0" y="0" width="${width}" height="12" rx="2" fill="#b5bcc4" stroke="#8a939c" stroke-width="1"/>`;
  }
  return `<rect x="0" y="87" width="${width}" height="3" fill="#9aa5b1"/>`;
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
