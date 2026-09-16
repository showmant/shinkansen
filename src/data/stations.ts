import type { Station } from "./types";

/** 主要駅 (緯度経度は駅のおおよその実座標) */
export const stations: readonly Station[] = [
  // 東海道・山陽
  { id: "tokyo", name: "東京", kana: "とうきょう", lat: 35.6812, lon: 139.7671 },
  { id: "shin-yokohama", name: "新横浜", kana: "しんよこはま", lat: 35.5075, lon: 139.6175 },
  { id: "shizuoka", name: "静岡", kana: "しずおか", lat: 34.9716, lon: 138.389 },
  { id: "hamamatsu", name: "浜松", kana: "はままつ", lat: 34.7038, lon: 137.735 },
  { id: "nagoya", name: "名古屋", kana: "なごや", lat: 35.1709, lon: 136.8815 },
  { id: "kyoto", name: "京都", kana: "きょうと", lat: 34.9858, lon: 135.7588 },
  { id: "shin-osaka", name: "新大阪", kana: "しんおおさか", lat: 34.7334, lon: 135.5002 },
  { id: "shin-kobe", name: "新神戸", kana: "しんこうべ", lat: 34.7066, lon: 135.1955 },
  { id: "okayama", name: "岡山", kana: "おかやま", lat: 34.6664, lon: 133.918 },
  { id: "hiroshima", name: "広島", kana: "ひろしま", lat: 34.3977, lon: 132.4753 },
  { id: "shin-yamaguchi", name: "新山口", kana: "しんやまぐち", lat: 34.0935, lon: 131.3964 },
  { id: "kokura", name: "小倉", kana: "こくら", lat: 33.8868, lon: 130.8826 },
  { id: "hakata", name: "博多", kana: "はかた", lat: 33.5897, lon: 130.4207 },
  // 九州・西九州
  { id: "shin-tosu", name: "新鳥栖", kana: "しんとす", lat: 33.3786, lon: 130.4906 },
  { id: "kumamoto", name: "熊本", kana: "くまもと", lat: 32.7898, lon: 130.6887 },
  { id: "sendai-kagoshima", name: "川内", kana: "せんだい", lat: 31.8157, lon: 130.3068 },
  { id: "kagoshima-chuo", name: "鹿児島中央", kana: "かごしまちゅうおう", lat: 31.5838, lon: 130.5413 },
  { id: "takeo-onsen", name: "武雄温泉", kana: "たけおおんせん", lat: 33.1944, lon: 130.0206 },
  { id: "ureshino-onsen", name: "嬉野温泉", kana: "うれしのおんせん", lat: 33.0977, lon: 130.0213 },
  { id: "shin-omura", name: "新大村", kana: "しんおおむら", lat: 32.9311, lon: 129.957 },
  { id: "isahaya", name: "諫早", kana: "いさはや", lat: 32.8434, lon: 130.0496 },
  { id: "nagasaki", name: "長崎", kana: "ながさき", lat: 32.7523, lon: 129.8702 },
  // 東北・北海道
  { id: "ueno", name: "上野", kana: "うえの", lat: 35.7138, lon: 139.7773 },
  { id: "omiya", name: "大宮", kana: "おおみや", lat: 35.9063, lon: 139.6239 },
  { id: "utsunomiya", name: "宇都宮", kana: "うつのみや", lat: 36.5594, lon: 139.8985 },
  { id: "koriyama", name: "郡山", kana: "こおりやま", lat: 37.3979, lon: 140.3886 },
  { id: "fukushima", name: "福島", kana: "ふくしま", lat: 37.7545, lon: 140.4597 },
  { id: "sendai", name: "仙台", kana: "せんだい", lat: 38.2601, lon: 140.8825 },
  { id: "morioka", name: "盛岡", kana: "もりおか", lat: 39.7016, lon: 141.1365 },
  { id: "hachinohe", name: "八戸", kana: "はちのへ", lat: 40.509, lon: 141.4313 },
  { id: "shin-aomori", name: "新青森", kana: "しんあおもり", lat: 40.8274, lon: 140.6937 },
  { id: "kikonai", name: "木古内", kana: "きこない", lat: 41.6776, lon: 140.4378 },
  { id: "shin-hakodate-hokuto", name: "新函館北斗", kana: "しんはこだてほくと", lat: 41.9048, lon: 140.648 },
  // 秋田
  { id: "tazawako", name: "田沢湖", kana: "たざわこ", lat: 39.6997, lon: 140.7261 },
  { id: "omagari", name: "大曲", kana: "おおまがり", lat: 39.4613, lon: 140.4798 },
  { id: "akita", name: "秋田", kana: "あきた", lat: 39.7167, lon: 140.1297 },
  // 山形
  { id: "yonezawa", name: "米沢", kana: "よねざわ", lat: 37.912, lon: 140.1172 },
  { id: "yamagata", name: "山形", kana: "やまがた", lat: 38.2489, lon: 140.3274 },
  { id: "shinjo", name: "新庄", kana: "しんじょう", lat: 38.7627, lon: 140.3044 },
  // 上越
  { id: "takasaki", name: "高崎", kana: "たかさき", lat: 36.3223, lon: 139.0128 },
  { id: "echigo-yuzawa", name: "越後湯沢", kana: "えちごゆざわ", lat: 36.9357, lon: 138.8093 },
  { id: "nagaoka", name: "長岡", kana: "ながおか", lat: 37.4474, lon: 138.8521 },
  { id: "niigata", name: "新潟", kana: "にいがた", lat: 37.9121, lon: 139.061 },
  // 北陸
  { id: "karuizawa", name: "軽井沢", kana: "かるいざわ", lat: 36.3426, lon: 138.635 },
  { id: "nagano", name: "長野", kana: "ながの", lat: 36.6433, lon: 138.1887 },
  { id: "toyama", name: "富山", kana: "とやま", lat: 36.7014, lon: 137.2133 },
  { id: "kanazawa", name: "金沢", kana: "かなざわ", lat: 36.5781, lon: 136.648 },
  { id: "fukui", name: "福井", kana: "ふくい", lat: 36.062, lon: 136.2233 },
  { id: "tsuruga", name: "敦賀", kana: "つるが", lat: 35.6453, lon: 136.0751 },
];
