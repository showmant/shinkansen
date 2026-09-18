import { voiceKey, type Speech } from "./voices";

/** HTMLAudioElement のうち、ここで使う分だけ */
export interface AudioLike {
  src: string;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "error", listener: () => void): void;
}

export interface VoicePlayer {
  /** 再生を始められたら resolve、ファイルがない・再生できないときは reject */
  play(speech: Speech): Promise<void>;
  stop(): void;
}

export interface VoicePlayerOptions {
  /** 音声ファイルの URL を作る (例: /shinkansen/voices/zundamon-1a2b3c4d.mp3) */
  url: (key: string) => string;
  createAudio: () => AudioLike;
}

/**
 * 事前生成した VOICEVOX の音声ファイルを鳴らす。同時に鳴るのは 1 つだけ。
 *
 * iOS Safari は「ユーザー操作の中で一度再生した audio 要素」しか後から鳴らせないので、
 * 要素は 1 つだけ作って src を差し替えて使い回す。こうしておくと、カードを
 * タップして走り出したあと、タイマーで鳴らす「とうちゃく!」も再生できる。
 */
export function createVoicePlayer({ url, createAudio }: VoicePlayerOptions): VoicePlayer {
  let audio: AudioLike | null = null;
  let failCurrent: ((error: Error) => void) | null = null;

  const element = (): AudioLike => {
    if (!audio) {
      audio = createAudio();
      audio.addEventListener("error", () => failCurrent?.(new Error("voice file not playable")));
    }
    return audio;
  };

  return {
    play(speech) {
      const target = element();
      target.pause();
      return new Promise<void>((resolve, reject) => {
        failCurrent = reject;
        target.src = url(voiceKey(speech));
        target.play().then(resolve, reject);
      });
    },
    stop() {
      audio?.pause();
    },
  };
}

/** ブラウザ用。音声ファイルは base 直下の voices/ に置いてある */
export function browserVoicePlayer(): VoicePlayer | undefined {
  if (typeof Audio === "undefined") return undefined;
  return createVoicePlayer({
    url: (key) => `${import.meta.env.BASE_URL}voices/${key}.mp3`,
    createAudio: () => new Audio(),
  });
}
