import { stations } from "../data/stations";
import type { Line, Train } from "../data/types";
import { browserVoicePlayer, type VoicePlayer } from "./voice-player";
import { speech, voiceFor, type Speech } from "./voices";

const stationKana = (id: string): string => {
  const station = stations.find((s) => s.id === id);
  if (!station) throw new Error(`unknown station: ${id}`);
  return station.kana;
};

/** カード選択時: 「はやぶさ! とうきょう から しんはこだてほくと まで はしるよ」 */
export function trainSpeech(train: Train): Speech {
  return speech(voiceFor(train.id), `${train.kana}! ${stationKana(train.from)} から ${stationKana(train.to)} まで はしるよ`);
}

/** 到着時: ひとこと (fact) を読む。列車と同じキャラクターの声で */
export function arrivalSpeech(train: Train): Speech {
  return speech(voiceFor(train.id), `とうちゃく! ${train.fact}`);
}

/** 路線クリック時: 「とうかいどう しんかんせん」 (区切ると自然に聞こえる) */
export function lineSpeech(line: Line): Speech {
  return speech(voiceFor(line.id), line.kana.replace(/しんかんせん$/, " しんかんせん"));
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
  speak(speech: Speech): void;
  cancel(): void;
}

export interface SpeakerOptions {
  /** 事前生成した VOICEVOX の音声。鳴らせなければブラウザ読み上げに落ちる */
  voices: VoicePlayer | undefined;
  synth: SpeechSynthesisLike | undefined;
  Utterance: (new (text: string) => UtteranceLike) | undefined;
  isMuted: () => boolean;
}

const pickJapaneseVoice = (voices: readonly SpeechSynthesisVoice[]) =>
  voices.find((v) => v.lang === "ja-JP") ?? voices.find((v) => v.lang.toLowerCase().startsWith("ja"));

/**
 * VOICEVOX の音声ファイルで読み上げる。ファイルがない・鳴らせない環境では
 * Web Speech API にフォールバックし、それも無ければ黙って何もしない。
 */
export function createSpeaker({ voices, synth, Utterance, isMuted }: SpeakerOptions): Speaker {
  // 読み上げを切り替えたら、前の再生の失敗でフォールバックが鳴らないようにする
  let generation = 0;

  const cancelSynth = () => {
    try {
      synth?.cancel();
    } catch {
      // 読み上げできなくても画面操作は続ける
    }
  };

  const speakWithSynth = (text: string) => {
    if (!synth || !Utterance) return;
    try {
      synth.cancel();
      const available = synth.getVoices();
      const voice = pickJapaneseVoice(available);
      // 音声一覧が非同期読み込み中 (空) なら lang 指定だけでブラウザに任せる
      if (available.length > 0 && !voice) return;
      const utterance = new Utterance(text);
      utterance.lang = "ja-JP";
      utterance.voice = voice ?? null;
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      synth.speak(utterance);
    } catch {
      // 読み上げできなくても画面操作は続ける
    }
  };

  const cancel = () => {
    generation += 1;
    try {
      voices?.stop();
    } catch {
      // 止められなくても画面操作は続ける
    }
    cancelSynth();
  };

  return {
    speak(next) {
      if (isMuted()) return;
      cancel();
      const mine = generation;
      if (!voices) {
        speakWithSynth(next.text);
        return;
      }
      voices.play(next).catch(() => {
        if (mine !== generation || isMuted()) return;
        speakWithSynth(next.text);
      });
    },
    cancel,
  };
}

/** ブラウザで鳴らす読み上げ (VOICEVOX の音声ファイル + 標準読み上げのフォールバック) */
export function browserSpeaker(isMuted: () => boolean): Speaker {
  const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
  return createSpeaker({
    voices: browserVoicePlayer(),
    synth: hasSpeech ? window.speechSynthesis : undefined,
    Utterance: typeof SpeechSynthesisUtterance === "undefined" ? undefined : SpeechSynthesisUtterance,
    isMuted,
  });
}
