/** 画面左上の「もどる」ボタン (トップ画面へ) */
export function addHomeButton(root: HTMLElement): void {
  const link = document.createElement("a");
  link.className = "home-button";
  link.href = import.meta.env.BASE_URL;
  link.setAttribute("aria-label", "はじめ の がめん に もどる");
  link.textContent = "🏠 もどる";
  root.append(link);
}
