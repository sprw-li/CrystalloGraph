import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell, setupI18n } from "@cgraph/core";
import "@cgraph/core/styles.css";

setupI18n("zh");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell mode="desktop" />
  </StrictMode>,
);
