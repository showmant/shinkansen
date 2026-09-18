/**
 * VOICEVOX (https://voicevox.hiroshiba.jp/) のキャラクターと、
 * 事前生成した音声ファイル (public/voices/*.mp3) を引くためのキー。
 *
 * ここに載せているのは「クレジットを書けば商用・非商用で使える」キャラクターだけ
 * (企業利用で事前確認が要るキャラクターは入れない)。クレジットは README と画面に出す。
 */

export type VoiceId =
  | "zundamon"
  | "metan"
  | "tsumugi"
  | "hau"
  | "sora"
  | "himari"
  | "kotarou"
  | "takehiro";

export interface VoiceCharacter {
  id: VoiceId;
  /** クレジット表記に使う名前 (例: VOICEVOX:ずんだもん) */
  name: string;
  /** 使うスタイル名 (例: あまあま) */
  style: string;
  /** VOICEVOX エンジンの話者 ID (/speakers の styles[].id) */
  speaker: number;
}

export const voiceCharacters: readonly VoiceCharacter[] = [
  { id: "zundamon", name: "ずんだもん", style: "あまあま", speaker: 1 },
  { id: "metan", name: "四国めたん", style: "ノーマル", speaker: 2 },
  { id: "tsumugi", name: "春日部つむぎ", style: "ノーマル", speaker: 8 },
  { id: "hau", name: "雨晴はう", style: "ノーマル", speaker: 10 },
  { id: "sora", name: "九州そら", style: "あまあま", speaker: 15 },
  { id: "himari", name: "冥鳴ひまり", style: "ノーマル", speaker: 14 },
  { id: "kotarou", name: "白上虎太郎", style: "わーい", speaker: 32 },
  { id: "takehiro", name: "玄野武宏", style: "喜び", speaker: 39 },
];

/** 読み上げる一言。text を voice のキャラクターの声で話す */
export interface Speech {
  voice: VoiceId;
  text: string;
}

export const speech = (voice: VoiceId, text: string): Speech => ({ voice, text });

/** FNV-1a (32bit)。ビルド時と実行時で同じキーになれば十分な軽いハッシュ */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 列車・路線ごとに声を割り当てる。id から決まるので
 * 同じ列車はいつも同じキャラクターがしゃべる (データを足しても手当て不要)。
 */
export function voiceFor(seed: string): VoiceId {
  return voiceCharacters[fnv1a(seed) % voiceCharacters.length].id;
}

/** 音声ファイル名 (public/voices/<key>.mp3)。声とテキストが同じなら同じキー */
export function voiceKey({ voice, text }: Speech): string {
  return `${voice}-${fnv1a(`${voice}\n${text}`).toString(16).padStart(8, "0")}`;
}

/** 画面と README に出すクレジット (例: VOICEVOX:ずんだもん / VOICEVOX:四国めたん …) */
export const voiceCredit = (characters: readonly VoiceCharacter[] = voiceCharacters): string =>
  characters.map((c) => `VOICEVOX:${c.name}`).join(" / ");
