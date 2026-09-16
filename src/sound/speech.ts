import { stations } from "../data/stations";
import type { Line, Train } from "../data/types";

const stationKana = (id: string): string => {
  const station = stations.find((s) => s.id === id);
  if (!station) throw new Error(`unknown station: ${id}`);
  return station.kana;
};

/** カード選択時: 「はやぶさ! とうきょう から しんはこだてほくと まで はしるよ」 */
export function trainSpeechText(train: Train): string {
  return `${train.kana}! ${stationKana(train.from)} から ${stationKana(train.to)} まで はしるよ`;
}

/** 到着時: ひとこと (fact) を読む */
export function arrivalSpeechText(train: Train): string {
  return `とうちゃく! ${train.fact}`;
}

/** 路線クリック時: 「とうかいどう しんかんせん」 (区切ると自然に聞こえる) */
export function lineSpeechText(line: Line): string {
  return line.kana.replace(/しんかんせん$/, " しんかんせん");
}

export interface UtteranceLike {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export interface SpeechSynthesisLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

export interface Speaker {
  speak(text: string): void;
  cancel(): void;
}

export interface SpeakerOptions {
  synth: SpeechSynthesisLike | undefined;
  Utterance: (new (text: string) => UtteranceLike) | undefined;
  isMuted: () => boolean;
}

const pickJapaneseVoice = (voices: readonly SpeechSynthesisVoice[]) =>
  voices.find((v) => v.lang === "ja-JP") ?? voices.find((v) => v.lang.toLowerCase().startsWith("ja"));

/** Web Speech API で読み上げる。非対応・日本語音声なし・例外時は黙って何もしない */
export function createSpeaker({ synth, Utterance, isMuted }: SpeakerOptions): Speaker {
  const cancel = () => {
    try {
      synth?.cancel();
    } catch {
      // 読み上げできなくても画面操作は続ける
    }
  };

  return {
    speak(text) {
      if (isMuted() || !synth || !Utterance) return;
      try {
        synth.cancel();
        const voices = synth.getVoices();
        const voice = pickJapaneseVoice(voices);
        // 音声一覧が非同期読み込み中 (空) なら lang 指定だけでブラウザに任せる
        if (voices.length > 0 && !voice) return;
        const utterance = new Utterance(text);
        utterance.lang = "ja-JP";
        utterance.voice = voice ?? null;
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        synth.speak(utterance);
      } catch {
        // 読み上げできなくても画面操作は続ける
      }
    },
    cancel,
  };
}

/** ブラウザ標準の読み上げ */
export function browserSpeaker(isMuted: () => boolean): Speaker {
  const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
  return createSpeaker({
    synth: hasSpeech ? window.speechSynthesis : undefined,
    Utterance: typeof SpeechSynthesisUtterance === "undefined" ? undefined : SpeechSynthesisUtterance,
    isMuted,
  });
}
