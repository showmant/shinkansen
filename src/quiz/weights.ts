import { HOME_STATION_ID, MACHIDA_CITY_STATION_IDS } from "../densha/data/stations";
import { stationLonLat } from "../densha/map/rail-geo";

/** 緯度 1 度あたりの距離 (km) */
const KM_PER_DEGREE = 111;
/** 町田のそばほど重く: 重み = FLOOR + exp(-距離 / DECAY_KM) */
const DECAY_KM = 6;
/** 遠くの駅 (東京・横浜など) も出るよう、どれだけ遠くても残す重み */
const FLOOR = 0.1;
/** 町田市内の駅へのおまけ */
const MACHIDA_CITY_BONUS = 0.3;

/** 2 駅のざっくりした距離 (km)。経度差に cos(緯度) を掛けたユークリッド距離 */
function distanceKm(a: readonly [number, number], b: readonly [number, number]): number {
  const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * cosLat, a[1] - b[1]) * KM_PER_DEGREE;
}

/** 町田駅からの距離で決めた駅ごとの出題の重み (でんしゃ版)。どの駅も 0 にはならない */
export function machidaStationWeights(): ReadonlyMap<string, number> {
  const home = stationLonLat[HOME_STATION_ID];
  const city = new Set(MACHIDA_CITY_STATION_IDS);
  return new Map(
    Object.entries(stationLonLat).map(([id, lonLat]) => [
      id,
      FLOOR + Math.exp(-distanceKm(home, lonLat) / DECAY_KM) + (city.has(id) ? MACHIDA_CITY_BONUS : 0),
    ]),
  );
}
