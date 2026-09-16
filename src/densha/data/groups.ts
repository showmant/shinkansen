import { buildRoute } from "../../route";
import { expressKey, lineKey, type CardGroup } from "../trains/cards";
import type { LimitedExpress, RailLine } from "../types";
import { companies } from "./expresses";
import { HOME_STATION_ID, MACHIDA_CITY_STATION_IDS } from "./stations";

/** 特急が地図上で通る駅列 */
export const expressRoute = (express: LimitedExpress, lines: readonly RailLine[]): string[] =>
  buildRoute(express, lines);

/** 町田駅を通るか (読み上げ「まちだ も とおるよ」) */
export const passesHome = (stationIds: readonly string[]): boolean => stationIds.includes(HOME_STATION_ID);

/** タブ: まちだ → とっきゅう → 会社ごと */
export function buildCardGroups(lines: readonly RailLine[], expresses: readonly LimitedExpress[]): CardGroup[] {
  const machidaCity = new Set(MACHIDA_CITY_STATION_IDS);
  const machida: CardGroup = {
    id: "machida",
    label: "🏠 まちだ を とおる でんしゃ",
    color: "#e8534a",
    keys: [
      ...lines.filter((l) => l.stationIds.some((id) => machidaCity.has(id))).map((l) => lineKey(l.id)),
      ...expresses.filter((e) => passesHome(expressRoute(e, lines))).map((e) => expressKey(e.id)),
    ],
  };
  const express: CardGroup = {
    id: "express",
    label: "⭐ とっきゅう",
    color: "#f2a900",
    keys: expresses.map((e) => expressKey(e.id)),
  };
  const byCompany = companies.map<CardGroup>((company) => ({
    id: company.id,
    label: company.kana,
    color: company.color,
    keys: [
      ...lines.filter((l) => l.company === company.id).map((l) => lineKey(l.id)),
      ...expresses.filter((e) => e.company === company.id).map((e) => expressKey(e.id)),
    ],
  }));
  return [machida, express, ...byCompany];
}
