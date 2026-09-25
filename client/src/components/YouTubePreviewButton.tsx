import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function YouTubePreviewButton({ videoId, title, className = "" }: { videoId: string; title: string; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const send = (func: "playVideo" | "pauseVideo" | "seekTo") => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: func === "seekTo" ? [0, true] : [] }), "https://www.youtube-nocookie.com");
  };

  useEffect(() => {
    if (!loaded) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === "onStateChange" && data.info === 0) setIsPlaying(false);
      } catch { /* Ignore non-player messages. */ }
    };
    const onOtherPreview = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== videoId && isPlaying) {
        send("pauseVideo");
        setIsPlaying(false);
      }
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("murder-mitten-youtube-preview", onOtherPreview);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("murder-mitten-youtube-preview", onOtherPreview);
    };
  }, [loaded, isPlaying, videoId]);

  const toggle = () => {
    if (!loaded) return;
    if (isPlaying) {
      send("pauseVideo");
      setIsPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent("murder-mitten-youtube-preview", { detail: videoId }));
      send("playVideo");
      setIsPlaying(true);
    }
  };

  return (
    <div className={`relative h-9 w-9 overflow-hidden rounded-full ${className}`} title="Play 30-second preview">
      <iframe
        ref={frame}
        title={`${title} 30-second preview`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&start=0&end=30`}
        onLoad={() => setLoaded(true)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button type="button" onClick={toggle} disabled={!loaded} aria-label={isPlaying ? `Pause preview of ${title}` : `Play preview of ${title}`} className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_18px_rgba(209,0,0,.35)] transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60">
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
    </div>
  );
}
