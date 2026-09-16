import "./style.css";
import { trains } from "./data/trains";
import { createJapanMap } from "./map/map";
import { renderCards } from "./trains/cards";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "しんかんせん ちず";

  const map = createJapanMap();

  const cards = document.createElement("section");
  cards.setAttribute("aria-label", "しんかんせん いちらん");
  renderCards(cards, trains);

  const layout = document.createElement("main");
  layout.className = "layout";
  layout.append(map.element, cards);

  app.append(title, layout);
}
