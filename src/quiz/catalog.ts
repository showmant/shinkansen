import type { Speech } from "../sound/voices";
import { correctPhrases, gapPrompt, genrePrompt, linePrompt, resultPrompt, stationPrompt, tryPhrases } from "./phrases";
import { quizData, QUESTIONS_PER_SET, type Genre } from "./questions";

/** クイズがしゃべりうる文のすべて (voice-catalog.ts が VOICEVOX 音声の作成対象に加える) */
export function quizSpeeches(): Speech[] {
  const genres: Genre[] = ["shinkansen", "densha"];
  return [
    genrePrompt.speech,
    gapPrompt().speech,
    ...genres.flatMap((genre) => {
      const data = quizData(genre);
      return [
        linePrompt(genre).speech,
        ...data.stationQuizIds.map((id) => stationPrompt(genre, data.stationKana.get(id) ?? id).speech),
      ];
    }),
    ...correctPhrases.map((p) => p.speech),
    ...tryPhrases.map((p) => p.speech),
    ...Array.from({ length: QUESTIONS_PER_SET + 1 }, (_, n) => resultPrompt(n, QUESTIONS_PER_SET).speech),
  ];
}
