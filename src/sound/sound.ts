import type { App } from "../app";
import { browserEffects, type Effects } from "./effects";
import { browserStorage, createMuteButton } from "./mute";
import { arrivalSpeechText, browserSpeaker, lineSpeechText, trainSpeechText, type Speaker } from "./speech";

export type SoundEvents = Pick<App, "onTrainStart" | "onTrainArrive" | "onLineSelect" | "onRunStop">;

export interface SoundOutputs {
  speaker: Speaker;
  effects: Effects;
}

/** アプリのイベントに読み上げと効果音を結線する。戻り値で解除 */
export function connectSound(events: SoundEvents, { speaker, effects }: SoundOutputs): () => void {
  const offs = [
    events.onTrainStart((train) => {
      effects.chime();
      effects.startMotor();
      speaker.speak(trainSpeechText(train));
    }),
    events.onTrainArrive((train) => {
      effects.stopMotor();
      effects.arrive();
      speaker.speak(arrivalSpeechText(train));
    }),
    events.onLineSelect((line) => {
      speaker.speak(lineSpeechText(line));
    }),
    events.onRunStop(() => {
      effects.stopMotor();
      speaker.cancel();
    }),
  ];
  return () => offs.forEach((off) => off());
}

/** ブラウザの音声・オーディオとミュートボタンを用意して root に置く */
export function installSound(app: App, root: HTMLElement): void {
  const mute = createMuteButton({
    storage: browserStorage(),
    onChange: (muted) => {
      if (!muted) return;
      speaker.cancel();
      effects.stopAll();
    },
  });
  const speaker = browserSpeaker(mute.isMuted);
  const effects = browserEffects(mute.isMuted);
  root.append(mute.element);

  // 自動再生制限: 最初のクリック (ユーザー操作) で AudioContext を resume
  document.addEventListener("pointerdown", () => effects.unlock(), { capture: true });
  connectSound(app, { speaker, effects });
}
