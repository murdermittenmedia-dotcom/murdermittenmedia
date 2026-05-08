/* ============================================================
   ArtistLink — Renders an artist name as a clickable link to
   their profile page (/profile/:userId) when userId is available.
   Falls back to plain text when no userId is provided.
   ============================================================ */

import { Link } from "wouter";

interface ArtistLinkProps {
  artistName: string;
  userId?: number | null;
  className?: string;
}

export function ArtistLink({ artistName, userId, className = "" }: ArtistLinkProps) {
  if (userId) {
    return (
      <Link href={`/profile/${userId}`}>
        <span className={`cursor-pointer hover:text-red-400 transition-colors underline decoration-dotted underline-offset-2 ${className}`}>
          {artistName}
        </span>
      </Link>
    );
  }
  return <span className={className}>{artistName}</span>;
}
