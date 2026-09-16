import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "しんかんせん ちず";
  app.append(title);
}
