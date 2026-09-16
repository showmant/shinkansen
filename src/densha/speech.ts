import { denshaStations } from "./data/stations";
import type { LimitedExpress, RailLine } from "./types";

const stationKana = (id: string): string => {
  const station = denshaStations.find((s) => s.id === id);
  if (!station) throw new Error(`unknown station: ${id}`);
  return station.kana;
};

const HOME_SUFFIX = " まちだ も とおるよ";

/** 路線カード: 「おだきゅうせん! しんじゅく から おだわら まで はしるよ まちだ も とおるよ」 */
export function lineSpeechText(line: RailLine, passesHome: boolean): string {
  const name = line.speechName ?? line.kana;
  const home = passesHome ? HOME_SUFFIX : "";
  if (line.loop) return `${name}! ${stationKana(line.stationIds[0])} を とおって ぐるっと まわるよ${home}`;
  const from = stationKana(line.stationIds[0]);
  const to = stationKana(line.stationIds[line.stationIds.length - 1]);
  return `${name}! ${from} から ${to} まで はしるよ${home}`;
}

/** 特急カード: 地図の外まで走るときは本当の終着駅を読む */
export function expressSpeechText(express: LimitedExpress, passesHome: boolean): string {
  const name = express.speechName ?? express.kana;
  const from = express.speechFrom ?? stationKana(express.from);
  const to = express.speechTo ?? stationKana(express.to);
  return `${name}! ${from} から ${to} まで はしるよ${passesHome ? HOME_SUFFIX : ""}`;
}

/** 地図の路線クリック: 路線名だけ */
export const lineNameSpeechText = (line: RailLine): string => line.speechName ?? line.kana;

/** 到着: ひとこと */
export const arrivalSpeechText = (fact: string): string => `とうちゃく! ${fact}`;
