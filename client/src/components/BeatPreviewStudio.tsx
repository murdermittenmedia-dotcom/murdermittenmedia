import { useEffect, useState } from "react";
import { Loader2, Play, Volume2 } from "lucide-react";

type TagSource = "none" | "purchase_now" | "purchase_today" | "mitten" | "custom";

type BeatPreviewStudioProps = {
  source: File | string | null;
  previewStartSeconds: number;
  tagSource: TagSource;
  tagAtSeconds: number;
  customTag: File | null;
  existingCustomTagUrl?: string | null;
  onPreviewReady: (file: File | null) => void;
};

const DEFAULT_TAG_URLS: Record<Exclude<TagSource, "none" | "custom">, string> = {
  purchase_now: "/manus-storage/PURCHASEYOURTRACKNOW_637b3856.mp3",
  purchase_today: "/manus-storage/PurchaseYourTrackToday_89b31df5.mp3",
  mitten: "/manus-storage/MURDERMITTENTAGRMCMIKE_9c7685ca.wav",
};

const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

async function readAudioInput(input: File | string) {
  if (input instanceof File) return input.arrayBuffer();
  const response = await fetch(input, { credentials: "include" });
  if (!response.ok) throw new Error("Could not load the original beat audio.");
  return response.arrayBuffer();
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const frameCount = buffer.length;
  const output = new ArrayBuffer(44 + frameCount * channels * 2);
  const view = new DataView(output);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + frameCount * channels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, frameCount * channels * 2, true);
  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(Math.min(index, buffer.numberOfChannels - 1)));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([output], { type: "audio/wav" });
}

/** Creates the exact tagged 30-second client preview in the browser before upload. */
export function BeatPreviewStudio({ source, previewStartSeconds, tagSource, tagAtSeconds, customTag, existingCustomTagUrl, onPreviewReady }: BeatPreviewStudioProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAudioUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setError(null);
    onPreviewReady(null);
  }, [source, previewStartSeconds, tagSource, tagAtSeconds, customTag, existingCustomTagUrl]);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const buildPreview = async () => {
    if (!source) return;
    setIsBuilding(true);
    setError(null);
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor || !window.OfflineAudioContext) throw new Error("This browser does not support audio preview rendering. Try the latest Chrome, Edge, or Safari.");
      const decodingContext = new AudioContextConstructor();
      const master = await decodingContext.decodeAudioData(await readAudioInput(source));
      if (master.duration <= previewStartSeconds) throw new Error("Choose a preview point before the end of the beat.");
      const channels = Math.min(2, Math.max(1, master.numberOfChannels));
      const sampleRate = 44_100;
      const offline = new OfflineAudioContext(channels, sampleRate * 30, sampleRate);
      const masterSource = offline.createBufferSource();
      masterSource.buffer = master;
      masterSource.connect(offline.destination);
      masterSource.start(0, Math.max(0, previewStartSeconds));

      if (tagSource !== "none") {
        const tagInput = tagSource === "custom"
          ? (customTag || existingCustomTagUrl || null)
          : DEFAULT_TAG_URLS[tagSource];
        if (!tagInput) throw new Error("Upload a custom tag before creating the preview.");
        const tag = await decodingContext.decodeAudioData(await readAudioInput(tagInput));
        const tagSourceNode = offline.createBufferSource();
        tagSourceNode.buffer = tag;
        const tagGain = offline.createGain();
        tagGain.gain.value = 1.12;
        tagSourceNode.connect(tagGain).connect(offline.destination);
        tagSourceNode.start(Math.max(0, Math.min(29, tagAtSeconds)));
      }

      const rendered = await offline.startRendering();
      const file = new File([audioBufferToWav(rendered)], "marketplace-preview.wav", { type: "audio/wav" });
      const nextUrl = URL.createObjectURL(file);
      setAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      onPreviewReady(file);
      await decodingContext.close();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The preview could not be created.";
      setError(message);
      onPreviewReady(null);
    } finally {
      setIsBuilding(false);
    }
  };

  useEffect(() => {
    void buildPreview();
  }, [source, previewStartSeconds, tagSource, tagAtSeconds, customTag, existingCustomTagUrl]);

  if (!source) return null;
  return <section className="border border-red-500/35 bg-red-950/10 p-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3"><Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-red-400" /><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-red-400">Preview studio</p><p className="mt-1 text-xs leading-relaxed text-white/55">Hear the exact 30-second buyer preview before you save. Starts at <strong className="text-white">{timeLabel(previewStartSeconds)}</strong>{tagSource !== "none" ? <> · tag at <strong className="text-white">{timeLabel(tagAtSeconds)}</strong></> : " · clean preview"}.</p></div></div>
      <button type="button" onClick={buildPreview} disabled={isBuilding} className="flex shrink-0 items-center justify-center gap-2 border border-red-400 bg-red-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500 disabled:opacity-50">{isBuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{isBuilding ? "Building…" : audioUrl ? "Rebuild preview" : "Build & listen"}</button>
    </div>
    {error && <p className="mt-3 border border-red-400/30 bg-red-950/30 p-3 text-xs leading-relaxed text-red-100">{error}</p>}
    {audioUrl && <div className="mt-4 border-t border-white/10 pt-4"><audio controls src={audioUrl} className="h-10 w-full" /><p className="mt-2 text-[10px] text-green-300">This is the exact preview file that will be published. Your protected buyer master stays clean.</p></div>}
  </section>;
}
