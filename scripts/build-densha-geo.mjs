// 国土数値情報 (CC BY 4.0) から でんしゃ版の地図データを生成する。
//   - 鉄道データ N02 (2025年12月31日時点): 駅の座標と、駅間の線路の形
//   - 行政区域データ N03 (2025年1月1日時点): 都県の輪郭 (mapshaper で融合・簡略化)
// 路線・駅の一覧は src/densha/data/*.ts を読む (Node の型ストリップで .ts を直接 import)。
//
// 使い方:
//   curl -sSLO https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-25/N02-25_GML.zip && unzip N02-25_GML.zip -d N02
//   for p in 11 12 13 14 19 22; do
//     curl -sSLO https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_${p}_GML.zip
//     unzip N03-20250101_${p}_GML.zip -d N03
//   done
//   node scripts/build-densha-geo.mjs N02 N03
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { railLines } from "../src/densha/data/lines.ts";
import { denshaStations } from "../src/densha/data/stations.ts";

const [n02Dir, n03Dir] = process.argv.slice(2);
if (!n02Dir || !n03Dir) {
  console.error("usage: node scripts/build-densha-geo.mjs <N02 dir> <N03 dir>");
  process.exit(1);
}

/** 地図に描く範囲 (東京都・神奈川県 + 周辺を少し) */
const BOUNDS = { west: 138.9, east: 140.16, south: 35.08, north: 36.05 };
/** 線路の Douglas-Peucker 許容誤差 (度, ≒20m) */
const RAIL_TOLERANCE = 0.0002;
/** 切れた線路をつなぐ距離 (度, ≒100m) */
const SNAP = 0.001;
/** 同じ地点とみなす距離 (度, ≒15m) */
const NEAR = 0.00015;
const round = (n) => Math.round(n * 10000) / 10000;

const findFile = (dir, suffix) => {
  const hits = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(suffix)) hits.push(p);
    }
  };
  walk(dir);
  return hits;
};

// ---------- 鉄道 (N02) ----------

const readGeo = (path) => JSON.parse(readFileSync(path, "utf8"));
const sectionFile = findFile(n02Dir, "RailroadSection.geojson").find((p) => p.includes("UTF-8"));
const stationFile = findFile(n02Dir, "Station.geojson").find((p) => p.includes("UTF-8"));
if (!sectionFile || !stationFile) throw new Error("N02 UTF-8 GeoJSON not found");
const sections = readGeo(sectionFile).features;
const n02Stations = readGeo(stationFile).features;

const stationById = new Map(denshaStations.map((s) => [s.id, s]));
const matches = (f, source) =>
  f.properties.N02_004 === source.operator && source.routes.includes(f.properties.N02_003);

const mean = (points) => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
];
const midpoint = (coords) => mean([coords[0], coords[coords.length - 1]]);

/** 路線ごとの駅位置 (N02 の同じ会社・路線名のホーム中心)。見つからなければエラー */
function stationOnLine(line, stationId) {
  const station = stationById.get(stationId);
  if (!station) throw new Error(`${line.id}: unknown station id ${stationId}`);
  // N02 には互換漢字 (例: 笹塚の「塚」U+FA10) が混じるので NFKC で比べる
  const names = [station.name, ...(station.n02Names ?? [])].map((n) => n.normalize("NFKC"));
  const hits = n02Stations.filter(
    (f) => names.includes(f.properties.N02_005.normalize("NFKC")) && matches(f, line.source),
  );
  if (hits.length === 0) throw new Error(`${line.id}: station not found in N02: ${station.name}`);
  return mean(hits.map((f) => midpoint(f.geometry.coordinates)));
}

const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos((35.6 * Math.PI) / 180), a[1] - b[1]);

