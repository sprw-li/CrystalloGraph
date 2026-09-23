import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { SPACE_GROUP_IDS, SPACE_GROUPS, type SpaceGroupId } from "../symmetry/groups";
import { DrawingCanvas } from "./DrawingCanvas";
import { Hotkeys } from "./Hotkeys";
import { ToolIcon } from "./ToolIcon";
import { downloadCgraph, openCgraphFromFile } from "../io/cgraph";
import { exportDocumentPng } from "../io/exportPng";
import { downloadDocumentSvg } from "../io/exportSvg";
import { setupI18n } from "../i18n";
import { useEffect, useRef, useState } from "react";
import type { ToolId } from "../document/types";

const THEMES = ["classic", "teal", "blue", "amber", "rose"] as const;

const TOOLS: ToolId[] = [
  "selectBox",
  "selectLasso",
  "move",
  "pen",
  "eraser",
  "line",
  "rect",
  "ellipse",
];

export type AppShellProps = {
  mode: "desktop" | "web";
};

export function AppShell({ mode }: AppShellProps) {
  const { t, i18n } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = useAppStore((s) => s.lang);
  const doc = useAppStore((s) => s.doc);
  const tool = useAppStore((s) => s.tool);
  const mirrorOn = useAppStore((s) => s.mirrorOn);
  const mandalaOn = useAppStore((s) => s.mandalaOn);
  const mandalaN = useAppStore((s) => s.mandalaN);
  const color = useAppStore((s) => s.color);
  const lineWidth = useAppStore((s) => s.lineWidth);
  const eraserMode = useAppStore((s) => s.eraserMode);
  const eraserSize = useAppStore((s) => s.eraserSize);
  const groupLocked = useAppStore((s) => s.groupLocked);
  const previewGroup = useAppStore((s) => s.previewGroup);
  const view = useAppStore((s) => s.view);
  const zoom = useAppStore((s) => s.zoom);
  const betterHint = useAppStore((s) => s.betterHint);
  const cellUnlockPrompt = useAppStore((s) => s.cellUnlockPrompt);
  const cursorPolar = useAppStore((s) => s.cursorPolar);
  const historyLen = useAppStore((s) => s.history.length);
  const futureLen = useAppStore((s) => s.future.length);
  const theme = useAppStore((s) => s.theme);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "svg">("png");
  const [exportOpts, setExportOpts] = useState({
    includeMainFrame: true,
    includeSpecialPoints: true,
    includeOtherFrames: false,
    includeSymCopies: true,
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    useAppStore.getState().setMode(mode);
    setupI18n(lang);
  }, [mode, lang]);

  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [lang, i18n]);

  return (
    <div className="cgraph-root">
      <Hotkeys />
      <header className="cgraph-top">
        <strong className="cgraph-brand">{t("appName")}</strong>
        <div className="cgraph-menubar">
          <button type="button" onClick={() => useAppStore.getState().newDoc()}>
            {t("new")}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            {t("open")}
          </button>
          <button
            type="button"
            onClick={() => downloadCgraph(useAppStore.getState().doc)}
          >
            {t("save")}
          </button>
          <button type="button" onClick={() => { setExportFormat("png"); setExportOpen(true); }}>
            {t("exportPng")}
          </button>
          <button type="button" onClick={() => { setExportFormat("svg"); setExportOpen(true); }}>
            {t("exportSvg")}
          </button>
          <span className="cgraph-sep" />
          <button
            type="button"
            disabled={historyLen === 0}
            onClick={() => useAppStore.getState().undo()}
          >
            {t("undo")}
          </button>
          <button
            type="button"
            disabled={futureLen === 0}
            onClick={() => useAppStore.getState().redo()}
          >
            {t("redo")}
          </button>
          <span className="cgraph-sep" />
          <button
            type="button"
            onClick={() => useAppStore.getState().zoomBy(1 / 1.15)}
          >
            −
          </button>
          <span className="cgraph-zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => useAppStore.getState().zoomBy(1.15)}>
            +
          </button>
          <span className="cgraph-sep" />
          <label className="cgraph-inline">
            {t("language")}
            <select
              value={lang}
              onChange={(e) =>
                useAppStore.getState().setLang(e.target.value as "zh" | "en")
              }
            >
              <option value="zh">中文</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label className="cgraph-inline">
            {t("theme")}
            <select
              value={theme}
              onChange={(e) =>
                useAppStore
                  .getState()
                  .setTheme(e.target.value as (typeof THEMES)[number])
              }
            >
              {THEMES.map((id) => (
                <option key={id} value={id}>
                  {t(`theme.${id}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".cgraph,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const d = await openCgraphFromFile(f);
              useAppStore.getState().loadDoc(d);
            } catch (err) {
              alert(String(err));
            }
            e.target.value = "";
          }}
        />
      </header>

      <div className="cgraph-body">
        <aside className="cgraph-left">
          <h3>{t("tools")}</h3>
          <div className="cgraph-tools">
            {TOOLS.map((id) => (
              <button
                key={id}
                type="button"
                className={`cgraph-tool-btn${tool === id ? " active" : ""}`}
                title={t(`tool.${id}`)}
                aria-label={t(`tool.${id}`)}
                onClick={() => useAppStore.getState().setTool(id)}
              >
                <ToolIcon id={id} />
                <span className="cgraph-tool-label">{t(`tool.${id}`)}</span>
              </button>
            ))}
          </div>

          <h3>{t("modifiers")}</h3>
          <button
            type="button"
            className={mirrorOn ? "active" : ""}
            onClick={() => useAppStore.getState().toggleMirror()}
          >
            {t("modifier.mirror")}
          </button>
          <button
            type="button"
            className={mandalaOn ? "active" : ""}
            onClick={() => useAppStore.getState().toggleMandala()}
          >
            {t("modifier.mandala")}
          </button>
          {mandalaOn && (
            <label className="cgraph-subpanel">
              {t("mandalaN")}
              <input
                type="range"
                min={2}
                max={16}
                value={mandalaN}
                onChange={(e) =>
                  useAppStore.getState().setMandalaN(Number(e.target.value))
                }
              />
              <span>{mandalaN}</span>
            </label>
          )}
          {(mirrorOn || mandalaOn) && (
            <p className="cgraph-hint">{t("handleHint")}</p>
          )}

          {tool === "eraser" && (
            <div className="cgraph-subpanel">
              <h3>{t("eraserMode")}</h3>
              <label className="cgraph-check">
                <input
                  type="radio"
                  name="eraserMode"
                  checked={eraserMode === "stroke"}
                  onChange={() =>
                    useAppStore.getState().setEraserMode("stroke")
                  }
                />
                {t("eraserStroke")}
              </label>
              <label className="cgraph-check">
                <input
                  type="radio"
                  name="eraserMode"
                  checked={eraserMode === "path"}
                  onChange={() => useAppStore.getState().setEraserMode("path")}
                />
                {t("eraserPath")}
              </label>
              {eraserMode === "path" && (
                <label className="cgraph-subpanel">
                  {t("eraserSize")}
                  <input
                    type="range"
                    min={4}
                    max={64}
                    value={eraserSize}
                    onChange={(e) =>
                      useAppStore.getState().setEraserSize(Number(e.target.value))
                    }
                  />
                  <span>{eraserSize}px</span>
                </label>
              )}
            </div>
          )}

          <p className="cgraph-hint">
            {mode === "web" ? t("webShellHint") : t("desktopHint")}
            <br />
            {t("pressureHint")}
          </p>
        </aside>

        <main className="cgraph-main">
          <DrawingCanvas />
        </main>

        <aside className="cgraph-right">
          <h3>{t("cell")}</h3>
          {(
            [
              ["a", "a", 20, 400],
              ["b", "b", 20, 400],
              ["theta", "thetaDeg", 1, 179],
            ] as const
          ).map(([label, key, min, max]) => {
            const cellView = cellUnlockPrompt?.intendedCell ?? doc.cell;
            return (
            <label key={key}>
              {t(label)}
              <div className="cgraph-slider-row">
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={cellView[key]}
                  onChange={(e) =>
                    useAppStore
                      .getState()
                      .setCellDraft({ [key]: Number(e.target.value) })
                  }
                  onMouseUp={() => useAppStore.getState().commitCell()}
                  onTouchEnd={() => useAppStore.getState().commitCell()}
                />
                <input
                  type="number"
                  min={key === "thetaDeg" ? 1 : min}
                  max={key === "thetaDeg" ? 179 : undefined}
                  step={key === "thetaDeg" ? 0.1 : 1}
                  value={
                    key === "thetaDeg"
                      ? Number(cellView[key].toFixed(2))
                      : Math.round(cellView[key])
                  }
                  onChange={(e) => {
                    useAppStore
                      .getState()
                      .setCellDraft({ [key]: Number(e.target.value) });
                    useAppStore.getState().commitCell();
                  }}
                />
              </div>
            </label>
            );
          })}
          <label className="cgraph-check" title={t("lockGroupHint")}>
            <input
              type="checkbox"
              checked={groupLocked}
              onChange={(e) =>
                useAppStore.getState().setGroupLocked(e.target.checked)
              }
            />
            {t("lockGroup")}
          </label>
          <p className="cgraph-hint">{t("lockGroupHint")}</p>
          {previewGroup && previewGroup !== doc.spaceGroup && (
            <div className="cgraph-preview">
              <p>
                {t("suggestGroup")}: <strong>{previewGroup}</strong>
              </p>
              <button
                type="button"
                onClick={() => useAppStore.getState().applyPreviewGroup()}
              >
                {t("applySuggestGroup")}
              </button>
            </div>
          )}

          <h3>{t("spaceGroup")}</h3>
          <div className="cgraph-groups">
            {SPACE_GROUP_IDS.map((id) => {
              const compatible =
                id === doc.spaceGroup || SPACE_GROUPS[id].matchesHard(doc.cell);
              return (
                <button
                  key={id}
                  type="button"
                  className={`${doc.spaceGroup === id ? "active" : ""}${
                    compatible ? "" : " muted"
                  }`}
                  title={
                    compatible
                      ? id
                      : `${id}（与当前 a/b/θ 不完全匹配，点击将调整晶胞）`
                  }
                  onClick={() =>
                    useAppStore.getState().setSpaceGroup(id as SpaceGroupId)
                  }
                >
                  {id}
                </button>
              );
            })}
          </div>

          <h3>{t("view")}</h3>
          {(
            [
              ["showMainFrame", "showMainFrame"],
              ["showMainFrameOnly", "showMainFrameOnly"],
              ["showSymCopies", "showSymCopies"],
              ["showOtherFrames", "showOtherFrames"],
              ["showSpecialPoints", "showSpecialPoints"],
              ["snapSpecial", "snapSpecial"],
              ["snapCurve", "snapCurve"],
              ["lockR", "lockR"],
              ["lockPhi", "lockPhi"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="cgraph-check" title={key === "snapCurve" ? t("snapCurveHint") : undefined}>
              <input
                type="checkbox"
                checked={view[key]}
                onChange={(e) =>
                  useAppStore.getState().setView({ [key]: e.target.checked })
                }
              />
              {t(label)}
            </label>
          ))}
          <p className="cgraph-hint">{t("snapCurveHint")}</p>
        </aside>
      </div>

      <footer className="cgraph-bottom">
        <label>
          {t("color")}
          <input
            type="color"
            value={color}
            onChange={(e) => useAppStore.getState().setColor(e.target.value)}
          />
        </label>
        <label>
          {t("width")}
          <input
            type="range"
            min={1}
            max={24}
            value={lineWidth}
            onChange={(e) =>
              useAppStore.getState().setLineWidth(Number(e.target.value))
            }
          />
          <span>{lineWidth}</span>
        </label>
        <span className="cgraph-polar">
          {cursorPolar
            ? `r=${cursorPolar.r.toFixed(1)}  φ=${((cursorPolar.phi * 180) / Math.PI).toFixed(1)}°`
            : "r=—  φ=—"}
        </span>
        <span className="cgraph-group-tag">{doc.spaceGroup}</span>
      </footer>

      {cellUnlockPrompt && (
        <div className="cgraph-modal-backdrop">
          <div className="cgraph-modal">
            {cellUnlockPrompt.step === "unlock" ? (
              <>
                <h3>{t("cellUnlockTitle")}</h3>
                <p>{t("cellUnlockBody")}</p>
                <p>
                  {cellUnlockPrompt.fromGroup} → p1 / a=
                  {cellUnlockPrompt.intendedCell.a.toFixed(1)} b=
                  {cellUnlockPrompt.intendedCell.b.toFixed(1)} θ=
                  {cellUnlockPrompt.intendedCell.thetaDeg.toFixed(0)}°
                </p>
                <div className="cgraph-modal-actions">
                  <button
                    type="button"
                    onClick={() => useAppStore.getState().resolveCellUnlockToP1()}
                  >
                    {t("cellUnlockToP1")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      useAppStore.getState().resolveCellUnlockKeepLinked()
                    }
                  >
                    {t("cellUnlockKeepLinked")}
                  </button>
                  <button
                    type="button"
                    onClick={() => useAppStore.getState().dismissCellUnlock()}
                  >
                    {t("cellUnlockCancel")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{t("cellUnlockKeepPatternTitle")}</h3>
                <p>{t("cellUnlockKeepPatternBody")}</p>
                <div className="cgraph-modal-actions">
                  <button
                    type="button"
                    onClick={() =>
                      useAppStore.getState().resolveCellUnlockKeepPattern()
                    }
                  >
                    {t("cellUnlockKeepPattern")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      useAppStore.getState().resolveCellUnlockDiscardPattern()
                    }
                  >
                    {t("cellUnlockDiscardPattern")}
                  </button>
                  <button
                    type="button"
                    onClick={() => useAppStore.getState().dismissCellUnlock()}
                  >
                    {t("cellUnlockCancel")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {betterHint && !cellUnlockPrompt && (
        <div className="cgraph-modal-backdrop">
          <div className="cgraph-modal">
            <h3>{t("betterCellTitle")}</h3>
            <p>{t(betterHint.reasonKey)}</p>
            <p>
              → {betterHint.targetGroup} / a={betterHint.suggested.a.toFixed(1)}{" "}
              b={betterHint.suggested.b.toFixed(1)} θ=
              {betterHint.suggested.thetaDeg.toFixed(0)}°
            </p>
            <div className="cgraph-modal-actions">
              <button
                type="button"
                onClick={() => useAppStore.getState().applyBetterHint()}
              >
                {t("betterCellApply")}
              </button>
              <button
                type="button"
                onClick={() => useAppStore.getState().dismissBetterHint(false)}
              >
                {t("betterCellCancel")}
              </button>
              <button
                type="button"
                onClick={() => useAppStore.getState().dismissBetterHint(true)}
              >
                {t("betterCellDontAsk")}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="cgraph-modal-backdrop">
          <div className="cgraph-modal">
            <h3>{exportFormat === "svg" ? t("exportSvgTitle") : t("exportPngTitle")}</h3>
            <p className="cgraph-hint">{t("exportPngHint")}</p>
            {(
              [
                ["includeMainFrame", "exportIncludeMainFrame"],
                ["includeSpecialPoints", "exportIncludeSpecialPoints"],
                ["includeOtherFrames", "exportIncludeOtherFrames"],
                ["includeSymCopies", "exportIncludeSymCopies"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="cgraph-check">
                <input
                  type="checkbox"
                  checked={exportOpts[key]}
                  onChange={(e) =>
                    setExportOpts((o) => ({ ...o, [key]: e.target.checked }))
                  }
                />
                {t(label)}
              </label>
            ))}
            <div className="cgraph-modal-actions">
              <button
                type="button"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    const docNow = useAppStore.getState().doc;
                    if (exportFormat === "svg") {
                      downloadDocumentSvg(docNow, exportOpts);
                    } else {
                      await exportDocumentPng(docNow, exportOpts);
                    }
                    setExportOpen(false);
                  } catch (err) {
                    alert(String(err));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? "…" : t("exportPngConfirm")}
              </button>
              <button type="button" onClick={() => setExportOpen(false)}>
                {t("betterCellCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
