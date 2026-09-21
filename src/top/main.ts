import "../style.css";
import "./top.css";
import { railLines } from "../densha/data/lines";
import { addVoiceCredit } from "../sound/credit";
import { denshaSvg } from "../densha/trains/illustration";
import { trains } from "../data/trains";
import { trainSvg } from "../trains/illustration";

interface Destination {
  href: string;
  kana: string;
  sub: string;
  svg: string;
  color: string;
}

const hayabusa = trains.find((t) => t.id === "hayabusa");
const yamanote = railLines.find((l) => l.id === "yamanote");

const destinations: Destination[] = [
  {
    href: "shinkansen.html",
    kana: "しんかんせん",
    sub: "にほん じゅう の しんかんせん",
    svg: hayabusa ? trainSvg(hayabusa) : "",
    color: "#00a86b",
  },
  {
    href: "densha.html",
    kana: "でんしゃ",
    sub: "とうきょう・かながわ の JR と してつ",
    svg: yamanote ? denshaSvg(yamanote.vehicle, { label: "でんしゃ" }) : "",
    color: "#f15a22",
  },
  {
    href: "quiz.html",
    kana: "くいず",
    sub: "ちず を みて こたえよう",
    svg: quizSvg(),
    color: "#8e5bd8",
  },
];

/** くいず ボタンの絵: はてな の ふきだし と せんろ */
function quizSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="くいず">`,
    `<rect x="0" y="96" width="320" height="8" rx="4" fill="#9e9e9e"/>`,
    ...[20, 60, 100, 140, 180, 220, 260, 300].map((x) => `<rect x="${x - 6}" y="92" width="12" height="16" rx="2" fill="#8d6e63"/>`),
    `<g transform="translate(160 48)">`,
    `<path d="M -14 30 L 0 50 L 14 30 Z" fill="#8e5bd8"/>`,
    `<circle r="44" fill="#8e5bd8"/>`,
    `<text y="22" text-anchor="middle" font-size="64" font-weight="bold" fill="#fff" font-family="sans-serif">?</text>`,
    `</g>`,
    `<text x="52" y="60" text-anchor="middle" font-size="40">⭐</text>`,
    `<text x="268" y="60" text-anchor="middle" font-size="40">🎉</text>`,
    `</svg>`,
  ].join("");
}

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  root.classList.add("top");
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "どれ に する?";

  const nav = document.createElement("nav");
  nav.className = "top-menu";
  for (const d of destinations) {
    const link = document.createElement("a");
    link.className = "top-menu__item";
    link.href = `${import.meta.env.BASE_URL}${d.href}`;
    link.style.setProperty("--menu-color", d.color);
    const illustration = document.createElement("div");
    illustration.className = "top-menu__illustration";
    illustration.innerHTML = d.svg;
    const kana = document.createElement("span");
    kana.className = "top-menu__kana";
    kana.textContent = d.kana;
    const sub = document.createElement("span");
    sub.className = "top-menu__sub";
    sub.textContent = d.sub;
    link.append(illustration, kana, sub);
    nav.append(link);
  }
  root.append(title, nav);
  addVoiceCredit(root);
}
