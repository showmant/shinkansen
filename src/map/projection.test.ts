import { describe, expect, it } from "vitest";
import { createProjection, JAPAN_BOUNDS } from "./projection";

const TOKYO = { lat: 35.6812, lon: 139.7671 };
const OSAKA = { lat: 34.7334, lon: 135.5002 };
const SAPPORO = { lat: 43.0686, lon: 141.3508 };
const KAGOSHIMA = { lat: 31.5838, lon: 130.5413 };

describe("createProjection", () => {
  const proj = createProjection(JAPAN_BOUNDS, 1000);

  it("幅は指定値、高さは縦横比補正された正の値", () => {
    expect(proj.width).toBe(1000);
    expect(proj.height).toBeGreaterThan(0);
  });

  it("東京は大阪より右上", () => {
    const tokyo = proj.project(TOKYO.lat, TOKYO.lon);
    const osaka = proj.project(OSAKA.lat, OSAKA.lon);
    expect(tokyo.x).toBeGreaterThan(osaka.x);
    expect(tokyo.y).toBeLessThan(osaka.y);
  });

  it("札幌は最上部付近、鹿児島は最下部付近", () => {
    const sapporo = proj.project(SAPPORO.lat, SAPPORO.lon);
    const kagoshima = proj.project(KAGOSHIMA.lat, KAGOSHIMA.lon);
    expect(sapporo.y).toBeLessThan(proj.height * 0.25);
    expect(kagoshima.y).toBeGreaterThan(proj.height * 0.75);
  });

  it("境界の北西端が (0,0)、南東端が (width,height)", () => {
    const nw = proj.project(JAPAN_BOUNDS.north, JAPAN_BOUNDS.west);
    const se = proj.project(JAPAN_BOUNDS.south, JAPAN_BOUNDS.east);
    expect(nw.x).toBeCloseTo(0);
    expect(nw.y).toBeCloseTo(0);
    expect(se.x).toBeCloseTo(proj.width);
    expect(se.y).toBeCloseTo(proj.height);
  });

  it("経度 1 度と緯度 1 度の長さ比が中心緯度の cos になる", () => {
    const midLat = (JAPAN_BOUNDS.north + JAPAN_BOUNDS.south) / 2;
    const a = proj.project(midLat, 138);
    const b = proj.project(midLat, 139);
    const c = proj.project(midLat - 1, 138);
    const ratio = (b.x - a.x) / (c.y - a.y);
    expect(ratio).toBeCloseTo(Math.cos((midLat * Math.PI) / 180), 5);
  });
});
