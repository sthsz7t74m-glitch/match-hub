(() => {
  const THEME_KEY = "sportsHubTheme";
  const root = document.documentElement;
  const themeButton = document.getElementById("themeButton");
  const toast = document.getElementById("toast");
  let toastTimer = null;

  const storedTheme = localStorage.getItem(THEME_KEY);
  const preferredTheme = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  applyTheme(storedTheme || preferredTheme);

  themeButton?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  });

  document.querySelectorAll(".coming-soon").forEach((card) => {
    card.addEventListener("click", () => {
      const label = card.querySelector("h2")?.textContent?.trim() || "この競技";
      showToast(`${label}は現在準備中です`);
    });
  });

  function applyTheme(theme) {
    root.dataset.theme = theme;
    if (themeButton) {
      themeButton.textContent = theme === "light" ? "☾" : "◐";
      themeButton.setAttribute("aria-label", theme === "light" ? "ダークモードに切替" : "ライトモードに切替");
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }
})();
