import { useEffect, useState } from "react";

/** Follows <html data-theme> (the global theme switch), so 3D lighting can flip with it. */
export function useDocumentTheme() {
  const read = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [theme, setTheme] = useState<"dark" | "light">(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}
