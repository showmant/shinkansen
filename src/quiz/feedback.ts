/** 正解・結果発表のお祝い演出 (画面中央の大きな文字 + 紙吹雪 + きらきら) */

const CONFETTI_COLORS = ["#ff6b6b", "#ffc107", "#4caf50", "#29b6f6", "#ab47bc", "#ff8a65", "#f06292"];
const SPARKLES = ["✨", "⭐", "🌟", "🎉"];
const BURST_MS = 2200;

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 画面いっぱいに紙吹雪を降らせる。アニメーションが終わったら消える */
export function throwConfetti(host: HTMLElement, count = 80): void {
  if (reducedMotion()) return;
  const layer = document.createElement("div");
  layer.className = "quiz-confetti";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = i % 6 === 0 ? "quiz-confetti__sparkle" : "quiz-confetti__piece";
    if (i % 6 === 0) piece.textContent = pick(SPARKLES);
    else piece.style.background = pick(CONFETTI_COLORS);
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty("--spin", `${(Math.random() - 0.5) * 1440}deg`);
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    layer.append(piece);
  }
  host.append(layer);
  window.setTimeout(() => layer.remove(), 4000);
}

/** 画面中央に大きな「せいかい！」(main) と ほめことば (sub) を出して紙吹雪。少ししたら消える */
export function celebrate(host: HTMLElement, main: string, sub: string): void {
  clearCelebration(host);
  const burst = document.createElement("div");
  burst.className = "quiz-burst";
  burst.setAttribute("aria-hidden", "true");
  const card = document.createElement("div");
  card.className = "quiz-burst__card";
  const word = document.createElement("span");
  word.className = "quiz-burst__main";
  word.textContent = main;
  card.append(word);
  if (sub) {
    const rest = document.createElement("span");
    rest.className = "quiz-burst__sub";
    rest.textContent = sub;
    card.append(rest);
  }
  burst.append(card);
  host.append(burst);
  throwConfetti(host);
  window.setTimeout(() => burst.remove(), BURST_MS);
}

/** つぎの問題に進んだら、お祝いの文字と紙吹雪を片づける */
export function clearCelebration(host: HTMLElement): void {
  host.querySelectorAll(".quiz-burst, .quiz-confetti").forEach((e) => e.remove());
}
