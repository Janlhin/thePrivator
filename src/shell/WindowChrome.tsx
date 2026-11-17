import type { MouseEvent } from "react";

import { closeWindow, minimizeWindow, startDragging, toggleMaximizeWindow } from "../windowControls";
import { useT } from "../i18n";
import styles from "./WindowChrome.module.css";

/**
 * The frameless title bar.
 *
 * The window controls sit OUTSIDE the drag region on purpose: a button inside it
 * would start a window drag on press instead of firing. WebKitGTK also does not
 * implement double-click-to-maximise for a custom chrome, so the drag region does
 * it explicitly.
 */
export function WindowChrome() {
  const t = useT();
  const handleDragStart = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.defaultPrevented) {
      return;
    }
    void startDragging();
  };

  return (
    <header className={styles.chrome} aria-label={t("ThePrivator window chrome")}>
      <div
        className={styles.dragRegion}
        data-tauri-drag-region
        aria-label={t("Window drag region")}
        onMouseDown={handleDragStart}
        onDoubleClick={() => void toggleMaximizeWindow()}
      >
        <img className={styles.mark} src="/favicon.svg" alt="" draggable={false} />
        <span className={styles.title}>ThePrivator</span>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.control}
          aria-label={t("Minimize window")}
          onClick={() => void minimizeWindow()}
        >
          <span aria-hidden="true">&#x2500;</span>
        </button>
        <button
          type="button"
          className={styles.control}
          aria-label={t("Maximize or restore window")}
          onClick={() => void toggleMaximizeWindow()}
        >
          <span aria-hidden="true">&#x25A1;</span>
        </button>
        <button
          type="button"
          className={`${styles.control} ${styles.close}`}
          aria-label={t("Close window")}
          onClick={() => void closeWindow()}
        >
          <span aria-hidden="true">&#x2715;</span>
        </button>
      </div>
    </header>
  );
}
