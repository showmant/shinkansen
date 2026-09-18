import { lines } from "../data/lines";
import { trains } from "../data/trains";
import { limitedExpresses } from "../densha/data/expresses";
import { expressRoute, passesHome } from "../densha/data/groups";
import { railLines } from "../densha/data/lines";
import {
  arrivalSpeech as denshaArrivalSpeech,
  expressSpeech,
  lineNameSpeech,
  lineSpeech as denshaLineSpeech,
} from "../densha/speech";
import { arrivalSpeech, lineSpeech, trainSpeech } from "./speech";
import { voiceKey, type Speech } from "./voices";

/**
 * アプリがしゃべりうる文のすべて。scripts/build-voices.mjs がこれを VOICEVOX に投げて
 * public/voices/*.mp3 を作る。ここに載っていない文は音声ファイルが無く、
 * ブラウザ標準の読み上げにフォールバックする。
 */
export function voiceCatalog(): Speech[] {
  const all: Speech[] = [];

  // しんかんせん
  for (const train of trains) all.push(trainSpeech(train), arrivalSpeech(train));
  for (const line of lines) all.push(lineSpeech(line));

  // でんしゃ
  for (const line of railLines) {
    const start = denshaLineSpeech(line, passesHome(line.stationIds));
    all.push(start, denshaArrivalSpeech(start.voice, line.fact), lineNameSpeech(line));
  }
  for (const express of limitedExpresses) {
    const start = expressSpeech(express, passesHome(expressRoute(express, railLines)));
    all.push(start, denshaArrivalSpeech(start.voice, express.fact));
  }

  // 同じ声・同じ文は 1 ファイルで足りる
  const byKey = new Map(all.map((s) => [voiceKey(s), s]));
  return [...byKey.values()];
}
