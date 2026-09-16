export type AudioContextLike = Pick<
  AudioContext,
  "currentTime" | "state" | "destination" | "resume" | "createOscillator" | "createGain"
>;

export interface Effects {
  /** 自動再生制限の解除 (ユーザー操作中に呼ぶ) */
  unlock(): void;
  /** 発車メロディ風の短いチャイム */
  chime(): void;
  /** 走行中のやさしいモーター音 (フェードイン) */
  startMotor(): void;
  /** モーター音をフェードアウトして止める */
  stopMotor(): void;
  /** 到着のポーン音 */
  arrive(): void;
  /** 鳴っている持続音をすぐ止める */
  stopAll(): void;
}

export interface EffectsOptions {
  createContext: () => AudioContextLike | null;
  isMuted: () => boolean;
}

/** 全体の音量は控えめに */
const CHIME_VOLUME = 0.12;
const MOTOR_VOLUME = 0.035;
const ARRIVE_VOLUME = 0.15;
const MOTOR_FADE_IN = 0.8;
const MOTOR_FADE_OUT = 0.6;

/** ド・ミ・ソ・ド の上がっていく音 */
const CHIME_NOTES = [523.25, 659.25, 783.99, 1046.5];
const CHIME_STEP = 0.16;

interface Motor {
  gain: GainNode;
  oscillators: OscillatorNode[];
}

/** Web Audio API で合成した効果音 (音源ファイルなし)。非対応・例外時は無音 */
export function createEffects({ createContext, isMuted }: EffectsOptions): Effects {
  let ctx: AudioContextLike | null = null;
  let motor: Motor | null = null;

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

  const safely = (play: (c: AudioContextLike) => void) => {
    if (isMuted()) return;
    try {
      const c = context();
      if (c) play(c);
    } catch {
      // 音が出せなくても画面操作は続ける
    }
  };

  /** 立ち上がりが速く、ゆっくり減衰する単音 */
  const tone = (c: AudioContextLike, frequency: number, start: number, length: number, volume: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + length + 0.05);
  };

  const fadeOutMotor = (fade: number) => {
    const current = motor;
    motor = null;
    if (!current || !ctx) return;
    try {
      const now = ctx.currentTime;
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(current.gain.gain.value, now);
      current.gain.gain.linearRampToValueAtTime(0, now + fade);
      current.oscillators.forEach((osc) => osc.stop(now + fade + 0.05));
    } catch {
      // 既に止まっている等は無視
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
    chime() {
      safely((c) => {
        const now = c.currentTime;
        CHIME_NOTES.forEach((freq, i) => tone(c, freq, now + i * CHIME_STEP, 0.5, CHIME_VOLUME));
      });
    },
    startMotor() {
      fadeOutMotor(0.1);
      safely((c) => {
        const now = c.currentTime;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(MOTOR_VOLUME, now + MOTOR_FADE_IN);
        gain.connect(c.destination);
        // 少しずらした 2 つの低い音でうなりを作る
        const oscillators = [110, 111.5].map((freq) => {
          const osc = c.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(gain);
          osc.start(now);
          return osc;
        });
        motor = { gain, oscillators };
      });
    },
    stopMotor() {
      fadeOutMotor(MOTOR_FADE_OUT);
    },
    arrive() {
      safely((c) => {
        const now = c.currentTime;
        tone(c, 880, now, 1.4, ARRIVE_VOLUME);
        tone(c, 1760, now, 0.8, ARRIVE_VOLUME / 4);
      });
    },
    stopAll() {
      fadeOutMotor(0.05);
    },
  };
}

type AudioContextConstructor = new () => AudioContext;

/** ブラウザの AudioContext (Safari 旧版の webkit 接頭辞にも対応) */
export function browserEffects(isMuted: () => boolean): Effects {
  return createEffects({
    createContext: () => {
      const g = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
      const Ctor = g.AudioContext ?? g.webkitAudioContext;
      return Ctor ? new Ctor() : null;
    },
    isMuted,
  });
}
