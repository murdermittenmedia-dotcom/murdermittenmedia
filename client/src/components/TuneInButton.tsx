/**
 * TuneInButton — Replaces AudioPlayButton site-wide (except Previously Submitted Tracks).
 *
 * Instead of playing songs independently, this button redirects users to the Live Now page
 * (/live) where they can tune into whichever radio stream is currently broadcasting.
 *
 * This enforces the radio-station model: the only independent playback on the site is
 * in the Previously Submitted Tracks section of the Music Review page.
 */

import { useLocation } from "wouter";
import { Radio } from "lucide-react";

interface TuneInButtonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TuneInButton({ size = "sm", className = "" }: TuneInButtonProps) {
  const [, navigate] = useLocation();

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1",
    md: "px-4 py-2 text-sm gap-1.5",
    lg: "px-6 py-3 text-base gap-2",
  };

  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={() => navigate("/live")}
      className={`inline-flex items-center font-semibold uppercase tracking-widest border border-red-600/50 text-red-400 hover:bg-red-600/20 hover:border-red-500 transition-all duration-200 ${sizeClasses[size]} ${className}`}
      title="Tune in to the live radio station"
    >
      <Radio className={`${iconSize[size]} animate-pulse`} />
      Tune In
    </button>
  );
}
