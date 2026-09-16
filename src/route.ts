import type { LineId, Train } from "./data/types";

/** 経路探索に必要な列車の情報 (でんしゃ版の特急でも使う) */
export interface RouteTrain<L extends string = string> {
  lineIds: readonly L[];
  from: string;
  to: string;
}

/** 経路探索に必要な路線の情報 */
export interface RouteLine<L extends string = string> {
  id: L;
  stationIds: readonly string[];
}

/** 列車の走る路線以外を通るときのコスト。自路線でつながる限り他路線は使わない */
const OFF_LINE_COST = 1000;

/**
 * 始発から終着までの駅 ID 列を返す。
 * 列車の lineIds 上の区間を優先して最短経路をたどるので、路線またぎや逆向きでも連結できる。
 * lineIds どうしが駅を共有しない場合 (北陸新幹線の大宮→高崎など) だけ他路線を経由する。
 */
export function buildRoute<L extends string>(train: RouteTrain<L>, lines: readonly RouteLine<L>[]): string[] {
  const ownLines = new Set<L>(train.lineIds);
  const edges = new Map<string, Array<{ to: string; cost: number }>>();
  const addEdge = (a: string, b: string, cost: number) => {
    const list = edges.get(a) ?? [];
    list.push({ to: b, cost });
    edges.set(a, list);
  };
  for (const line of lines) {
    const cost = ownLines.has(line.id) ? 1 : OFF_LINE_COST;
    for (let i = 1; i < line.stationIds.length; i++) {
      addEdge(line.stationIds[i - 1], line.stationIds[i], cost);
      addEdge(line.stationIds[i], line.stationIds[i - 1], cost);
    }
  }

  // 駅数が少ないので素朴なダイクストラで十分
  const dist = new Map<string, number>([[train.from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let current: string | undefined;
    for (const [id, d] of dist) {
      if (!done.has(id) && (current === undefined || d < (dist.get(current) ?? Infinity))) current = id;
    }
    if (current === undefined) throw new Error(`no route: ${train.from} -> ${train.to}`);
    if (current === train.to) break;
    done.add(current);
    const base = dist.get(current) ?? 0;
    for (const { to, cost } of edges.get(current) ?? []) {
      if (base + cost < (dist.get(to) ?? Infinity)) {
        dist.set(to, base + cost);
        prev.set(to, current);
      }
    }
  }

  const route = [train.to];
  while (route[0] !== train.from) {
    const p = prev.get(route[0]);
    if (p === undefined) throw new Error(`no route: ${train.from} -> ${train.to}`);
    route.unshift(p);
  }
  return route;
}

/** 指定路線を走る列車の ID */
export function trainsOnLine(lineId: LineId, trains: readonly Train[]): string[] {
  return trains.filter((t) => t.lineIds.includes(lineId)).map((t) => t.id);
}
