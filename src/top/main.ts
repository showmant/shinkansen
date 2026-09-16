import "../style.css";
import "./top.css";
import { railLines } from "../densha/data/lines";
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
];

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  root.classList.add("top");
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "どっち に のる?";

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
}
