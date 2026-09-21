import "../style.css";
// でんしゃ の 地図 の 見た目 (線・駅・ラベル) は でんしゃ版 と共通
import "../densha/densha.css";
import "./quiz.css";
import { addHomeButton } from "../home-button";
import { addVoiceCredit } from "../sound/credit";
import { browserStorage, createMuteButton } from "../sound/mute";
import { browserSpeaker } from "../sound/speech";
import { createQuizApp } from "./app";
import { browserQuizEffects } from "./sound";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  root.classList.add("quiz");
  // ミュート状態は localStorage で しんかんせん・でんしゃ と共通
  const mute = createMuteButton({
    storage: browserStorage(),
    onChange: (muted) => {
      if (muted) speaker.cancel();
    },
  });
  const speaker = browserSpeaker(mute.isMuted);
  const effects = browserQuizEffects(mute.isMuted);
  // 自動再生制限: 最初のクリック (ユーザー操作) で AudioContext を resume
  document.addEventListener("pointerdown", () => effects.unlock(), { capture: true });

  createQuizApp(root, { speak: (s) => speaker.speak(s), stopSpeaking: () => speaker.cancel(), effects });
  addHomeButton(root);
  root.append(mute.element);
  addVoiceCredit(root);
}
