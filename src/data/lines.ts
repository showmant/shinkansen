import type { Line } from "./types";

/**
 * 新幹線の路線。stationIds は列車の運行実態に合わせて並べる
 * (上越・北陸は東京から東北新幹線に乗り入れるため、分岐駅から記載)。
 */
export const lines: readonly Line[] = [
  {
    id: "tokaido",
    name: "東海道新幹線",
    kana: "とうかいどうしんかんせん",
    color: "#0068b7",
    stationIds: ["tokyo", "shin-yokohama", "shizuoka", "hamamatsu", "nagoya", "kyoto", "shin-osaka"],
  },
  {
    id: "sanyo",
    name: "山陽新幹線",
    kana: "さんようしんかんせん",
    color: "#00a0e9",
    stationIds: ["shin-osaka", "shin-kobe", "okayama", "hiroshima", "shin-yamaguchi", "kokura", "hakata"],
  },
  {
    id: "kyushu",
    name: "九州新幹線",
    kana: "きゅうしゅうしんかんせん",
    color: "#e60012",
    stationIds: ["hakata", "shin-tosu", "kumamoto", "sendai-kagoshima", "kagoshima-chuo"],
  },
  {
    id: "nishi-kyushu",
    name: "西九州新幹線",
    kana: "にしきゅうしゅうしんかんせん",
    color: "#a0522d",
    stationIds: ["takeo-onsen", "ureshino-onsen", "shin-omura", "isahaya", "nagasaki"],
  },
  {
    id: "tohoku",
    name: "東北新幹線",
    kana: "とうほくしんかんせん",
    color: "#00a650",
    stationIds: [
      "tokyo",
      "ueno",
      "omiya",
      "utsunomiya",
      "koriyama",
      "fukushima",
      "sendai",
      "morioka",
      "hachinohe",
      "shin-aomori",
    ],
  },
  {
    id: "hokkaido",
    name: "北海道新幹線",
    kana: "ほっかいどうしんかんせん",
    color: "#9b72b0",
    stationIds: ["shin-aomori", "kikonai", "shin-hakodate-hokuto"],
  },
  {
    id: "akita",
    name: "秋田新幹線",
    kana: "あきたしんかんせん",
    color: "#e4007f",
    stationIds: ["morioka", "tazawako", "omagari", "akita"],
  },
  {
    id: "yamagata",
    name: "山形新幹線",
    kana: "やまがたしんかんせん",
    color: "#f5b800",
    stationIds: ["fukushima", "yonezawa", "yamagata", "shinjo"],
  },
  {
    id: "joetsu",
    name: "上越新幹線",
    kana: "じょうえつしんかんせん",
    color: "#ee7800",
    stationIds: ["omiya", "takasaki", "echigo-yuzawa", "nagaoka", "niigata"],
  },
  {
    id: "hokuriku",
    name: "北陸新幹線",
    kana: "ほくりくしんかんせん",
    color: "#1d2088",
    stationIds: ["takasaki", "karuizawa", "nagano", "toyama", "kanazawa", "fukui", "tsuruga"],
  },
];
