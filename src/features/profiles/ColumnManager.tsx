import { useEffect, useRef, useState } from "react";

import {
  type ColumnKey,
  type ColumnLayout,
  columnByKey,
  columnLabel,
  defaultLayout,
  moveColumn,
  setColumnVisible,
  visibleColumns,
} from "./columns";
import { useT } from "../../i18n";
import styles from "./ColumnManager.module.css";

interface ColumnManagerProps {
  layout: ColumnLayout;
  onApply: (layout: ColumnLayout) => void;
  onClose: () => void;
}

/**
 * The column picker.
 *
 * It edits a draft and commits on Apply rather than writing through on every
 * click. Live-applying looks responsive and is worse: each toggle re-lays out the
 * whole grid underneath the panel the user is reading, and there is no way back
 * from four toggles ago.
 */
export function ColumnManager({ layout, onApply, onClose }: ColumnManagerProps) {
  const t = useT();
  const [draft, setDraft] = useState<ColumnLayout>(layout);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reopening on a layout changed elsewhere should not resurrect an old draft.
  useEffect(() => setDraft(layout), [layout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const movable = draft.filter((entry) => columnByKey(entry.key).locked !== true);
  const dirty =
    draft.length !== layout.length ||
    draft.some((entry, index) => entry.key !== layout[index]?.key || entry.visible !== layout[index]?.visible);

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label={t("Choose columns")}
      aria-modal="false"
      tabIndex={-1}
    >
      <p className={styles.hint}>
        {t("{shown} of {total} columns shown", { shown: visibleColumns(draft).length, total: draft.length })}
      </p>

      <ul className={styles.list}>
        {movable.map((entry) => {
          const column = columnByKey(entry.key);
          const positionInLayout = draft.findIndex((candidate) => candidate.key === entry.key);
          const indexInMovable = movable.findIndex((candidate) => candidate.key === entry.key);

          return (
            <li key={entry.key} className={styles.item}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={entry.visible}
                  onChange={(event) => setDraft(setColumnVisible(draft, entry.key, event.target.checked))}
                />
                <span>{columnLabel(column)}</span>
              </label>

              <span className={styles.reorder}>
                <button
                  type="button"
                  aria-label={t("Move {column} up", { column: columnLabel(column) })}
                  disabled={indexInMovable === 0}
                  onClick={() => setDraft(moveColumn(draft, entry.key, positionInLayout - 1))}
                >
                  <span aria-hidden="true">▲</span>
                </button>
                <button
                  type="button"
                  aria-label={t("Move {column} down", { column: columnLabel(column) })}
                  disabled={indexInMovable === movable.length - 1}
                  onClick={() => setDraft(moveColumn(draft, entry.key, positionInLayout + 1))}
                >
                  <span aria-hidden="true">▼</span>
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => setDraft(defaultLayout())}>
          {t("Reset")}
        </button>
        <span className={styles.spacer} />
        <button type="button" className={styles.secondary} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!dirty}
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {t("Apply")}
        </button>
      </div>
    </div>
  );
}

export type { ColumnKey };
