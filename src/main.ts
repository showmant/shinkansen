import "./style.css";
import { createApp } from "./app";
import { addHomeButton } from "./home-button";
import { installSound } from "./sound/sound";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  installSound(createApp(root), root);
  addHomeButton(root);
}
