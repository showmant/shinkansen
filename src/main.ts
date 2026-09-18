import "./style.css";
import { createApp } from "./app";
import { addHomeButton } from "./home-button";
import { addVoiceCredit } from "./sound/credit";
import { installSound } from "./sound/sound";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  installSound(createApp(root), root);
  addHomeButton(root);
  addVoiceCredit(root);
}
