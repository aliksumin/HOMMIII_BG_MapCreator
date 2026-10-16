import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { GLYPHS } from "./data/catalog.ts";
import { setKnownGlyphs } from "./lib/markup.ts";
import "./styles/theme.css";

setKnownGlyphs(GLYPHS);

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}