/** 路線の N02 線分からグラフを作る (端点は約1mで丸めて接続) */
function buildGraph(source) {
  const key = (p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const nodes = new Map();
  const node = (p) => {
    const k = key(p);
    let n = nodes.get(k);
    if (!n) {
      n = { p, edges: [] };
      nodes.set(k, n);
    }
    return n;
  };
  for (const f of sections) {
    if (!matches(f, source) || !nearBounds(f)) continue;
    const lines = f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const coords of lines) {
      for (let i = 1; i < coords.length; i++) {
        const a = node(coords[i - 1]);
        const b = node(coords[i]);
        const w = dist(a.p, b.p);
        a.edges.push({ to: b, w });
        b.edges.push({ to: a, w });
      }
    }
  }
  if (nodes.size === 0) throw new Error(`no N02 sections for ${source.operator} ${source.routes}`);
  const all = [...nodes.values()];
  const link = (a, b) => {
    if (a === b || a.edges.some((e) => e.to === b)) return;
    const w = dist(a.p, b.p);
    a.edges.push({ to: b, w });
    b.edges.push({ to: a, w });
  };
  // ほぼ同じ位置の点 (≒15m 以内) は線分が違ってもつなぐ
  const cell = (v) => Math.floor(v / NEAR);
  const grid = new Map();
  for (const n of all) {
    const k = `${cell(n.p[0])},${cell(n.p[1])}`;
    grid.set(k, [...(grid.get(k) ?? []), n]);
  }
  for (const n of all) {
    const cx = cell(n.p[0]);
    const cy = cell(n.p[1]);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const m of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (dist(n.p, m.p) < NEAR) link(n, m);
      }
    }
  }
  // 線分の端が少しずれて切れている所 (路線名の変わり目など) を、近くの点とつなぐ
  for (const end of all.filter((n) => n.edges.length === 1)) {
    let best = null;
    for (const n of all) {
      if (n === end || end.edges.some((e) => e.to === n)) continue;
      const d = dist(n.p, end.p);
      if (d < SNAP && (!best || d < dist(best.p, end.p))) best = n;
    }
    if (best) {
      const w = dist(best.p, end.p);
      end.edges.push({ to: best, w });
      best.edges.push({ to: end, w });
    }
  }
  return all;
}

/** 地図の範囲から大きく外れた線路は使わない (遠回りの経路を作らないため) */
const nearBounds = (f) => {
  const lines = f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates];
  return lines.some((coords) =>
    coords.some(
      ([lon, lat]) =>
        lon > BOUNDS.west - 0.2 && lon < BOUNDS.east + 0.2 && lat > BOUNDS.south - 0.2 && lat < BOUNDS.north + 0.2,
    ),
  );
};

/** 駅から線路に乗り降りできる範囲 (度, ≒300m)。並走する別の線 (N02 ではつながっていない) も候補にする */
const STATION_RADIUS = 0.003;
/** 駅と線路の点の離れ具合にかけるコスト (遠い線路より近い線路を選ぶ) */
const ACCESS_WEIGHT = 3;

/**
 * 駅 a の近くの線路から、駅 b の近くの線路までの最短経路 (座標列)。
 * 複数の始点・終点候補から選ぶので、並走線が途中でつながっていなくても正しい線をたどれる。
 */
