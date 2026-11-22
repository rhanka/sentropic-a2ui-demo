/**
 * Sentropic's component stylesheet, loaded the first time Sentropic is picked,
 * not with every page (mirrors `./material-assets`). It also syncs the
 * playground's `.dark` toggle with the attribute Sentropic's compiled theme
 * understands (`:root[data-color-mode="dark"]` wins over the OS preference,
 * `data-color-mode="light"` opts back out of auto-dark): without this, the
 * toggle would re-theme the standard components but leave Sentropic leaves
 * on the OS color scheme.
 */
import "@sentropic/design-system-react/styles.css";

const MODE = "colorMode";

function current(): "dark" | "light" {
  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

function sync() {
  document.documentElement.dataset[MODE] = current();
}

if (typeof document !== "undefined") {
  sync();
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}
