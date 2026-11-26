// Tema claro/escuro do app (antes dentro de Profile.tsx).
export type Theme = "dark" | "light";


export const THEME_STORAGE_KEY = "veloxy-theme";

export const getStoredTheme = (): Theme => {
  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
};

export const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const playThemeTransition = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.remove("theme-transitioning", "theme-to-light", "theme-to-dark");
  window.requestAnimationFrame(() => {
    root.classList.add("theme-transitioning");
    window.setTimeout(() => {
      root.classList.remove("theme-transitioning", "theme-to-light", "theme-to-dark");
    }, 440);
  });
};
