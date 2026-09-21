import { lines as shinkansenLines } from "../data/lines";
import { stations as shinkansenStations } from "../data/stations";
import { railLines } from "../densha/data/lines";
import { denshaStations } from "../densha/data/stations";
import { gapPrompt, linePrompt, stationPrompt, type Prompt } from "./phrases";

export type Genre = "shinkansen" | "densha";

/** 3 種類の問題: 駅名の歯抜け / 路線名当て / この駅に止まる路線 */
export type QuestionKind = "gap" | "line" | "station";

/** 両ジャンル共通で扱う路線 */
export interface QuizLine {
  id: string;
  /** 選択肢に出すひらがな */
  label: string;
  color: string;
  /** 誤答えらびの「近い路線」の目安 (でんしゃ: 会社、しんかんせん: なし) */
  group: string | null;
  /** 起点から終点の順。環状線でも起点を繰り返さない */
  stationIds: readonly string[];
}

export interface QuizData {
  genre: Genre;
  lines: readonly QuizLine[];
  stationKana: ReadonlyMap<string, string>;
  /** 「◯◯えき に とまる …」で出す駅 */
  stationQuizIds: readonly string[];
}

export interface Choice {
  id: string;
  label: string;
}

/** 地図に何を出すか */
export type MapView =
  /** 路線の一部 (stationIds) を出して、hiddenId の駅名を「？」にする */
  | { kind: "gap"; lineId: string; stationIds: readonly string[]; hiddenId: string }
  /** 1 つの路線だけを光らせる */
  | { kind: "line"; lineId: string }
  /** 1 つの駅に寄って印をつける */
  | { kind: "station"; stationId: string };

export interface Question {
  kind: QuestionKind;
  prompt: Prompt;
  /** 4 つの選択肢 (並びはシャッフル済み) */
  choices: readonly Choice[];
  answerId: string;
  view: MapView;
}

export const QUESTIONS_PER_SET = 5;
const CHOICE_COUNT = 4;
/** 歯抜け問題で「？」の前後に見せる駅の数 */
const GAP_CONTEXT = 2;

export type Random = () => number;

const pick = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)];

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 環状線の最後の「起点に戻る駅」を落とす */
const withoutLoopEnd = (ids: readonly string[]): string[] =>
  ids.length > 1 && ids[0] === ids[ids.length - 1] ? ids.slice(0, -1) : [...ids];

export function shinkansenQuizData(): QuizData {
  return {
    genre: "shinkansen",
    lines: shinkansenLines.map((l) => ({
      id: l.id,
      label: l.kana,
      color: l.color,
      group: null,
      stationIds: l.stationIds,
    })),
    stationKana: new Map(shinkansenStations.map((s) => [s.id, s.kana])),
    stationQuizIds: shinkansenStations.map((s) => s.id),
  };
}

export function denshaQuizData(): QuizData {
  // 「しんよこはません」のように同じひらがなの路線は、会社名つきの読み上げ名で見分ける
  const kanaCount = new Map<string, number>();
  for (const l of railLines) kanaCount.set(l.kana, (kanaCount.get(l.kana) ?? 0) + 1);
  const lines = railLines.map<QuizLine>((l) => ({
    id: l.id,
    label: (kanaCount.get(l.kana) ?? 0) > 1 ? (l.speechName ?? l.kana) : l.kana,
    color: l.color,
    group: l.company,
    stationIds: withoutLoopEnd(l.stationIds),
  }));
  // 駅の問題は のりかえ駅 (2 路線以上) だけ: 6さい にもなじみのある大きな駅が多い
  const lineCount = new Map<string, number>();
  for (const l of lines) for (const id of l.stationIds) lineCount.set(id, (lineCount.get(id) ?? 0) + 1);
  return {
    genre: "densha",
    lines,
    stationKana: new Map(denshaStations.map((s) => [s.id, s.kana])),
    stationQuizIds: denshaStations.filter((s) => (lineCount.get(s.id) ?? 0) >= 2).map((s) => s.id),
  };
}

export const quizData = (genre: Genre): QuizData => (genre === "shinkansen" ? shinkansenQuizData() : denshaQuizData());

/** 同じ路線名・駅名 (ラベル) が選択肢に 2 つ並ばないように、先頭から順に 4 つ集める */
function collectChoices(answer: Choice, candidates: readonly Choice[]): Choice[] {
  const chosen = [answer];
  const labels = new Set([answer.label]);
  for (const c of candidates) {
    if (chosen.length === CHOICE_COUNT) break;
    if (labels.has(c.label) || chosen.some((x) => x.id === c.id)) continue;
    chosen.push(c);
    labels.add(c.label);
  }
  if (chosen.length < CHOICE_COUNT) throw new Error(`not enough choices for ${answer.id}`);
  return chosen;
}

const lineChoice = (line: QuizLine): Choice => ({ id: line.id, label: line.label });

/** 近い候補から 2 つ、残りは全体から (6さい 向けに 1 つは はっきり ちがう ものが まざる) */
const nearFirst = <T>(near: readonly T[], all: readonly T[], random: Random): T[] => [
  ...shuffle(near, random).slice(0, 2),
  ...shuffle(all, random),
];

