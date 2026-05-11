/**
 * radioSeekBroadcast — Module-level singleton.
 *
 * MusicReview (admin only) registers its broadcastRadioSeek function here
 * when the page mounts. FloatingPlayer reads it and calls it after every seek.
 * When MusicReview unmounts, it clears the registration.
 *
 * This avoids prop-drilling through App.tsx while keeping the pattern simple.
 */

let _seekBroadcastFn: ((time: number) => void) | null = null;

/** MusicReview calls this (admin only) to register the seek broadcast function */
export function registerSeekBroadcast(fn: ((time: number) => void) | null) {
  _seekBroadcastFn = fn;
}

/** FloatingPlayer calls this to broadcast a seek to all listeners */
export function emitSeekBroadcast(time: number) {
  _seekBroadcastFn?.(time);
}

/** Returns true if a seek broadcast function is currently registered */
export function hasSeekBroadcast(): boolean {
  return _seekBroadcastFn !== null;
}
