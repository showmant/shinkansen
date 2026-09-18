import { voiceCredit } from "./voices";

/**
 * 読み上げは VOICEVOX で作った音声。各ボイスライブラリの規約で
 * 「VOICEVOX:キャラクター名」のクレジット表記が必要なので、どのページにも出す。
 */
export function addVoiceCredit(root: HTMLElement): void {
  const credit = document.createElement("p");
  credit.className = "credit";
  const link = document.createElement("a");
  link.href = "https://voicevox.hiroshiba.jp/";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = voiceCredit();
  credit.append("こえ: ", link);
  root.append(credit);
}
