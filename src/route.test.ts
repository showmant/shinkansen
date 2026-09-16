import { describe, expect, it } from "vitest";
import { lines } from "./data/lines";
import { trains } from "./data/trains";
import type { Line, Train } from "./data/types";
import { buildRoute, trainsOnLine } from "./route";

function train(id: string): Train {
  const t = trains.find((x) => x.id === id);
  if (!t) throw new Error(`train not found: ${id}`);
  return t;
}

describe("buildRoute", () => {
  it("1 路線だけの列車は路線の駅順そのまま", () => {
    expect(buildRoute(train("hikari"), lines)).toEqual([
      "tokyo",
      "shin-yokohama",
      "shizuoka",
      "hamamatsu",
      "nagoya",
      "kyoto",
      "shin-osaka",
    ]);
  });

  it("路線をまたぐ列車は分岐駅を 1 回だけ含めて連結する (みずほ)", () => {
    const route = buildRoute(train("mizuho"), lines);
    expect(route[0]).toBe("shin-osaka");
    expect(route.at(-1)).toBe("kagoshima-chuo");
    expect(route.filter((id) => id === "hakata")).toHaveLength(1);
    expect(route).toContain("hiroshima");
    expect(route).toContain("kumamoto");
  });

  it("途中駅で終わる列車は路線の途中で止まる (つばさ: 東京→福島→新庄)", () => {
    expect(buildRoute(train("tsubasa"), lines)).toEqual([
      "tokyo",
      "ueno",
      "omiya",
      "utsunomiya",
      "koriyama",
      "fukushima",
      "yonezawa",
      "yamagata",
      "shinjo",
    ]);
  });

  it("from/to が路線の向きと逆でもたどれる", () => {
    const reversed: Train = { ...train("mizuho"), from: "kagoshima-chuo", to: "shin-osaka", lineIds: ["kyushu", "sanyo"] };
    const route = buildRoute(reversed, lines);
    expect(route).toEqual([...buildRoute(train("mizuho"), lines)].reverse());
  });

  it("隣り合う路線が駅を共有しないときは他路線を経由してつなぐ (かがやき: 大宮→高崎)", () => {
    const route = buildRoute(train("kagayaki"), lines);
    expect(route[0]).toBe("tokyo");
    expect(route.at(-1)).toBe("tsuruga");
    const omiya = route.indexOf("omiya");
    expect(route.slice(omiya, omiya + 3)).toEqual(["omiya", "takasaki", "karuizawa"]);
    expect(route).not.toContain("sendai");
  });

  it("全列車で始発から終着まで経路が見つかり、隣の駅はいずれかの路線で隣接している", () => {
    const adjacent = (a: string, b: string) =>
      lines.some((l) => {
        const i = l.stationIds.indexOf(a);
        return i >= 0 && (l.stationIds[i + 1] === b || l.stationIds[i - 1] === b);
      });
    for (const t of trains) {
      const route = buildRoute(t, lines);
      expect(route[0], t.id).toBe(t.from);
      expect(route.at(-1), t.id).toBe(t.to);
      for (let i = 1; i < route.length; i++) expect(adjacent(route[i - 1], route[i]), t.id).toBe(true);
    }
  });

  it("つながらない駅どうしは例外", () => {
    const isolated: Line[] = [
      { id: "tokaido", name: "", kana: "", color: "#000000", stationIds: ["a", "b"] },
      { id: "sanyo", name: "", kana: "", color: "#000000", stationIds: ["c", "d"] },
    ];
    expect(() => buildRoute({ ...train("nozomi"), from: "a", to: "d" }, isolated)).toThrow();
  });
});

describe("trainsOnLine", () => {
  it("その路線を走る列車 ID を返す", () => {
    const ids = trainsOnLine("yamagata", trains);
    expect(ids).toEqual(["tsubasa"]);
    expect(trainsOnLine("sanyo", trains)).toEqual(
      expect.arrayContaining(["nozomi", "kodama-500", "mizuho", "sakura", "doctor-yellow"]),
    );
    expect(trainsOnLine("sanyo", trains)).not.toContain("hikari");
  });
});