function shortestPath(graph, a, b) {
  const d = new Map();
  const prev = new Map();
  // 二分ヒープ [距離, ノード]
  const heap = [];
  const push = (item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (const n of graph) {
    const da = dist(n.p, a);
    if (da < STATION_RADIUS) {
      d.set(n, da * ACCESS_WEIGHT);
      push([da * ACCESS_WEIGHT, n]);
    }
  }
  let best = null;
  let bestCost = Infinity;
  const done = new Set();
  while (heap.length > 0) {
    const [base, cur] = pop();
    if (base >= bestCost) break;
    if (done.has(cur)) continue;
    done.add(cur);
    const db = dist(cur.p, b);
    if (db < STATION_RADIUS && base + db * ACCESS_WEIGHT < bestCost) {
      best = cur;
      bestCost = base + db * ACCESS_WEIGHT;
    }
    for (const { to: next, w } of cur.edges) {
      const nd = base + w;
      if (nd < (d.get(next) ?? Infinity)) {
        d.set(next, nd);
        prev.set(next, cur);
        push([nd, next]);
      }
    }
  }
  if (!best) return null;
  const path = [best.p];
  for (let n = prev.get(best); n; n = prev.get(n)) path.unshift(n.p);
  return path;
}

function perpendicular([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicular(points[i], points[0], points[points.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

// 駅の表示位置: その駅を通る全路線の駅位置の平均 (乗り換え駅は会社ごとのホームの真ん中)
const perLine = new Map();
const stationSamples = new Map();
for (const line of railLines) {
  const positions = line.stationIds.map((id) => stationOnLine(line, id));
  perLine.set(line.id, positions);
  line.stationIds.forEach((id, i) => {
    const list = stationSamples.get(id) ?? [];
    list.push(positions[i]);
    stationSamples.set(id, list);
  });
}
const stationPoints = new Map([...stationSamples].map(([id, ps]) => [id, mean(ps).map(round)]));
for (const s of denshaStations) {
  if (!stationPoints.has(s.id)) throw new Error(`station is not on any line: ${s.id}`);
}

// 駅間の線形: N02 の線路をたどり、両端を駅の表示位置につなぐ
const lineSegments = {};
for (const line of railLines) {
  const graph = buildGraph(line.source);
  const positions = perLine.get(line.id);
  const segments = [];
  for (let i = 1; i < line.stationIds.length; i++) {
    const a = stationPoints.get(line.stationIds[i - 1]);
    const b = stationPoints.get(line.stationIds[i]);
    const path = shortestPath(graph, positions[i - 1], positions[i]);
    if (!path) throw new Error(`${line.id}: no track between ${line.stationIds[i - 1]} and ${line.stationIds[i]}`);
    const simplified = simplify([a, ...path, b], RAIL_TOLERANCE).map((p) => p.map(round));
    segments.push(simplified.flat());
  }
  lineSegments[line.id] = segments;
}

// ---------- 都県の輪郭 (N03) ----------

const PREFECTURES = [
  { code: "13", name: "東京都", focus: true },
  { code: "14", name: "神奈川県", focus: true },
  { code: "11", name: "埼玉県", focus: false },
  { code: "12", name: "千葉県", focus: false },
  { code: "19", name: "山梨県", focus: false },
  { code: "22", name: "静岡県", focus: false },
];

const work = mkdtempSync(join(tmpdir(), "densha-geo-"));
const pad = 0.05;
const bbox = [BOUNDS.west - pad, BOUNDS.south - pad, BOUNDS.east + pad, BOUNDS.north + pad].join(",");
const prefectures = [];
for (const pref of PREFECTURES) {
  const input = findFile(n03Dir, `_${pref.code}.geojson`)[0];
  if (!input) throw new Error(`N03 for ${pref.name} not found`);
  const output = join(work, `${pref.code}.json`);
  execFileSync(
    "npx",
    [
      "-y",
      "mapshaper",
      "-i",
      input,
      "-clip",
      `bbox=${bbox}`,
      "-dissolve",
      "-explode",
      "-filter-slivers",
      "min-area=0.3km2",
      "-simplify",
      "interval=150",
      "keep-shapes",
      "-o",
      output,
      "format=geojson",
      "precision=0.001",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const rings = [];
  for (const f of readGeo(output).features ?? readGeo(output).geometries ?? []) {
    const g = f.geometry ?? f;
    if (!g) continue;
    const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
    for (const poly of polys) if (poly[0].length >= 4) rings.push(poly[0].slice(0, -1).flat());
  }
  prefectures.push({ name: pref.name, focus: pref.focus, rings });
}

// ---------- 出力 ----------

const header = `// 自動生成: node scripts/build-densha-geo.mjs (手で編集しない)
// 出典: 国土数値情報 (鉄道データ N02 2025年度 / 行政区域データ N03 2025年) 国土交通省 CC BY 4.0
//       https://nlftp.mlit.go.jp/ksj/ を加工して作成
`;

const numbers = (arr) => `[${arr.join(",")}]`;

writeFileSync(
  "src/densha/map/rail-geo.ts",
  `${header}
/** 地図の範囲 (度) */
export const DENSHA_BOUNDS = ${JSON.stringify(BOUNDS)};

/** 駅の表示位置 [経度, 緯度] */
export const stationLonLat: Readonly<Record<string, readonly [number, number]>> = {
${[...stationPoints].map(([id, p]) => `  ${JSON.stringify(id)}: [${p.join(",")}],`).join("\n")}
};

/** 路線ごとの駅間の線形。segments[i] は stationIds[i] → stationIds[i+1] の [経度,緯度,経度,緯度,...] */
export const lineSegments: Readonly<Record<string, readonly (readonly number[])[]>> = {
${Object.entries(lineSegments)
  .map(([id, segs]) => `  ${JSON.stringify(id)}: [\n${segs.map((s) => `    ${numbers(s)},`).join("\n")}\n  ],`)
  .join("\n")}
};
`,
);

writeFileSync(
  "src/densha/map/land-geo.ts",
  `${header}
export interface PrefectureShape {
  name: string;
  /** 東京都・神奈川県 (濃く塗る) */
  focus: boolean;
  /** 外周リング。各要素は [経度,緯度,経度,緯度,...] */
  rings: readonly (readonly number[])[];
}

export const prefectureShapes: readonly PrefectureShape[] = [
${prefectures
  .map(
    (p) =>
      `  {\n    name: ${JSON.stringify(p.name)},\n    focus: ${p.focus},\n    rings: [\n${p.rings
        .map((r) => `      ${numbers(r.map((n) => Math.round(n * 1000) / 1000))},`)
        .join("\n")}\n    ],\n  },`,
  )
  .join("\n")}
];
`,
);

const pointCount = Object.values(lineSegments).reduce((n, segs) => n + segs.reduce((m, s) => m + s.length / 2, 0), 0);
console.log(`stations=${stationPoints.size} lines=${railLines.length} railPoints=${pointCount}`);
console.log(prefectures.map((p) => `${p.name}: rings=${p.rings.length}`).join("\n"));
