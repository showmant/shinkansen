import { describe, expect, it } from "vitest";
import { lines } from "./lines";
import { stations } from "./stations";
import { trains } from "./trains";

const HIRAGANA = /^[ぁ-ゖー]+$/;
const HIRAGANA_SENTENCE = /^[ぁ-ゖー、。！？ 　]+$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const stationIds = new Set(stations.map((s) => s.id));
const lineById = new Map(lines.map((l) => [l.id, l]));

function expectUniqueIds(ids: readonly string[]) {
  expect(new Set(ids).size).toBe(ids.length);
}

describe("stations", () => {
  it("ID が重複しない", () => {
    expectUniqueIds(stations.map((s) => s.id));
  });

  it.each(stations)("$id: kana がひらがな", (s) => {
    expect(s.kana).toMatch(HIRAGANA);
  });

  it.each(stations)("$id: 緯度経度が日本の範囲内", (s) => {
    expect(s.lat).toBeGreaterThan(24);
    expect(s.lat).toBeLessThan(46);
    expect(s.lon).toBeGreaterThan(122);
    expect(s.lon).toBeLessThan(146);
  });
});

describe("lines", () => {
  it("ID が重複しない", () => {
    expectUniqueIds(lines.map((l) => l.id));
  });

  it("10 路線すべてがある", () => {
    expect(lines.map((l) => l.id).sort()).toEqual(
      [
        "akita",
        "hokkaido",
        "hokuriku",
        "joetsu",
        "kyushu",
        "nishi-kyushu",
        "sanyo",
        "tohoku",
        "tokaido",
        "yamagata",
      ].sort(),
    );
  });

  it.each(lines)("$id: 全 stationId が存在し、2 駅以上で重複しない", (l) => {
    expect(l.stationIds.length).toBeGreaterThanOrEqual(2);
    expectUniqueIds(l.stationIds);
    for (const id of l.stationIds) {
      expect(stationIds, `unknown station ${id}`).toContain(id);
    }
  });

  it.each(lines)("$id: kana がひらがな・color が hex", (l) => {
    expect(l.kana).toMatch(HIRAGANA);
    expect(l.color).toMatch(HEX_COLOR);
  });

  it("すべての駅がいずれかの路線に属する", () => {
    const used = new Set(lines.flatMap((l) => l.stationIds));
    for (const s of stations) {
      expect(used, `unused station ${s.id}`).toContain(s.id);
    }
  });
});

describe("trains", () => {
  it("ID が重複しない", () => {
    expectUniqueIds(trains.map((t) => t.id));
  });

  it("退役車両を含まない", () => {
    expect(trains.filter((t) => t.retired)).toEqual([]);
  });

  it.each(trains)("$id: lineIds がすべて存在する", (t) => {
    expect(t.lineIds.length).toBeGreaterThanOrEqual(1);
    for (const id of t.lineIds) {
      expect(lineById.has(id), `unknown line ${id}`).toBe(true);
    }
  });

  it.each(trains)("$id: from/to が走る路線上にあり、異なる駅", (t) => {
    const onLines = new Set(
      t.lineIds.flatMap((id) => lineById.get(id)?.stationIds ?? []),
    );
    expect(onLines).toContain(t.from);
    expect(onLines).toContain(t.to);
    expect(t.from).not.toBe(t.to);
  });

  it.each(trains)("$id: kana・fact がひらがな", (t) => {
    expect(t.kana).toMatch(HIRAGANA);
    expect(t.fact).toMatch(HIRAGANA_SENTENCE);
  });

  it.each(trains)("$id: 配色が hex", (t) => {
    for (const c of Object.values(t.colors)) {
      expect(c).toMatch(HEX_COLOR);
    }
  });
});
