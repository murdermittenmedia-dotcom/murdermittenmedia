import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { ExternalLink, Loader2, Upload, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type ReviewPaymentProofProps = {
  method: "Cash App" | "PayPal";
  receiptUrl: string;
  onChange: (url: string) => void;
  amountCents: number;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

// Only our image-proof storage namespace may be embedded as a screenshot.
export function isReviewPaymentProofImage(url: string): boolean {
  return /^\/manus-storage\/review-payment-proofs\/[a-z0-9_/-]+\.(png|jpe?g|webp)$/i.test(url);
}

export function isSafeReviewPaymentReceipt(url: string): boolean {
  if (isReviewPaymentProofImage(url)) return true;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
function isProofMimeType(type: string): type is "image/png" | "image/jpeg" | "image/webp" {
  return type === "image/png" || type === "image/jpeg" || type === "image/webp";
}

export function ReviewPaymentProof({ method, receiptUrl, onChange, amountCents, busy = false, onBusyChange }: ReviewPaymentProofProps) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const operationRef = useRef(0);
  const uploadingRef = useRef(false);
  const busyCallbackRef = useRef(onBusyChange);
  const changeCallbackRef = useRef(onChange);
  const expectedReceiptRef = useRef(receiptUrl);
  busyCallbackRef.current = onBusyChange;
  changeCallbackRef.current = onChange;
  const upload = trpc.reviewSubmission.uploadPaymentProof.useMutation();

  function cancelUpload() {
    operationRef.current += 1;
    readerRef.current?.abort();
    readerRef.current = null;
    if (uploadingRef.current) {
      uploadingRef.current = false;
      busyCallbackRef.current?.(false);
    }
  }

  useEffect(() => {
    setUploading(false);
    setPreviewUrl(null);
    setFailedPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    // Method switches and unmounts must never attach a late upload to another payment.
    return cancelUpload;
  }, [method]);

  useEffect(() => {
    // A parent reset supersedes the selected file, even while its upload is in flight.
    if (uploadingRef.current && receiptUrl !== expectedReceiptRef.current) {
      cancelUpload();
      setUploading(false);
      setPreviewUrl(null);
    }
  }, [receiptUrl]);

  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100);
  const paymentUrl = method === "Cash App" ? "https://cash.app/$MittenMedia" : "https://paypal.me/MurderMittenPromo";
  const recipient = method === "Cash App" ? "$MittenMedia" : "MurderMittenPromo";
  const imageUrl = previewUrl ?? (isReviewPaymentProofImage(receiptUrl) ? receiptUrl : null);
  const disabled = busy || uploading;

  async function selectScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = ""; // Allow retrying the same file after an error.
    if (!file || busy || uploadingRef.current) return;
    setError(null);
    const mimeType = file.type;
    if (!isProofMimeType(mimeType) || !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setError("Choose a PNG, JPEG, or WebP payment screenshot.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PROOF_BYTES) {
      setError("Choose a non-empty screenshot no larger than 5 MB.");
      return;
    }

    cancelUpload();
    const operation = operationRef.current;
    const isCurrent = () => operationRef.current === operation;
    setPreviewUrl(null);
    setFailedPreview(null);
    expectedReceiptRef.current = "";
    changeCallbackRef.current("");
    uploadingRef.current = true;
    setUploading(true);
    busyCallbackRef.current?.(true);

    try {
      // Read bytes only in response to an explicit file selection.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        readerRef.current = reader;
        reader.onload = () => {
          if (typeof reader.result !== "string") reject(new Error("Could not read the screenshot. Please try again."));
          else resolve(reader.result);
        };
        reader.onerror = () => reject(new Error("Could not read the screenshot. Please try again."));
        reader.onabort = () => reject(new Error("Screenshot upload canceled."));
        reader.readAsDataURL(file);
      });
      if (!isCurrent()) return;
      readerRef.current = null;
      setPreviewUrl(dataUrl);
      const imageBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (!imageBase64) throw new Error("The screenshot could not be read. Please choose it again.");
      const result = await upload.mutateAsync({ fileName: file.name, mimeType, imageBase64 });
      if (!isCurrent()) return;
      if (!isSafeReviewPaymentReceipt(result.receiptUrl)) throw new Error("The upload returned an invalid receipt link. Please try again.");
      expectedReceiptRef.current = result.receiptUrl;
      changeCallbackRef.current(result.receiptUrl);
      setPreviewUrl(null);
    } catch (cause) {
      if (isCurrent()) {
        setPreviewUrl(null);
        setError(cause instanceof Error ? cause.message : "Screenshot upload failed. Please try again.");
      }
    } finally {
      if (isCurrent()) {
        readerRef.current = null;
        uploadingRef.current = false;
        setUploading(false);
        busyCallbackRef.current?.(false);
      }
    }
  }

  function clearReceipt() {
    cancelUpload();
    setUploading(false);
    setPreviewUrl(null);
    setFailedPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    expectedReceiptRef.current = "";
    changeCallbackRef.current("");
  }

  return <div className="space-y-3" aria-busy={uploading}>
    <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className={`block rounded-lg border px-3 py-2.5 text-center text-xs font-bold ${method === "Cash App" ? "border-[#00D632]/40 bg-[#00D632]/10 text-[#00D632]" : "border-blue-400/40 bg-blue-400/10 text-blue-200"}`}>
      Pay {amount} to {recipient} via {method} <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden="true" />
    </a>
    <p id={`${id}-help`} className="text-[10px] leading-relaxed text-white/50">Include your artist and song title in the payment note. Upload a payment screenshot or use a receipt link below. Your request stays pending until an admin manually verifies payment.</p>
    <div className="space-y-1.5">
      <label htmlFor={`${id}-file`} className="flex items-center gap-1.5 text-xs font-semibold text-white"><Upload className="h-3.5 w-3.5" aria-hidden="true" />Payment screenshot</label>
      <input ref={inputRef} id={`${id}-file`} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" disabled={disabled} onChange={(event) => void selectScreenshot(event)} aria-describedby={`${id}-help ${id}-format${error ? ` ${id}-error` : ""}`} aria-invalid={!!error} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white disabled:opacity-40" />
      <p id={`${id}-format`} className="text-[10px] text-white/40">PNG, JPEG, or WebP · up to 5 MB. No separate receipt URL needed for a screenshot.</p>
    </div>
    {uploading && <p role="status" className="flex items-center gap-2 text-xs text-amber-200"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Uploading screenshot… Please wait before submitting.</p>}
    {imageUrl && failedPreview !== imageUrl && <img src={imageUrl} alt={`${method} payment screenshot preview`} onError={() => setFailedPreview(imageUrl)} className="max-h-56 max-w-full rounded-lg border border-white/15 object-contain" />}
    {imageUrl && failedPreview === imageUrl && <p role="status" className="text-xs text-amber-200">Screenshot preview is unavailable. You can still open the receipt to check it.</p>}
    {!uploading && isSafeReviewPaymentReceipt(receiptUrl) && <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-300 underline">View attached payment proof <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>}
    {(receiptUrl || uploading || previewUrl) && <button type="button" disabled={busy && !uploading} onClick={clearReceipt} className="flex items-center gap-1 text-xs text-white/60 underline disabled:opacity-40"><X className="h-3 w-3" aria-hidden="true" />{uploading ? "Cancel upload" : "Clear payment proof"}</button>}
    <details className="rounded-lg border border-white/10 px-3 py-2">
      <summary className="cursor-pointer text-xs text-white/60">Use a receipt link instead (optional)</summary>
      <label htmlFor={`${id}-link`} className="mt-2 block text-[10px] text-white/50">{method} receipt link</label>
      <input id={`${id}-link`} type="url" value={isReviewPaymentProofImage(receiptUrl) ? "" : receiptUrl} disabled={disabled} onChange={(event) => { setPreviewUrl(null); setFailedPreview(null); setError(null); onChange(event.target.value); }} placeholder="https://…" aria-describedby={`${id}-help`} className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/25 disabled:opacity-40" />
    </details>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
