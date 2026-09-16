// Natural Earth (public domain) の国境データから日本の陸地を抽出・簡略化して
// src/map/japan-geo.ts を生成する。
//
// 使い方:
//   curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
//   node scripts/build-japan-geo.mjs ne_10m_admin_0_countries.geojson
import { readFileSync, writeFileSync } from "node:fs";

const [input] = process.argv.slice(2);
if (!input) {
  console.error("usage: node scripts/build-japan-geo.mjs <ne_10m_admin_0_countries.geojson>");
  process.exit(1);
}

/** 沖縄・南西諸島を除く (これより南のポリゴンは捨てる) */
const MIN_LAT = 30.8;
/** これより外接矩形が小さい島は捨てる (度) */
const MIN_EXTENT = 0.12;
/** Douglas-Peucker の許容誤差 (度) */
const TOLERANCE = 0.015;

function perpendicularDistance([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [points[0], points[last]];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

const geo = JSON.parse(readFileSync(input, "utf8"));
const japan = geo.features.find((f) => f.properties.ADMIN === "Japan");
if (!japan) throw new Error("Japan not found");

const rings = japan.geometry.coordinates
  .map((polygon) => polygon[0])
  .filter((ring) => {
    const lons = ring.map(([lon]) => lon);
    const lats = ring.map(([, lat]) => lat);
    const extent = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
    return Math.min(...lats) >= MIN_LAT && extent >= MIN_EXTENT;
  })
  .map((ring) => simplify(ring.slice(0, -1), TOLERANCE))
  .filter((ring) => ring.length >= 4)
  .sort((a, b) => b.length - a.length);

const round = (n) => Math.round(n * 100) / 100;
const body = rings
  .map((ring) => `  [${ring.map(([lon, lat]) => `[${round(lon)},${round(lat)}]`).join(",")}],`)
  .join("\n");

writeFileSync(
  "src/map/japan-geo.ts",
  `// 自動生成: node scripts/build-japan-geo.mjs (手で編集しない)
// 出典: Natural Earth 1:10m Admin 0 – Countries (public domain) https://www.naturalearthdata.com/

/** 経度・緯度 */
export type LonLat = readonly [lon: number, lat: number];

/** 日本の陸地 (北海道〜九州。沖縄・小さな離島は省略)。各要素は閉じたポリゴンの外周 */
export const japanLand: readonly (readonly LonLat[])[] = [
${body}
];
`,
);
console.log(`rings=${rings.length} points=${rings.reduce((n, r) => n + r.length, 0)}`);
