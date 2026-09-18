import "../style.css";
import "./densha.css";
import { addHomeButton } from "../home-button";
import { addVoiceCredit } from "../sound/credit";
import { createBrowserSoundOutputs } from "../sound/sound";
import { createDenshaApp } from "./app";
import { limitedExpresses } from "./data/expresses";
import { railLines } from "./data/lines";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  const app = createDenshaApp(root, { lines: railLines, expresses: limitedExpresses });
  addHomeButton(root);
  addVoiceCredit(root);
  const { speaker, effects } = createBrowserSoundOutputs(root);
  app.onRunStart((speech) => {
    effects.chime();
    effects.startMotor();
    speaker.speak(speech);
  });
  app.onRunArrive((speech) => {
    effects.stopMotor();
    effects.arrive();
    speaker.speak(speech);
  });
  app.onLineSelect((speech) => speaker.speak(speech));
  app.onRunStop(() => {
    effects.stopMotor();
    speaker.cancel();
  });
}
