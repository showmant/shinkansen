import { speech, type Speech, type VoiceId } from "../sound/voices";

/**
 * クイズで出す文と読み上げ。表示はすべてひらがな。
 *
 * 読み上げ文は scripts/build-voices.mjs で VOICEVOX の音声にする。助詞の「は」は
 * 前後を空白で区切っておかないと「ハ」と読まれるので、表示と同じく分かち書きにしておく。
 */

/** クイズの おねえさん 役 (いつも同じ声) */
export const QUIZ_VOICE: VoiceId = "tsumugi";

export interface Prompt {
  /** 画面に出す文 */
  text: string;
  speech: Speech;
}

type QuizGenre = "shinkansen" | "densha";

const prompt = (text: string, spoken = text): Prompt => ({ text, speech: speech(QUIZ_VOICE, spoken) });

const vehicle = (genre: QuizGenre) => (genre === "shinkansen" ? "しんかんせん" : "でんしゃ");

/**
 * タイプA: 「？」は「ハテナ」と読む。ひらがなの「はてな」だと
 * 合成前の「は」→「ハ」の置き換えで「ハ/テナ」と切れてしまうのでカタカナにしておく (読み上げ専用)
 */
export const gapPrompt = (): Prompt => prompt("？ の えき の なまえ は なに？", "ハテナ の えき の なまえ は なに？");

/** タイプB */
export const linePrompt = (genre: QuizGenre): Prompt =>
  prompt(genre === "shinkansen" ? "ひかって いる しんかんせん は なに？" : "ひかって いる せんろ は なに？");

/** タイプC: 駅名は読み上げる */
export const stationPrompt = (genre: QuizGenre, stationKana: string): Prompt =>
  prompt(`${stationKana} えき に とまる ${vehicle(genre)} は どれ？`);

/** 正解: 出し惜しみせず祝う */
export const correctPhrases: readonly Prompt[] = [
  prompt("せいかい！ すごい！"),
  prompt("せいかい！ やったね！"),
  prompt("だいせいかい！ よく わかったね！"),
  prompt("せいかい！ てんさい！"),
];

/** 不正解: 「まちがい」とは言わず、挑戦したことをほめて次へ送り出す */
export const tryPhrases: readonly Prompt[] = [
  prompt("ちょうせん できて えらい！"),
  prompt("よく かんがえたね！"),
  prompt("がんばって えらんだね！ えらい！"),
  prompt("いっしょうけんめい かんがえて すごい！"),
];

/** 不正解のあとに やさしく つける ひとこと (こたえ は 画面に出す) */
export const NEXT_TEXT = "つぎ いこう！";

const COUNT_KANA = ["ぜろ", "いち", "に", "さん", "よん", "ご"] as const;

/** 結果: 正解数にかかわらず必ず祝う (数に応じて少しだけ言い方を変える) */
export function resultPrompt(correct: number, total: number): Prompt {
  const praise =
    correct === total
      ? "ぜんもん せいかい！ すごすぎる！"
      : correct >= 3
        ? "よく できたね！ すごい！"
        : correct >= 1
          ? "がんばったね！ たのしかったね！"
          : "さいご まで やりきったね！ すごい！";
  const count = (n: number) => `${COUNT_KANA[n] ?? String(n)}もん`;
  return prompt(`${total}もん ちゅう ${correct}もん せいかい！ ${praise}`, `${count(total)} ちゅう ${count(correct)} せいかい！ ${praise}`);
}

/** ジャンル選択の問いかけ */
export const genrePrompt = prompt("どっち の くいず に する？");
