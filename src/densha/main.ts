import "../style.css";
import "./densha.css";
import { addHomeButton } from "../home-button";
import { createBrowserSoundOutputs } from "../sound/sound";
import { createDenshaApp } from "./app";
import { limitedExpresses } from "./data/expresses";
import { railLines } from "./data/lines";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  const app = createDenshaApp(root, { lines: railLines, expresses: limitedExpresses });
  addHomeButton(root);
  const { speaker, effects } = createBrowserSoundOutputs(root);
  app.onRunStart((text) => {
    effects.chime();
    effects.startMotor();
    speaker.speak(text);
  });
  app.onRunArrive((text) => {
    effects.stopMotor();
    effects.arrive();
    speaker.speak(text);
  });
  app.onLineSelect((text) => speaker.speak(text));
  app.onRunStop(() => {
    effects.stopMotor();
    speaker.cancel();
  });
}
