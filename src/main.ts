import "./style.css";
import { createJapanMap } from "./map/map";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "しんかんせん ちず";

  const map = createJapanMap();
  app.append(title, map.element);
}
