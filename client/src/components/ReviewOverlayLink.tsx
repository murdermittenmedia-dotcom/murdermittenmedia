import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { REVIEW_SOURCE_PATHS } from "@shared/review-studio";

const VISUAL_SOURCES = [
  {
    key: "now",
    name: "Now Playing + FIRE / TRASH",
    width: 480,
    height: 250,
    description: "Current artist, song and smaller live vote counts.",
  },
  {
    key: "queue",
    name: "Up Next Queue",
    width: 480,
    height: 300,
    description: "Next three eligible songs and total waiting.",
  },
  {
    key: "previous",
    name: "Previously Played",
    width: 480,
    height: 150,
    description: "One most recently completed artist and song.",
  },
  {
    key: "header",
    name: "Interactive Show Header",
    width: 720,
    height: 190,
    description:
      "Permanent show title, host, submission link and real live activity.",
  },
  {
    key: "submissions",
    name: "Submission Alerts (optional)",
    width: 600,
    height: 140,
    description: "Real accepted submissions, queued for five seconds each.",
  },
] as const;

async function copySource(path: string, name: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success(`${name} link copied`);
  } catch {
    toast.error(
      "Could not copy automatically. Open the source and copy its address."
    );
  }
}

/** Enabled explicitly, fixed source viewport, scaled to this dashboard column. */
function VisualPreview({
  path,
  name,
  width,
  height,
}: {
  path: string;
  name: string;
  width: number;
  height: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const resize = () => setScale(node.clientWidth / width);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div
      ref={container}
      className="relative mt-2 w-full overflow-hidden rounded-md border border-white/10 bg-black/20"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <iframe
        src={path}
        title={`${name} live preview`}
        width={width}
        height={height}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        className="absolute left-0 top-0 border-0"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/** Kept separate so the manager's collapsed state starts no additional polling. */
function OverlayManagerContents() {
  const utils = trpc.useUtils();
  const settings = trpc.reviewStudio.settings.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnReconnect: true,
  });
  const [previews, setPreviews] = useState<Record<string, boolean>>({});
  const setSettings = trpc.reviewStudio.setSettings.useMutation({
    onMutate: async ({ submissionAlertsEnabled }) => {
      await utils.reviewStudio.settings.cancel();
      const previous = utils.reviewStudio.settings.getData();
      if (previous)
        utils.reviewStudio.settings.setData(undefined, {
          ...previous,
          submissionAlertsEnabled:
            submissionAlertsEnabled ?? previous.submissionAlertsEnabled,
        });
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous)
        utils.reviewStudio.settings.setData(undefined, context.previous);
      toast.error(error.message || "Could not update submission alerts.");
    },
    onSettled: () => {
      void utils.reviewStudio.settings.invalidate();
    },
  });
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] leading-relaxed text-white/50">
        Add each URL as its own transparent browser source at the size shown.
        Position and scale independently. All five visual sources are silent;
        keep your existing music and dedicated soundboard audio output separate.
      </p>
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/15 p-2.5 text-[10px] text-white/70">
        <input
          type="checkbox"
          checked={settings.data?.submissionAlertsEnabled ?? true}
          disabled={!settings.data || settings.isError || setSettings.isPending}
          onChange={event =>
            setSettings.mutate({
              submissionAlertsEnabled: event.target.checked,
            })
          }
          className="accent-red-500"
        />
        <span>
          <strong className="text-white/80">
            Standalone submission alerts
          </strong>
          <span className="block text-white/40">
            Disable to keep submissions only in the header activity strip.
          </span>
        </span>
      </label>
      {settings.isError && (
        <p role="alert" className="text-[10px] text-red-300">
          Unable to load alert settings. Reopen the manager to retry.
        </p>
      )}
      {VISUAL_SOURCES.map(source => {
        const path = REVIEW_SOURCE_PATHS[source.key];
        const preview = !!previews[source.key];
        return (
          <div
            key={source.key}
            className="rounded-lg border border-white/10 bg-black/15 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-white/85">
                  {source.name}
                </p>
                <p className="mt-0.5 text-[10px] text-white/45">
                  {source.width} × {source.height} px
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copySource(path, source.name)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-400/30 px-2 py-1.5 text-[9px] font-bold text-red-200"
              >
                <Copy className="h-3 w-3" /> Copy URL
              </button>
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              {source.description}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-white/55 hover:text-white"
              >
                Open source <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                aria-expanded={preview}
                onClick={() =>
                  setPreviews(current => ({
                    ...current,
                    [source.key]: !current[source.key],
                  }))
                }
                className="inline-flex items-center gap-1 text-[10px] text-white/55 hover:text-white"
              >
                {preview ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                {preview ? "Hide preview" : "Show live preview"}
              </button>
            </div>
            {preview && (
              <VisualPreview
                path={path}
                name={source.name}
                width={source.width}
                height={source.height}
              />
            )}
          </div>
        );
      })}
      <details className="rounded-lg border border-white/10 p-2.5">
        <summary className="cursor-pointer text-[10px] font-bold text-white/50">
          Legacy combined overlays
        </summary>
        <div className="mt-2 space-y-2">
          {(["vertical", "horizontal"] as const).map(layout => {
            const path = `/broadcast/overlay?layout=${layout}`;
            return (
              <div
                key={layout}
                className="flex items-center justify-between gap-2 text-[10px] text-white/50"
              >
                <a
                  href={path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="capitalize hover:text-white"
                >
                  {layout} ·{" "}
                  {layout === "vertical" ? "480 × 900" : "1920 × 1080"}
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void copySource(path, `Legacy ${layout} overlay`)
                  }
                  className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1"
                >
                  <Copy className="h-3 w-3" /> Copy URL
                </button>
              </div>
            );
          })}
        </div>
      </details>
      <p className="text-[10px] text-white/35">
        Previews start only when enabled and stop when hidden or the manager is
        closed. Activity reflects accepted website events and any verified
        connected origin—not a claim that TikTok is connected.
      </p>
    </div>
  );
}

export function OverlayManager() {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-xl border border-red-500/20 bg-red-500/[0.035] p-3"
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.15em] text-red-300">
        Overlay Manager{" "}
        <span className="ml-1 font-normal normal-case tracking-normal text-white/45">
          · 5 visual sources
        </span>
      </summary>
      {open && <OverlayManagerContents />}
    </details>
  );
}

/** Existing admin imports remain unchanged. */
export function ReviewOverlayLink() {
  return <OverlayManager />;
}
