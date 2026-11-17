import { t as translate } from "../../i18n";
import type { ProfileRecord } from "../../sidecar/types";

/**
 * The context menu, as data.
 *
 * Which entries a row offers depends on whether it is running, trashed, favourite
 * and whether a bulk selection is active -- four inputs whose combinations are
 * exactly where a menu grows a "Delete" that fires on a running browser. Building
 * the list as data means those combinations are enumerable in a test instead of
 * reachable only by right-clicking the right row in the right state.
 *
 * Labels are translated where the menu is built, not where it is stored: the
 * table is rebuilt on every render, so a language change reaches it without a
 * separate cache to invalidate.
 */

export type RowAction =
  | "check-proxy"
  | "cookies"
  | "cookies-export-json"
  | "cookies-import"
  | "cookie-bot"
  | "launch"
  | "stop"
  | "open"
  | "duplicate"
  | "favorite"
  | "unfavorite"
  | "move"
  | "tag"
  | "export"
  | "delete"
  | "restore"
  | "purge"
  | "bulk-launch"
  | "bulk-stop"
  | "bulk-move"
  | "bulk-tag"
  | "bulk-delete"
  | "bulk-restore"
  | "bulk-purge";

export interface MenuItem {
  action: RowAction;
  label: string;
  children?: MenuItem[];
  /** Renders the entry as the destructive one, and puts it behind a confirmation. */
  danger?: boolean;
  /** Present but unavailable, with the reason spoken -- a missing entry teaches nothing. */
  disabledReason?: string | undefined;
  /** Starts a visual group. */
  separatorBefore?: boolean;
}

export interface RowMenuContext {
  checkingProxy?: boolean;
  profile: ProfileRecord;
  running: boolean;
  trashed: boolean;
  /** How many rows the action would hit, counting this one. */
  selectionSize: number;
  /** Ids in the selection that are currently running, for the bulk labels. */
  runningInSelection: number;
}

/**
 * Bulk labels say how many rows they hit, so a click is never a surprise.
 *
 * Chinese has no plural form, so the dictionary maps both halves of a pair onto
 * one sentence; the source English keeps the distinction where the noun carries
 * it.
 */
function count(one: string, many: string, value: number): string {
  return translate(value === 1 ? one : many, { count: value });
}

function bulkMenu(context: RowMenuContext): MenuItem[] {
  const { selectionSize, runningInSelection, trashed } = context;
  const stopped = selectionSize - runningInSelection;

  if (trashed) {
    return [
      { action: "bulk-restore", label: count("Restore {count} profile", "Restore {count} profiles", selectionSize) },
      {
        action: "bulk-purge",
        label: count("Delete {count} profile permanently", "Delete {count} profiles permanently", selectionSize),
        danger: true,
        separatorBefore: true,
      },
    ];
  }

  return [
    {
      action: "bulk-launch",
      label: count("Launch {count} profile", "Launch {count} profiles", stopped),
      disabledReason: stopped === 0 ? translate("Every selected profile is already running") : undefined,
    },
    {
      action: "bulk-stop",
      label: count("Stop {count} profile", "Stop {count} profiles", runningInSelection),
      disabledReason: runningInSelection === 0 ? translate("No selected profile is running") : undefined,
    },
    { action: "bulk-move", label: translate("Move to folder…"), separatorBefore: true },
    { action: "bulk-tag", label: translate("Edit tags…") },
    {
      action: "bulk-delete",
      label: count("Move {count} profile to trash", "Move {count} profiles to trash", selectionSize),
      danger: true,
      separatorBefore: true,
      disabledReason:
        runningInSelection > 0
          ? count("Stop {count} running profile first", "Stop {count} running profiles first", runningInSelection)
          : undefined,
    },
  ];
}

export function buildRowMenu(context: RowMenuContext): MenuItem[] {
  if (context.selectionSize > 1) {
    return bulkMenu(context);
  }

  if (context.trashed) {
    return [
      { action: "restore", label: translate("Restore") },
      { action: "purge", label: translate("Delete permanently"), danger: true, separatorBefore: true },
    ];
  }

  const { running, profile } = context;

  return [
    running ? { action: "stop", label: translate("Stop") } : { action: "launch", label: translate("Launch") },
    { action: "open", label: translate("Edit profile") },
    {
      action: "check-proxy",
      label: context.checkingProxy ? translate("Checking proxy…") : translate("Check proxy"),
      disabledReason: context.checkingProxy ? translate("A proxy check is already running") : undefined,
    },
    { action: "duplicate", label: translate("Duplicate"), separatorBefore: true },
    profile.organization.favorite
      ? { action: "unfavorite", label: translate("Remove from favorites") }
      : { action: "favorite", label: translate("Add to favorites") },
    { action: "move", label: translate("Move to folder…") },
    { action: "tag", label: translate("Edit tags…") },
    { action: "export", label: translate("Export…"), separatorBefore: true },
    {
      action: "cookies",
      label: translate("Cookies"),
      children: [
        {
          action: "cookies-export-json",
          label: translate("Export (JSON)…"),
          disabledReason: running ? translate("Stop the profile first") : undefined,
        },
        {
          action: "cookies-import",
          label: translate("Import…"),
          disabledReason: running ? translate("Stop the profile first") : undefined,
        },
      ],
    },
    { action: "cookie-bot", label: translate("Run Cookie Bot…") },
    {
      action: "delete",
      label: translate("Move to trash"),
      danger: true,
      separatorBefore: true,
      // Deleting a profile whose browser is live would pull the user-data
      // directory out from under a running Chromium.
      disabledReason: running ? translate("Stop the profile first") : undefined,
    },
  ];
}

/** Actions that need a confirmation step before they run. */
export function requiresConfirmation(action: RowAction): boolean {
  return (
    action === "cookies-import" ||
    action === "delete" ||
    action === "purge" ||
    action === "bulk-delete" ||
    action === "bulk-purge"
  );
}
