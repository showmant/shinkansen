/** 駅(主要駅のみ)。緯度経度は実座標 */
export interface Station {
  id: string;
  /** 漢字表記 (例: 東京) */
  name: string;
  /** ひらがな表記 (例: とうきょう) */
  kana: string;
  lat: number;
  lon: number;
}

export type LineId =
  | "tokaido"
  | "sanyo"
  | "kyushu"
  | "nishi-kyushu"
  | "tohoku"
  | "hokkaido"
  | "akita"
  | "yamagata"
  | "joetsu"
  | "hokuriku";

/** 新幹線の路線 */
export interface Line {
  id: LineId;
  /** 漢字表記 (例: 東海道新幹線) */
  name: string;
  kana: string;
  /** 地図で使う代表色 (#rrggbb) */
  color: string;
  /** 路線上の駅 ID (起点から終点の順) */
  stationIds: readonly string[];
}

/** 車体配色 (#rrggbb) */
export interface TrainColors {
  /** 車体の地の色 */
  body: string;
  /** 帯の色 */
  stripe: string;
  /** 差し色 (ノーズ・ロゴ等) */
  accent: string;
}

/** 列車 (愛称 × 車両) */
export interface Train {
  id: string;
  /** 愛称 (例: はやぶさ) */
  nickname: string;
  /** 愛称のひらがな表記 */
  kana: string;
  /** 車両形式 (例: E5系) */
  series: string;
  /** 走る路線 (始発から終着の順) */
  lineIds: readonly LineId[];
  /** 始発駅 ID */
  from: string;
  /** 終着駅 ID */
  to: string;
  colors: TrainColors;
  /** 3歳向けひとこと (ひらがな) */
  fact: string;
  /** 事業用車など営業列車ではない特別枠 */
  special?: boolean;
  /** 退役済み */
  retired?: boolean;
}
