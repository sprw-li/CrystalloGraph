import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@cgraph/core";
import "@cgraph/core/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell mode="desktop" />
  </StrictMode>,
);
