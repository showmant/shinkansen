/** 緯度経度の矩形範囲 (度) */
export interface GeoBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

/** SVG 座標 */
export interface Point {
  x: number;
  y: number;
}

export interface Projection {
  width: number;
  height: number;
  project(lat: number, lon: number): Point;
}

/** 北海道〜鹿児島が収まる範囲 (沖縄・離島は省略) */
export const JAPAN_BOUNDS: GeoBounds = {
  north: 45.7,
  south: 30.8,
  west: 128.3,
  east: 146.0,
};

/**
 * 等距円筒図法 + 中心緯度の cos による縦横比補正。
 * bounds の北西端が (0,0)、南東端が (width,height) になる。
 */
export function createProjection(bounds: GeoBounds, width: number): Projection {
  const midLat = (bounds.north + bounds.south) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const scale = width / ((bounds.east - bounds.west) * lonScale);
  const height = (bounds.north - bounds.south) * scale;
  return {
    width,
    height,
    project: (lat, lon) => ({
      x: (lon - bounds.west) * lonScale * scale,
      y: (bounds.north - lat) * scale,
    }),
  };
}
