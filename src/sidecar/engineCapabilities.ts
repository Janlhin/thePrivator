import type { EngineId } from "./types";

/**
 * Frontend mirror of the sidecar capability matrix in `engines.py`.
 *
 * Keep both in lock-step: a channel the matrix marks unavailable must render
 * as a disabled control with a reason, never as an editable field that silently
 * does nothing.
 */
const FINGERPRINT_AVAILABLE: Record<EngineId, boolean> = {
  chromium: true,
  firefox: false,
};

/** Whether the given engine exposes ThePrivator's fingerprint injection channel. */
export function fingerprintChannelAvailable(engine: EngineId | undefined): boolean {
  return FINGERPRINT_AVAILABLE[engine ?? "chromium"];
}
