import { speech, voiceFor, type Speech, type VoiceId } from "../sound/voices";
import { denshaStations } from "./data/stations";
import type { LimitedExpress, RailLine } from "./types";

const stationKana = (id: string): string => {
  const station = denshaStations.find((s) => s.id === id);
  if (!station) throw new Error(`unknown station: ${id}`);
  return station.kana;
};

const HOME_SUFFIX = " まちだ も とおるよ";

/** 路線カード: 「おだきゅうせん! しんじゅく から おだわら まで はしるよ まちだ も とおるよ」 */
export function lineSpeech(line: RailLine, passesHome: boolean): Speech {
  const name = line.speechName ?? line.kana;
  const home = passesHome ? HOME_SUFFIX : "";
  const voice = voiceFor(line.id);
  if (line.loop) return speech(voice, `${name}! ${stationKana(line.stationIds[0])} を とおって ぐるっと まわるよ${home}`);
  const from = stationKana(line.stationIds[0]);
  const to = stationKana(line.stationIds[line.stationIds.length - 1]);
  return speech(voice, `${name}! ${from} から ${to} まで はしるよ${home}`);
}

/** 特急カード: 地図の外まで走るときは本当の終着駅を読む */
export function expressSpeech(express: LimitedExpress, passesHome: boolean): Speech {
  const name = express.speechName ?? express.kana;
  const from = express.speechFrom ?? stationKana(express.from);
  const to = express.speechTo ?? stationKana(express.to);
  return speech(voiceFor(express.id), `${name}! ${from} から ${to} まで はしるよ${passesHome ? HOME_SUFFIX : ""}`);
}

/** 地図の路線クリック: 路線名だけ */
export const lineNameSpeech = (line: RailLine): Speech => speech(voiceFor(line.id), line.speechName ?? line.kana);

/** 到着: ひとこと。走っていた電車と同じキャラクターの声で */
export const arrivalSpeech = (voice: VoiceId, fact: string): Speech => speech(voice, `とうちゃく! ${fact}`);