function sharesStation(a: QuizLine, b: QuizLine): boolean {
  return a.stationIds.some((id) => b.stationIds.includes(id));
}

/** タイプA: 路線の一部を並べて 1 駅だけ「？」にする */
export function gapQuestion(data: QuizData, random: Random): Question {
  const candidates = data.lines.filter((l) => l.stationIds.length >= 3);
  const line = pick(candidates, random);
  const ids = line.stationIds;
  // 前後の駅が見えるよう、端の駅は「？」にしない
  const index = 1 + Math.floor(random() * (ids.length - 2));
  const from = Math.max(0, index - GAP_CONTEXT);
  const shown = ids.slice(from, index + GAP_CONTEXT + 1);
  const hiddenId = ids[index];
  const stationChoice = (id: string): Choice => ({ id, label: data.stationKana.get(id) ?? id });

  // 誤答: 同じ路線の見えていない駅 → となりあう路線の駅。見えている駅は答えにならないので入れない
  const visible = new Set(shown);
  const sameLine = ids.filter((id) => !visible.has(id));
  const neighborLines = data.lines.filter((l) => l.id !== line.id && sharesStation(l, line));
  const nearby = [...new Set(neighborLines.flatMap((l) => l.stationIds))].filter(
    (id) => !visible.has(id) && !ids.includes(id),
  );
  const others = [...data.stationKana.keys()].filter((id) => !visible.has(id));
  const pool = [...shuffle(sameLine, random).slice(0, 2), ...shuffle(nearby, random), ...shuffle(others, random)];

  return {
    kind: "gap",
    prompt: gapPrompt(),
    choices: shuffle(collectChoices(stationChoice(hiddenId), pool.map(stationChoice)), random),
    answerId: hiddenId,
    view: { kind: "gap", lineId: line.id, stationIds: shown, hiddenId },
  };
}

/** タイプB: 光っている路線の名前 */
export function lineQuestion(data: QuizData, random: Random): Question {
  const line = pick(data.lines, random);
  const others = data.lines.filter((l) => l.id !== line.id);
  // 誤答: 同じ会社 (しんかんせん はつながっている路線) から 2 つ + 全体から
  const near = others.filter((l) => (line.group === null ? sharesStation(l, line) : l.group === line.group));
  const pool = nearFirst(near, others, random).map(lineChoice);
  return {
    kind: "line",
    prompt: linePrompt(data.genre),
    choices: shuffle(collectChoices(lineChoice(line), pool), random),
    answerId: line.id,
    view: { kind: "line", lineId: line.id },
  };
}

/** タイプC: この駅に止まる路線 */
export function stationQuestion(data: QuizData, random: Random): Question {
  const stationId = pick(data.stationQuizIds, random);
  const passing = data.lines.filter((l) => l.stationIds.includes(stationId));
  const answer = pick(passing, random);
  // 誤答はこの駅を通らない路線だけ。のりつぎ先の路線 (近い路線) を優先する
  const notPassing = data.lines.filter((l) => !l.stationIds.includes(stationId));
  const near = notPassing.filter((l) => passing.some((p) => sharesStation(l, p)));
  const passingLabels = new Set(passing.map((l) => l.label));
  const pool = nearFirst(near, notPassing, random)
    .filter((l) => !passingLabels.has(l.label))
    .map(lineChoice);
  return {
    kind: "station",
    prompt: stationPrompt(data.genre, data.stationKana.get(stationId) ?? stationId),
    choices: shuffle(collectChoices(lineChoice(answer), pool), random),
    answerId: answer.id,
    view: { kind: "station", stationId },
  };
}

const makers: Record<QuestionKind, (data: QuizData, random: Random) => Question> = {
  gap: gapQuestion,
  line: lineQuestion,
  station: stationQuestion,
};

/**
 * 1 セット分の問題タイプの並び。3 種類とも必ず入れ、同じタイプは続けない。
 */
export function questionKinds(count: number, random: Random): QuestionKind[] {
  const all: QuestionKind[] = ["gap", "line", "station"];
  const kinds: QuestionKind[] = [];
  let pool: QuestionKind[] = [];
  while (kinds.length < count) {
    if (pool.length === 0) pool = shuffle(all, random);
    const prev = kinds.at(-1);
    const i = pool.findIndex((k) => k !== prev);
    kinds.push(...pool.splice(i < 0 ? 0 : i, 1));
  }
  return kinds;
}

/** 1 セット (5 問)。同じ問題 (同じ答えと同じ地図) は出さない */
export function createQuestionSet(data: QuizData, random: Random = Math.random): Question[] {
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (const kind of questionKinds(QUESTIONS_PER_SET, random)) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const q = makers[kind](data, random);
      const key = `${q.kind}:${q.answerId}:${JSON.stringify(q.view)}`;
      if (seen.has(key) && attempt < 19) continue;
      seen.add(key);
      questions.push(q);
      break;
    }
  }
  return questions;
}

/** 答えの選択肢 (結果画面・「こたえ は ◯◯ だよ」用) */
export const answerChoice = (q: Question): Choice => q.choices.find((c) => c.id === q.answerId) ?? q.choices[0];

