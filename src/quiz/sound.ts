import type { AudioContextLike } from "../sound/effects";

export interface QuizEffects {
  /** 自動再生制限の解除 (ユーザー操作中に呼ぶ) */
  unlock(): void;
  /** 選択肢を押したときの軽い音 */
  tap(): void;
  /** 正解: 明るく上がっていくファンファーレ */
  fanfare(): void;
  /** 不正解: 落胆させない、やわらかい「ぽろん」 */
  gentle(): void;
  /** 結果発表: 長めのお祝い */
  celebrate(): void;
}

export interface QuizEffectsOptions {
  createContext: () => AudioContextLike | null;
  isMuted: () => boolean;
}

/** 既存の効果音 (effects.ts) と同じく控えめな音量 */
const FANFARE_VOLUME = 0.13;
const GENTLE_VOLUME = 0.1;
const TAP_VOLUME = 0.06;

// 音の高さ (Hz)
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;

interface Note {
  freq: number;
  /** 鳴り始め (秒) */
  at: number;
  length: number;
}

/** ド・ミ・ソ・ド〜 と駆け上がって、最後は和音でのばす */
const FANFARE: readonly Note[] = [
  { freq: C5, at: 0, length: 0.25 },
  { freq: E5, at: 0.11, length: 0.25 },
  { freq: G5, at: 0.22, length: 0.25 },
  { freq: C6, at: 0.36, length: 1.1 },
  { freq: E6, at: 0.36, length: 1.1 },
  { freq: G6, at: 0.36, length: 1.0 },
];

/** ソ・ミ と ゆっくり降りる やわらかい 2 音 (長調のまま、ブブーにしない) */
const GENTLE: readonly Note[] = [
  { freq: G5, at: 0, length: 0.6 },
  { freq: E5, at: 0.22, length: 0.9 },
];

/** 結果発表: ファンファーレを 2 回、2 回目は高く */
const CELEBRATE: readonly Note[] = [
  { freq: C5, at: 0, length: 0.2 },
  { freq: D5, at: 0.1, length: 0.2 },
  { freq: E5, at: 0.2, length: 0.2 },
  { freq: G5, at: 0.3, length: 0.2 },
  { freq: A5, at: 0.4, length: 0.2 },
  { freq: C6, at: 0.5, length: 0.3 },
  { freq: G5, at: 0.75, length: 0.2 },
  { freq: C6, at: 0.9, length: 1.4 },
  { freq: E6, at: 0.9, length: 1.4 },
  { freq: G6, at: 0.9, length: 1.3 },
];

/** Web Audio API で合成したクイズ用の効果音 (音源ファイルなし)。非対応・例外時は無音 */
export function createQuizEffects({ createContext, isMuted }: QuizEffectsOptions): QuizEffects {
  let ctx: AudioContextLike | null = null;

  const context = (): AudioContextLike | null => {
    if (!ctx) {
      try {
        ctx = createContext();
      } catch {
        ctx = null;
      }
    }
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };

  /** 立ち上がりが速く、ゆっくり減衰する単音 */
  const tone = (c: AudioContextLike, type: OscillatorType, note: Note, start: number, volume: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = start + note.at;
    osc.type = type;
    osc.frequency.setValueAtTime(note.freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.length);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + note.length + 0.05);
  };

  const play = (notes: readonly Note[], type: OscillatorType, volume: number) => {
    if (isMuted()) return;
    try {
      const c = context();
      if (!c) return;
      const now = c.currentTime;
      for (const note of notes) tone(c, type, note, now, volume);
    } catch {
      // 音が出せなくても画面操作は続ける
    }
  };

  return {
    unlock() {
      try {
        context();
      } catch {
        // 無視
      }
    },
    tap() {
      play([{ freq: A5, at: 0, length: 0.12 }], "sine", TAP_VOLUME);
    },
    fanfare() {
      // 三角波はラッパっぽく明るい。サインを重ねて角をとる
      play(FANFARE, "triangle", FANFARE_VOLUME);
      play(FANFARE, "sine", FANFARE_VOLUME / 2);
    },
    gentle() {
      play(GENTLE, "sine", GENTLE_VOLUME);
    },
    celebrate() {
      play(CELEBRATE, "triangle", FANFARE_VOLUME);
      play(CELEBRATE, "sine", FANFARE_VOLUME / 2);
    },
  };
}

type AudioContextConstructor = new () => AudioContext;

/** ブラウザの AudioContext (Safari 旧版の webkit 接頭辞にも対応) */
export function browserQuizEffects(isMuted: () => boolean): QuizEffects {
  return createQuizEffects({
    createContext: () => {
      const g = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
      const Ctor = g.AudioContext ?? g.webkitAudioContext;
      return Ctor ? new Ctor() : null;
    },
    isMuted,
  });
}
