/** 鉄道会社のグループ (カードのタブ) */
export type CompanyId =
  | "jr"
  | "odakyu"
  | "keio"
  | "tokyu"
  | "sotetsu"
  | "keikyu"
  | "seibu"
  | "tobu"
  | "keisei"
  | "other";

export interface Company {
  id: CompanyId;
  /** タブに出すひらがな (例: おだきゅう) */
  kana: string;
  /** タブの色 (#rrggbb) */
  color: string;
}

/** 駅。座標は scripts/build-densha-geo.mjs が国土数値情報から生成する */
export interface DenshaStation {
  id: string;
  /** 漢字表記。国土数値情報 (N02) の駅名と一致させる */
  name: string;
  /** ひらがな表記 (読み上げ・駅名ラベル) */
  kana: string;
  /** N02 で別の駅名になっている場合の名前 (例: モノレール浜松町) */
  n02Names?: readonly string[];
}

/** イラストの先頭形状 */
export type TrainShape =
  /** 切り立った通勤電車 */
  | "flat"
  /** 斜めに傾いた前面 */
  | "slant"
  /** まるい前面 (ラビュー) */
  | "round"
  /** とがった鼻 (スカイライナー・N'EX) */
  | "nose"
  /** 展望席 (ロマンスカー) */
  | "observation"
  /** 路面電車ふうの小さな車体 (江ノ電・登山電車) */
  | "tram"
  /** 桁にまたがるモノレール */
  | "monorail"
  /** 桁にぶらさがるモノレール */
  | "suspended";

export interface TrainColors {
  /** 車体の地の色 */
  body: string;
  /** 帯の色 */
  stripe: string;
  /** 2本目の帯・差し色 */
  accent: string;
  /** 前面 (顔) の色。省略時は body */
  front?: string;
  /** 車体下半分の塗り分け色 (江ノ電など) */
  lower?: string;
}

export interface Vehicle {
  /** 形式 (例: E235系) */
  series: string;
  shape: TrainShape;
  colors: TrainColors;
}

/** 国土数値情報 N02 から線形を取り出すための条件 */
export interface GeoSource {
  /** N02_004 運営会社 */
  operator: string;
  /** N02_003 路線名 (運行系統が複数の路線名にまたがる場合は全部) */
  routes: readonly string[];
}

/** 路線 (運行系統) */
export interface RailLine {
  id: string;
  company: CompanyId;
  /** 漢字表記 (例: 横浜線) */
  name: string;
  /** カードに大きく出すひらがな (例: よこはません) */
  kana: string;
  /** 読み上げ用の名前。省略時は kana (例: おだきゅうせん) */
  speechName?: string;
  /** 地図の路線色 (#rrggbb) */
  color: string;
  /** 駅 ID (起点から終点の順)。環状線は最後に起点を繰り返す */
  stationIds: readonly string[];
  /** 環状運転 (山手線) */
  loop?: boolean;
  vehicle: Vehicle;
  source: GeoSource;
  /** 到着時に読むひとこと (ひらがな) */
  fact: string;
}

/** 人気の特急 */
export interface LimitedExpress {
  id: string;
  company: CompanyId;
  /** 愛称の漢字・カタカナ表記 */
  name: string;
  /** カードに大きく出すひらがな */
  kana: string;
  /** 読み上げ用の名前。省略時は kana */
  speechName?: string;
  vehicle: Vehicle;
  /** 地図上で走る路線 (始発から終着の順) */
  lineIds: readonly string[];
  /** 地図上の始発駅 ID */
  from: string;
  /** 地図上の終着駅 ID */
  to: string;
  /** 地図の外まで走るときの本当の始発・終着 (ひらがな) */
  speechFrom?: string;
  speechTo?: string;
  fact: string;
}
