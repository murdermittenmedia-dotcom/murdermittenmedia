/* ============================================================
   MURDER MITTEN MEDIA -- Music Review Submission Queue
   ============================================================ */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/_core/hooks/useAuth";
import { OnboardingModal } from "@/components/OnboardingModal";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const CASHAPP = "$joyfuljules";
const PAYPAL = "MurderMittenPromo";
const APPLEPAY = "313-420-9004";
const SKIP_PRICE = 10;

type SubmitType = "youtube" | "file";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "In Queue", className: "bg-yellow-600/20 text-yellow-400 border-yellow-600/40" },
    playing: { label: "🎵 Now Playing", className: "bg-red-600/30 text-red-400 border-red-600/60 animate-pulse" },
    reviewed: { label: "Reviewed", className: "bg-green-600/20 text-green-400 border-green-600/40" },
    removed: { label: "Removed", className: "bg-white/10 text-white/30 border-white/20" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`text-xs border px-2 py-0.5 uppercase tracking-wider font-semibold rounded-sm ${s.className}`}>
      {s.label}
    </span>
  );
}

export default function MusicReview() {
  const [step, setStep] = useState<"queue" | "submit" | "skip-info">("queue");
  const [submitType, setSubmitType] = useState<SubmitType>("youtube");
  const [form, setForm] = useState({
    artistName: "",
    songTitle: "",
    youtubeUrl: "",
    contactInfo: "",
    wantsSkip: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  const { data, refetch, isLoading } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 15000, // poll every 15s for live updates
  });

  const submitMutation = trpc.queue.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmitting(false);
      refetch();
    },
    onError: (err) => {
      toast.error("Submission failed: " + err.message);
      setSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.artistName || !form.songTitle) {
      toast.error("Please fill in artist name and song title");
      return;
    }
    if (submitType === "youtube" && !form.youtubeUrl) {
      toast.error("Please enter a YouTube link");
      return;
    }
    setSubmitting(true);
    submitMutation.mutate({
      artistName: form.artistName,
      songTitle: form.songTitle,
      submissionType: submitType,
      youtubeUrl: submitType === "youtube" ? form.youtubeUrl : undefined,
      contactInfo: form.contactInfo || undefined,
      wantsSkip: form.wantsSkip,
    });
  };

  const pendingQueue = data?.submissions?.filter(s => s.status === "pending" || s.status === "playing") ?? [];
  const currentPlaying = data?.currentPlaying;
  const isLive = data?.state?.isLive ?? false;
  const liveMessage = data?.state?.liveMessage;

  // Live stream + radio mode
  const [streamMode, setStreamMode] = useState<"video" | "radio">("video");
  const [chatInput, setChatInput] = useState("");
  const { user } = useAuth();
  const chatUsername = user?.artistName || user?.name || "Guest";
  const { data: chatHistory } = trpc.chat.getHistory.useQuery({ room: "music_review" });
  const { messages: chatMessages, isConnected: chatConnected, sendMessage } = useChat({
    room: "music_review",
    username: chatUsername,
    userId: user?.id,
    isAdmin: user?.role === "admin",
    initialMessages: (chatHistory || []).map(m => ({
      id: m.id, username: m.username, message: m.message,
      room: m.room, isAdmin: m.isAdmin, createdAt: new Date(m.createdAt),
    })),
  });
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const handleSendChat = () => {
    if (!chatInput.trim() || !user) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* -- NAV ----------------------------------------------- */}
      <SiteNav />
      <OnboardingModal />

      {/* -- HERO ---------------------------------------------- */}
      <section className="pt-32 pb-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent" />
        <div className="container relative z-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-white/20"}`} />
            <span className={`text-xs uppercase tracking-[0.3em] font-semibold ${isLive ? "text-green-400" : "text-white/30"}`}>
              {isLive ? "🎙 Review Session Live" : "Review Session Offline"}
            </span>
          </div>
          <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase mb-4 leading-tight">
            MUSIC <span className="text-red-600">REVIEW</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Submit your track for a live review by Murder Mitten Media. Get in line, or skip to the front for $10.
          </p>
        </div>
      </section>

      {/* -- LIVE STREAM + CHAT --------------------------------- */}
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stream / Radio */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
                <span className={`text-xs uppercase tracking-widest font-semibold ${isLive ? "text-red-400" : "text-white/30"}`}>
                  {isLive ? "Live Now" : "Stream Offline"}
                </span>
              </div>
              <div className="flex gap-1">
                {(["video", "radio"] as const).map(mode => (
                  <button key={mode} onClick={() => setStreamMode(mode)}
                    className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
                      streamMode === mode ? "bg-red-600 border-red-600 text-white" : "border-white/20 text-white/40 hover:text-white"
                    }`}>
                    {mode === "video" ? "📺 Video" : "📻 Radio"}
                  </button>
                ))}
              </div>
            </div>

            {streamMode === "video" ? (
              <div className="relative w-full bg-black border border-white/10" style={{ paddingTop: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/live_stream?channel=UCmurdermitten&autoplay=1"
                  title="Murder Mitten Media Music Review Live"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="bg-[#0d0d0d] border border-white/10 flex flex-col items-center justify-center" style={{ minHeight: "240px" }}>
                <div className="text-center">
                  <div className="font-['Anton'] text-4xl text-red-600 mb-2">📻</div>
                  <div className="font-['Anton'] text-xl uppercase mb-1">Murder Mitten Radio</div>
                  <p className="text-white/40 text-xs mb-4">Audio-only stream — music review session</p>
                  <div className={`flex items-center gap-2 justify-center mb-4 ${isLive ? "text-green-400" : "text-white/30"}`}>
                    <span className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-white/20"}`} />
                    <span className="text-xs uppercase tracking-widest">{isLive ? "On Air" : "Off Air"}</span>
                  </div>
                  {isLive ? (
                    <audio
                      controls autoPlay
                      src="https://www.youtube.com/embed/live_stream?channel=UCmurdermitten"
                      className="w-full max-w-xs"
                    />
                  ) : (
                    <p className="text-white/30 text-xs">Tune in when the session goes live</p>
                  )}
                </div>
              </div>
            )}
            <p className="text-white/20 text-xs mt-1 text-right">
              <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">Open on YouTube ↗</a>
            </p>
          </div>

          {/* Live Chat */}
          <div className="flex flex-col bg-[#0d0d0d] border border-white/10" style={{ height: "340px" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
              <span className="font-['Anton'] text-xs uppercase tracking-widest">Live Chat</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${chatConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-xs text-white/30">{chatConnected ? "Live" : "Connecting"}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              {chatMessages.length === 0 && (
                <p className="text-white/20 text-xs text-center py-6">No messages yet</p>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className="text-xs flex gap-1.5 flex-wrap">
                  <span className={`font-semibold flex-shrink-0 ${msg.isAdmin ? "text-red-400" : "text-white/60"}`}>
                    {msg.isAdmin && "[ADMIN] "}{msg.username}:
                  </span>
                  <span className="text-white/70 break-words min-w-0">{msg.message}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div className="p-2 border-t border-white/10 flex gap-1.5 flex-shrink-0">
              <input
                type="text" value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendChat()}
                placeholder={user ? "Chat..." : "Login to chat"}
                disabled={!user} maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-red-600/50 placeholder-white/20 disabled:opacity-40"
              />
              <button onClick={handleSendChat} disabled={!user || !chatInput.trim()}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-semibold uppercase transition-colors">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container pb-20 max-w-4xl mx-auto">

        {/* -- CURRENTLY PLAYING --------------------------------- */}
        {currentPlaying && (
          <div className="mb-8 border border-red-600/50 bg-red-600/10 p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-transparent" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Now Playing</span>
            </div>
            <div className="font-['Anton'] text-3xl uppercase">{currentPlaying.songTitle}</div>
            <div className="text-white/60 text-sm mt-1">by {currentPlaying.artistName}</div>
            {liveMessage && <div className="text-white/40 text-xs mt-2 italic">{liveMessage}</div>}
          </div>
        )}

        {/* -- TABS ---------------------------------------------- */}
        <div className="flex gap-0 mb-8 border border-white/10">
          <button
            onClick={() => setStep("queue")}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold transition-all ${step === "queue" ? "bg-red-600 text-white" : "text-white/40 hover:text-white"}`}
          >
            View Queue ({pendingQueue.length})
          </button>
          <button
            onClick={() => setStep("submit")}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold transition-all ${step === "submit" ? "bg-red-600 text-white" : "text-white/40 hover:text-white"}`}
          >
            Submit Track
          </button>
          <button
            onClick={() => setStep("skip-info")}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold transition-all ${step === "skip-info" ? "bg-red-600 text-white" : "text-yellow-500/70 hover:text-yellow-400"}`}
          >
            ⚡ Skip Line ($10)
          </button>
        </div>

        {/* -- QUEUE VIEW ---------------------------------------- */}
        {step === "queue" && (
          <div>
            {isLoading ? (
              <div className="text-center py-16 text-white/30">Loading queue...</div>
            ) : pendingQueue.length === 0 ? (
              <div className="text-center py-16 border border-white/10 bg-white/[0.02]">
                <div className="font-['Anton'] text-2xl uppercase mb-2">Queue is Empty</div>
                <p className="text-white/40 text-sm mb-6">Be the first to submit your track!</p>
                <button
                  onClick={() => setStep("submit")}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-xs font-semibold uppercase tracking-widest transition-all"
                >
                  Submit Your Track →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingQueue.map((sub, i) => (
                  <div
                    key={sub.id}
                    className={`flex items-center gap-4 p-4 border transition-all ${
                      sub.status === "playing"
                        ? "border-red-600/60 bg-red-600/10"
                        : sub.skipPaymentConfirmed
                        ? "border-yellow-500/40 bg-yellow-500/5"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    {/* Position number */}
                    <div className={`w-10 h-10 flex items-center justify-center font-['Anton'] text-xl flex-shrink-0 ${
                      sub.status === "playing" ? "text-red-500" : "text-white/30"
                    }`}>
                      {sub.status === "playing" ? "▶" : i + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{sub.songTitle}</div>
                      <div className="text-white/50 text-xs truncate">by {sub.artistName}</div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sub.skipPaymentConfirmed && (
                        <span className="text-xs border border-yellow-500/40 text-yellow-400 px-2 py-0.5 uppercase tracking-wider">
                          ⚡ VIP
                        </span>
                      )}
                      <StatusBadge status={sub.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -- SUBMIT FORM --------------------------------------- */}
        {step === "submit" && (
          <div>
            {submitted ? (
              <div className="text-center py-16 border border-green-600/40 bg-green-600/5">
                <div className="text-4xl mb-4">✅</div>
                <div className="font-['Anton'] text-3xl uppercase mb-2">You're in the Queue!</div>
                <p className="text-white/50 text-sm mb-6">
                  {form.wantsSkip
                    ? "You requested to skip the line. Send $10 to confirm your spot at the front."
                    : "Your track has been added to the review queue. Check back to see your position."}
                </p>
                {form.wantsSkip && (
                  <div className="mb-6 border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300 max-w-sm mx-auto">
                    <div className="font-bold mb-2">Send $10 to confirm your skip:</div>
                    <div>CashApp: <strong>{CASHAPP}</strong></div>
                    <div>PayPal: <strong>{PAYPAL}</strong></div>
                    <div>Apple Pay: <strong>{APPLEPAY}</strong></div>
                    <div className="mt-2 text-yellow-400/60 text-xs">Include your artist name in the note!</div>
                  </div>
                )}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setSubmitted(false); setStep("queue"); setForm({ artistName: "", songTitle: "", youtubeUrl: "", contactInfo: "", wantsSkip: false }); }}
                    className="border border-white/20 text-white/60 hover:border-white hover:text-white px-6 py-2 text-xs uppercase tracking-widest transition-all"
                  >
                    View Queue
                  </button>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ artistName: "", songTitle: "", youtubeUrl: "", contactInfo: "", wantsSkip: false }); }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 text-xs uppercase tracking-widest transition-all"
                  >
                    Submit Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Artist / Song */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Artist Name *</label>
                    <input
                      type="text"
                      value={form.artistName}
                      onChange={e => setForm(f => ({ ...f, artistName: e.target.value }))}
                      placeholder="Your artist name"
                      className="w-full bg-white/[0.05] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Song Title *</label>
                    <input
                      type="text"
                      value={form.songTitle}
                      onChange={e => setForm(f => ({ ...f, songTitle: e.target.value }))}
                      placeholder="Song title"
                      className="w-full bg-white/[0.05] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Submission type */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">How to Submit *</label>
                  <div className="flex gap-0">
                    <button
                      type="button"
                      onClick={() => setSubmitType("youtube")}
                      className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold border transition-all ${submitType === "youtube" ? "bg-red-600 border-red-600 text-white" : "border-white/15 text-white/40 hover:text-white"}`}
                    >
                      YouTube Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmitType("file")}
                      className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold border-t border-b border-r transition-all ${submitType === "file" ? "bg-red-600 border-red-600 text-white" : "border-white/15 text-white/40 hover:text-white"}`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                {/* YouTube URL */}
                {submitType === "youtube" && (
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">YouTube Link *</label>
                    <input
                      type="url"
                      value={form.youtubeUrl}
                      onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-white/[0.05] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
                      required
                    />
                    <p className="text-white/30 text-xs mt-1">YouTube links only. Make sure the video is public or unlisted.</p>
                  </div>
                )}

                {/* File upload notice */}
                {submitType === "file" && (
                  <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300">
                    <div className="font-semibold mb-1">File Upload Instructions</div>
                    <p className="text-yellow-300/70 text-xs leading-relaxed">
                      To submit a file, DM us directly on Instagram{" "}
                      <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="underline">@murdermittenmedia</a>{" "}
                      with your track. Include your artist name, song title, and "Music Review Submission" in the message.
                      Then come back here and fill in the form below so we can add you to the queue.
                    </p>
                  </div>
                )}

                {/* Contact info */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Instagram / Contact (optional)</label>
                  <input
                    type="text"
                    value={form.contactInfo}
                    onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))}
                    placeholder="@yourinstagram or phone number"
                    className="w-full bg-white/[0.05] border border-white/15 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
                  />
                </div>

                {/* Skip the line option */}
                <div
                  className={`border p-4 cursor-pointer transition-all ${form.wantsSkip ? "border-yellow-500/60 bg-yellow-500/10" : "border-white/10 bg-white/[0.02] hover:border-yellow-500/30"}`}
                  onClick={() => setForm(f => ({ ...f, wantsSkip: !f.wantsSkip }))}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${form.wantsSkip ? "border-yellow-500 bg-yellow-500" : "border-white/30"}`}>
                      {form.wantsSkip && <span className="text-black text-xs font-bold">✓</span>}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-yellow-400">⚡ Skip the Line -- $10</div>
                      <div className="text-white/40 text-xs mt-0.5">
                        Move to the front of the queue. Send $10 to {CASHAPP} / PayPal: {PAYPAL} / Apple Pay: {APPLEPAY} after submitting.
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
                >
                  {submitting ? "Submitting..." : "Submit to Queue →"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* -- SKIP INFO ----------------------------------------- */}
        {step === "skip-info" && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-8">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">⚡</div>
              <h2 className="font-['Anton'] text-4xl uppercase mb-2">Skip the <span className="text-yellow-400">Line</span></h2>
              <p className="text-white/50">Move your submission to the front of the review queue for just $10.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { label: "CashApp", value: CASHAPP, icon: "💸" },
                { label: "PayPal", value: PAYPAL, icon: "🅿" },
                { label: "Apple Pay", value: APPLEPAY, icon: "🍎" },
              ].map(p => (
                <div key={p.label} className="border border-yellow-500/20 bg-black/30 p-4 text-center">
                  <div className="text-2xl mb-2">{p.icon}</div>
                  <div className="text-yellow-400 text-xs uppercase tracking-widest mb-1">{p.label}</div>
                  <div className="font-['Anton'] text-lg text-white">{p.value}</div>
                </div>
              ))}
            </div>

            <div className="border border-white/10 bg-white/[0.02] p-4 text-sm text-white/50 mb-6">
              <div className="font-semibold text-white/70 mb-2">How it works:</div>
              <ol className="space-y-1 list-decimal list-inside text-xs leading-relaxed">
                <li>Submit your track using the Submit Track tab and check the "Skip the Line" option</li>
                <li>Send $10 to any payment method above -- include your artist name in the note</li>
                <li>We confirm your payment and move you to the front of the queue</li>
                <li>Your track gets reviewed next during the live session</li>
              </ol>
            </div>

            <button
              onClick={() => { setStep("submit"); setForm(f => ({ ...f, wantsSkip: true })); }}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 text-sm font-bold uppercase tracking-widest transition-all"
            >
              Submit & Skip the Line →
            </button>
          </div>
        )}
      </div>

      {/* -- FOOTER -------------------------------------------- */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs">© 2022-{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI</div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YouTube</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
