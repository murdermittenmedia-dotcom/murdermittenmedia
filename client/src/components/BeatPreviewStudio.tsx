import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Volume2 } from "lucide-react";

type TagSource = "none" | "purchase_now" | "purchase_today" | "mitten" | "custom";
type ResolvedTagAudio = { audioBase64: string; mimeType: string } | null | undefined;

type BeatPreviewStudioProps = {
  source: File | string | null;
  previewStartSeconds: number;
  tagSource: TagSource;
  tagAtSeconds: number;
  customTag: File | null;
  resolvedTagAudio: ResolvedTagAudio;
  tagLoadError?: boolean;
  onPreviewReady: (file: File | null) => void;
};

const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

async function readAudioInput(input: File | string) {
  if (input instanceof File) return input.arrayBuffer();
  const response = await fetch(input, { credentials: "include" });
  if (!response.ok) throw new Error("Could not load the original beat audio.");
  return response.arrayBuffer();
}

function base64ToArrayBuffer(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const frameCount = buffer.length;
  const output = new ArrayBuffer(44 + frameCount * channels * 2);
  const view = new DataView(output);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, "RIFF"); view.setUint32(4, 36 + frameCount * channels * 2, true); writeString(8, "WAVE"); writeString(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); writeString(36, "data"); view.setUint32(40, frameCount * channels * 2, true);
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

/** Renders and plays the exact 30-second buyer preview without browser fetching tag files directly. */
export function BeatPreviewStudio({ source, previewStartSeconds, tagSource, tagAtSeconds, customTag, resolvedTagAudio, tagLoadError = false, onPreviewReady }: BeatPreviewStudioProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsRemoteTag = tagSource !== "none" && !customTag;
  const tagIsReady = tagSource === "none" || !!customTag || !!resolvedTagAudio;

  useEffect(() => {
    setAudioUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return null; });
    setError(null);
    onPreviewReady(null);
  }, [source, previewStartSeconds, tagSource, tagAtSeconds, customTag, resolvedTagAudio]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const buildPreview = async () => {
    if (!source || !tagIsReady || tagLoadError) return;
    setIsBuilding(true); setError(null);
    let decodingContext: AudioContext | null = null;
    try {
      if (!window.AudioContext || !window.OfflineAudioContext) throw new Error("Use the latest Chrome, Edge, or Safari to prepare this preview.");
      decodingContext = new window.AudioContext();
      const master = await decodingContext.decodeAudioData(await readAudioInput(source));
      if (master.duration <= previewStartSeconds) throw new Error("Move the preview point before the end of the beat.");
      const channels = Math.min(2, Math.max(1, master.numberOfChannels));
      const sampleRate = 44_100;
      const offline = new OfflineAudioContext(channels, sampleRate * 30, sampleRate);
      const masterSource = offline.createBufferSource();
      masterSource.buffer = master; masterSource.connect(offline.destination); masterSource.start(0, Math.max(0, previewStartSeconds));
      if (tagSource !== "none") {
        const tagBytes = customTag ? await customTag.arrayBuffer() : base64ToArrayBuffer(resolvedTagAudio!.audioBase64);
        const tag = await decodingContext.decodeAudioData(tagBytes);
        const tagSourceNode = offline.createBufferSource();
        const tagGain = offline.createGain();
        tagSourceNode.buffer = tag; tagGain.gain.value = 1.12; tagSourceNode.connect(tagGain).connect(offline.destination); tagSourceNode.start(Math.max(0, Math.min(29, tagAtSeconds)));
      }
      const rendered = await offline.startRendering();
      const file = new File([audioBufferToWav(rendered)], "marketplace-preview.wav", { type: "audio/wav" });
      const nextUrl = URL.createObjectURL(file);
      setAudioUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
      onPreviewReady(file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The preview could not be created.");
      onPreviewReady(null);
    } finally {
      if (decodingContext) await decodingContext.close().catch(() => undefined);
      setIsBuilding(false);
    }
  };

  useEffect(() => { if (source && tagIsReady && !tagLoadError) void buildPreview(); }, [source, previewStartSeconds, tagSource, tagAtSeconds, customTag, resolvedTagAudio, tagLoadError]);

  if (!source) return null;
  return <section className="border border-red-500/35 bg-red-950/10 p-4">
    <div className="flex items-start gap-3"><Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-red-400" /><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-red-400">Client preview</p><p className="mt-1 text-xs leading-relaxed text-white/55">30 seconds from <strong className="text-white">{timeLabel(previewStartSeconds)}</strong>{tagSource !== "none" ? <> · tag at <strong className="text-white">{timeLabel(tagAtSeconds)}</strong></> : " · clean"}.</p></div></div>
    {needsRemoteTag && !tagIsReady && !tagLoadError && <p className="mt-3 flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading selected voice tag…</p>}
    {tagLoadError && <p className="mt-3 border border-red-400/30 bg-red-950/30 p-3 text-xs leading-relaxed text-red-100">The selected tag could not load. Choose a different tag or use a clean preview.</p>}
    {error && <p className="mt-3 border border-red-400/30 bg-red-950/30 p-3 text-xs leading-relaxed text-red-100">{error}</p>}
    {isBuilding && <p className="mt-3 flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Preparing your preview…</p>}
    {audioUrl && <div className="mt-4 border-t border-white/10 pt-4"><audio controls autoPlay src={audioUrl} className="h-10 w-full" /><div className="mt-2 flex items-center justify-between gap-3"><p className="text-[10px] text-green-300">Ready to publish. The buyer hears this exact preview.</p><button type="button" onClick={buildPreview} className="flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/55 hover:text-white"><RotateCcw className="h-3.5 w-3.5" />Refresh</button></div></div>}
  </section>;
}
