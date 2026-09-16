// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { trains } from "../data/trains";
import type { Train } from "../data/types";
import { noseShapeOf, trainSvg, type NoseShape } from "./illustration";

function parseSvg(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  const root = doc.documentElement;
  expect(root.tagName).toBe("svg");
  return root as unknown as SVGSVGElement;
}

function trainById(id: string): Train {
  const train = trains.find((t) => t.id === id);
  if (!train) throw new Error(`train not found: ${id}`);
  return train;
}

describe("trainSvg", () => {
  it.each(trains)("$id: 妥当な SVG が生成され、配色が反映されている", (train) => {
    const svg = trainSvg(train);
    parseSvg(svg);
    for (const color of [train.colors.body, train.colors.stripe, train.colors.accent]) {
      expect(svg).toContain(`"${color}"`);
    }
  });

  it("full は中間車を含み、icon は先頭車のみで小さい", () => {
    const train = trainById("hayabusa");
    const full = parseSvg(trainSvg(train));
    const icon = parseSvg(trainSvg(train, { variant: "icon" }));
    expect(full.querySelectorAll("[data-car]")).toHaveLength(2);
    expect(icon.querySelectorAll("[data-car]")).toHaveLength(1);
    const width = (el: SVGSVGElement) => Number(el.getAttribute("viewBox")?.split(" ")[2]);
    expect(width(icon)).toBeLessThan(width(full));
  });

  it("同じ SVG を複数並べても clipPath の id が衝突しない", () => {
    const train = trainById("nozomi");
    const ids = [trainSvg(train), trainSvg(train)].map(
      (svg) => parseSvg(svg).querySelector("clipPath")?.id,
    );
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("ノーズ形状が違えば車体の形も違う", () => {
    const headPath = (id: string) =>
      parseSvg(trainSvg(trainById(id))).querySelector('[data-car="head"] .body')?.getAttribute("d");
    const paths = ["hayabusa", "nozomi", "kodama-500", "tsubame", "kagayaki", "tsubasa"].map(headPath);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("noseShapeOf", () => {
  it.each<[string, NoseShape]>([
    ["hayabusa", "long"],
    ["yamabiko", "long"],
    ["komachi", "long"],
    ["nozomi", "platypus"],
    ["kodama", "platypus"],
    ["mizuho", "platypus"],
    ["doctor-yellow", "platypus"],
    ["kodama-500", "bullet"],
    ["tsubame", "rounded"],
    ["kagayaki", "blunt"],
    ["toki", "blunt"],
    ["tsubasa", "short"],
  ])("%s → %s", (id, shape) => {
    expect(noseShapeOf(trainById(id))).toBe(shape);
  });

  it.each(trains)("$id: 形状が決まる", (train) => {
    expect(() => noseShapeOf(train)).not.toThrow();
  });
});
