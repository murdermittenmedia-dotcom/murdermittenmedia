/**
 * radioAdminBroadcast — Module-level singleton.
 *
 * MusicReview (admin only) registers its broadcast functions here when the
 * page mounts. FloatingPlayer reads them and calls them after every admin
 * playback action (seek, pause, resume, restart).
 * When MusicReview unmounts, it clears all registrations.
 *
 * This avoids prop-drilling through App.tsx while keeping the pattern simple.
 */

let _seekFn: ((time: number) => void) | null = null;
let _pauseFn: ((currentTime: number) => void) | null = null;
let _resumeFn: ((currentTime: number) => void) | null = null;

// ── Seek ──────────────────────────────────────────────────────────────────────

/** MusicReview calls this (admin only) to register the seek broadcast function */
export function registerSeekBroadcast(fn: ((time: number) => void) | null) {
  _seekFn = fn;
}

/** FloatingPlayer calls this to broadcast a seek to all listeners */
export function emitSeekBroadcast(time: number) {
  _seekFn?.(time);
}

/** Returns true if a seek broadcast function is currently registered */
export function hasSeekBroadcast(): boolean {
  return _seekFn !== null;
}

// ── Pause ─────────────────────────────────────────────────────────────────────

/** MusicReview calls this (admin only) to register the pause broadcast function */
export function registerPauseBroadcast(fn: ((currentTime: number) => void) | null) {
  _pauseFn = fn;
}

/** FloatingPlayer calls this to broadcast a pause to all listeners */
export function emitPauseBroadcast(currentTime: number) {
  _pauseFn?.(currentTime);
}

// ── Resume ────────────────────────────────────────────────────────────────────

/** MusicReview calls this (admin only) to register the resume broadcast function */
export function registerResumeBroadcast(fn: ((currentTime: number) => void) | null) {
  _resumeFn = fn;
}

/** FloatingPlayer calls this to broadcast a resume to all listeners */
export function emitResumeBroadcast(currentTime: number) {
  _resumeFn?.(currentTime);
}
