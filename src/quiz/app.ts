import { trains } from "../data/trains";
import { railLines } from "../densha/data/lines";
import { denshaSvg } from "../densha/trains/illustration";
import type { Speech } from "../sound/voices";
import { trainSvg } from "../trains/illustration";
import { celebrate, clearCelebration, throwConfetti } from "./feedback";
import { createQuizMap, type QuizMap } from "./maps";
import { correctPhrases, genrePrompt, NEXT_TEXT, resultPrompt, tryPhrases, type Prompt } from "./phrases";
import {
  answerChoice,
  createQuestionSet,
  quizData,
  type Genre,
  type MapView,
  type Question,
  type QuizData,
} from "./questions";
import type { QuizEffects } from "./sound";

export interface QuizOutputs {
  speak(speech: Speech): void;
  stopSpeaking(): void;
  effects: QuizEffects;
}

interface GenreOption {
  genre: Genre;
  kana: string;
  svg: string;
  color: string;
}

interface Answered {
  question: Question;
  correct: boolean;
}

const hayabusa = trains.find((t) => t.id === "hayabusa");
const yamanote = railLines.find((l) => l.id === "yamanote");

const genreOptions: readonly GenreOption[] = [
  { genre: "shinkansen", kana: "しんかんせん", svg: hayabusa ? trainSvg(hayabusa) : "", color: "#00a86b" },
  {
    genre: "densha",
    kana: "でんしゃ",
    svg: yamanote ? denshaSvg(yamanote.vehicle, { label: "でんしゃ" }) : "",
    color: "#f15a22",
  },
];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** クイズ画面: ジャンル選択 → 5 問 → 結果 */
export function createQuizApp(root: HTMLElement, outputs: QuizOutputs): void {
  const { speak, effects } = outputs;
  const screen = el("main", "quiz-screen");
  root.append(screen);

  const dataCache = new Map<Genre, QuizData>();
  const mapCache = new Map<Genre, QuizMap>();
  const cached = <T>(cache: Map<Genre, T>, genre: Genre, make: (genre: Genre) => T): T => {
    const hit = cache.get(genre);
    if (hit) return hit;
    const made = make(genre);
    cache.set(genre, made);
    return made;
  };
  const dataOf = (genre: Genre) => cached(dataCache, genre, quizData);
  // 地図は大きいので、同じジャンルでは使い回す
  const mapOf = (genre: Genre) => cached(mapCache, genre, createQuizMap);

  const say = (prompt: Prompt) => speak(prompt.speech);

  // ---- ジャンル選択 ----
  const showGenreSelect = () => {
    outputs.stopSpeaking();
    clearCelebration(root);
    const title = el("h1", "title quiz-title", genrePrompt.text);
    const nav = el("nav", "quiz-genres");
    for (const option of genreOptions) {
      const b = button("quiz-genre", "", () => {
        effects.tap();
        startSet(option.genre);
      });
      b.style.setProperty("--menu-color", option.color);
      const illustration = el("div", "quiz-genre__illustration");
      illustration.innerHTML = option.svg;
      b.append(illustration, el("span", "quiz-genre__kana", option.kana));
      nav.append(b);
    }
    screen.replaceChildren(title, nav);
    screen.className = "quiz-screen quiz-screen--genre";
  };

  // ---- 出題 ----
  const startSet = (genre: Genre) => {
    const questions = createQuestionSet(dataOf(genre));
    const answered: Answered[] = [];
    const map = mapOf(genre);

    const header = el("div", "quiz-progress");
    const title = el("h1", "title quiz-title");
    const mapFrame = el("div", `quiz-map-frame quiz-map-frame--${genre}`);
    mapFrame.append(map.element);
    const panel = el("section", "quiz-panel");
    const layout = el("div", "quiz-layout");
    layout.append(mapFrame, panel);
    screen.replaceChildren(title, header, layout);
    screen.className = "quiz-screen quiz-screen--question";

    const renderProgress = (index: number) => {
      header.replaceChildren(
        ...questions.map((_, i) => {
          const done = answered[i];
          const dot = el("span", "quiz-progress__dot", done ? (done.correct ? "⭐" : "🌱") : String(i + 1));
          dot.classList.toggle("is-current", i === index);
          dot.classList.toggle("is-done", Boolean(done));
          return dot;
        }),
      );
    };

    const showQuestion = (index: number) => {
      const q = questions[index];
      clearCelebration(root);
      title.textContent = `だい ${index + 1} もん`;
      renderProgress(index);
      map.show(q.view);

      const prompt = el("p", "quiz-prompt", q.prompt.text);
      const again = button("quiz-listen", "🔊 もういちど きく", () => say(q.prompt));
      again.setAttribute("aria-label", "もんだい を もういちど きく");
      const children: HTMLElement[] = [prompt];
      const strip = q.view.kind === "gap" ? stationStrip(q.view, dataOf(genre)) : null;
      if (strip) children.push(strip.element);

      const choices = el("div", "quiz-choices");
      const feedback = el("div", "quiz-feedback");
      feedback.setAttribute("aria-live", "polite");
      const next = button("quiz-next", index + 1 < questions.length ? "つぎ へ ▶" : "けっか を みる ▶", () => {
        effects.tap();
        if (index + 1 < questions.length) showQuestion(index + 1);
        else showResult(genre, answered);
      });
      next.hidden = true;

      const buttons = q.choices.map((choice) => {
        const b = button("quiz-choice", choice.label, () => answer(choice.id));
        b.dataset.choiceId = choice.id;
        if ([...choice.label].length >= 9) b.classList.add("quiz-choice--long");
        return b;
      });
      choices.append(...buttons);

      const answer = (choiceId: string) => {
        if (answered[index]) return;
        const correct = choiceId === q.answerId;
        answered[index] = { question: q, correct };
        const right = answerChoice(q);
        for (const b of buttons) {
          b.disabled = true;
          b.classList.toggle("is-answer", b.dataset.choiceId === q.answerId);
          b.classList.toggle("is-picked", b.dataset.choiceId === choiceId);
        }
        map.reveal(q.view, right.label);
        strip?.reveal(right.label);
        renderProgress(index);

        if (correct) {
          const phrase = pick(correctPhrases);
          effects.fanfare();
          say(phrase);
          const [main, ...rest] = phrase.text.split(" ");
          celebrate(root, main, rest.join(" "));
          feedback.className = "quiz-feedback is-correct";
          feedback.replaceChildren(el("p", "quiz-feedback__main", `🎉 ${phrase.text}`));
        } else {
          const phrase = pick(tryPhrases);
          effects.gentle();
          say(phrase);
          feedback.className = "quiz-feedback is-try";
          const hint = el("p", "quiz-feedback__sub");
          hint.append("こたえ は ", el("strong", "", right.label), ` だよ。${NEXT_TEXT}`);
          feedback.replaceChildren(el("p", "quiz-feedback__main", `🌟 ${phrase.text}`), hint);
        }
        next.hidden = false;
        next.focus();
      };

      panel.replaceChildren(...children, again, choices, feedback, next);
      say(q.prompt);
    };

    showQuestion(0);
  };

  // ---- 結果 ----
  const showResult = (genre: Genre, answered: readonly Answered[]) => {
    clearCelebration(root);
    const total = answered.length;
    const correct = answered.filter((a) => a.correct).length;
    const result = resultPrompt(correct, total);
    const [score, ...praise] = splitResult(result.text);

    const trophy = el("div", "quiz-result__trophy", correct === total ? "🏆" : "🏅");
    const scoreLine = el("p", "quiz-result__score", score);
    const praiseLine = el("p", "quiz-result__praise", praise.join(" "));
    const stars = el(
      "p",
      "quiz-result__stars",
      answered.map((a) => (a.correct ? "⭐" : "🌱")).join(""),
    );
    stars.setAttribute("aria-hidden", "true");

    const review = el("ol", "quiz-review");
    for (const a of answered) {
      const item = el("li", `quiz-review__item ${a.correct ? "is-correct" : "is-try"}`);
      item.append(
        el("span", "quiz-review__mark", a.correct ? "⭐" : "🌱"),
        el("span", "quiz-review__question", a.question.prompt.text),
        el("span", "quiz-review__answer", answerChoice(a.question).label),
      );
      review.append(item);
    }

    const actions = el("div", "quiz-result__actions");
    actions.append(
      button("quiz-action quiz-action--primary", "🔁 もういちど", () => {
        effects.tap();
        startSet(genre);
      }),
      button("quiz-action", "🔀 べつの くいず", () => {
        effects.tap();
        showGenreSelect();
      }),
    );
    const home = el("a", "quiz-action", "🏠 はじめ に もどる");
    home.href = import.meta.env.BASE_URL;
    actions.append(home);

    const card = el("section", "quiz-result");
    card.append(trophy, scoreLine, praiseLine, stars, review, actions);
    screen.replaceChildren(el("h1", "title quiz-title", "けっか はっぴょう"), card);
    screen.className = "quiz-screen quiz-screen--result";

    effects.celebrate();
    say(result);
    throwConfetti(root, 120);
  };

  showGenreSelect();
}

/** 「5もん ちゅう 3もん せいかい！ よく できたね！ すごい！」を 点数 と ほめことば に分ける */
function splitResult(text: string): string[] {
  const i = text.indexOf("せいかい！");
  if (i < 0) return [text];
  const end = i + "せいかい！".length;
  return [text.slice(0, end), text.slice(end).trim()];
}

/** 歯抜け問題の駅の並び (しんじゅく → ？ → しぶや …)。前後の駅名が読めるように */
function stationStrip(view: Extract<MapView, { kind: "gap" }>, data: QuizData) {
  const element = el("ol", "quiz-strip");
  const line = data.lines.find((l) => l.id === view.lineId);
  element.style.setProperty("--line-color", line?.color ?? "#888888");
  const hidden = el("li", "quiz-strip__station is-hidden", "？");
  for (const id of view.stationIds) {
    element.append(id === view.hiddenId ? hidden : el("li", "quiz-strip__station", data.stationKana.get(id) ?? ""));
  }
  return {
    element,
    /** 答え合わせ: 「？」を駅名にする */
    reveal(label: string) {
      hidden.textContent = label;
      hidden.classList.replace("is-hidden", "is-revealed");
    },
  };
}
