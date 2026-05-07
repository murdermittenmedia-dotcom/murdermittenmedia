/* ============================================================
   MURDER MITTEN MEDIA -- Murder Mitten Mic Page
   One Mic Performances from YouTube
   ============================================================ */

import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

const MIC_VIDEOS = [
  { id: "JKm_S2YQTk0", artist: "Bo Luke", title: "Murder Mitten Mic : Bo Luke", type: "One Mic Performance" },
  { id: "_t9P2N1d9DY", artist: "LOE Denny", title: "Murder Mitten Mic : LOE Denny", type: "Mic Drop Performance" },
  { id: "O-5f64kvTH8", artist: "Paid G", title: "Murder Mitten Mic : Paid G", type: "Mic Drop Performance" },
  { id: "9FdU7dcy5m8", artist: "Malskii", title: "Murder Mitten Mic : Malskii", type: "Mic Drop Performance" },
  { id: "vV9hx0q8JYM", artist: "Rie", title: "Murder Mitten Mic : Rie", type: "One Mic Performance" },
  { id: "UEGFTfATHos", artist: "Guap", title: "Murder Mitten Mic : Guap", type: "One Mic Performance" },
  { id: "dsBodVX9iKQ", artist: "NSC SIX", title: "Murder Mitten Mic : NSC SIX", type: "One Mic Performance" },
  { id: "7wUJ3JQ2KEs", artist: "SelfMade Su", title: "Murder Mitten Mic : SelfMade Su", type: "One Mic Performance" },
  { id: "4bH9Vtc3Voc", artist: "BodyBagShawn", title: "Murder Mitten Mic : BodyBagShawn", type: "One Mic Performance" },
  { id: "VlYVd_FmsfE", artist: "Volly", title: "Murder Mitten Mic : Volly", type: "One Mic Performance" },
  { id: "3tWZo5oeO6U", artist: "Rylo Ace", title: "Murder Mitten Mic : Rylo Ace", type: "One Mic Performance" },
  { id: "ElJRpXPONnI", artist: "5Fundss", title: "Murder Mitten Mic : 5Fundss", type: "One Mic Performance" },
  { id: "TE-ebQypVso", artist: "BNF Meir", title: "Murder Mitten Mic : BNF Meir", type: "One Mic Performance" },
  { id: "rkqTBAXNzR0", artist: "NorthBoy Trizzy", title: "Murder Mitten Mic : NorthBoy Trizzy", type: "One Mic Performance" },
  { id: "-1angFy8ASc", artist: "BSB Drako", title: "Murder Mitten Mic : BSB Drako", type: "One Mic Performance" },
  { id: "nySFww3jWT8", artist: "Luh Monti", title: "Murder Mitten Mic : Luh Monti", type: "One Mic Performance" },
  { id: "v2IVcZi8AaY", artist: "Loud Pack John", title: "Murder Mitten Mic : Loud Pack John", type: "One Mic Performance" },
  { id: "Ako71f4WgDE", artist: "Nolan's Vision", title: "Murder Mitten Mic : Nolan's Vision", type: "One Mic Performance" },
  { id: "26lpzDYxrBQ", artist: "YLG JAY", title: "Murder Mitten Mic : YLG JAY", type: "One Mic Performance" },
  { id: "BP11s1erf8o", artist: "B2GR8", title: "Murder Mitten Mix : B2GR8", type: "One Mic Performance" },
  { id: "X-Ia7r23BQs", artist: "Six Allels & Papa Doc", title: "Murder Mitten Mic : Six Allels & Papa Doc", type: "One Mic Performance" },
];

function VideoCard({ video, onClick }: { video: typeof MIC_VIDEOS[0]; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer border border-white/10 bg-white/[0.03] hover:border-red-600/60 hover:bg-white/[0.06] transition-all duration-300"
    >
      <div className="relative overflow-hidden">
        <img
          src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
          alt={video.title}
          className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_20px_rgba(209,0,0,0.5)]">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <div className="absolute top-2 left-2">
          <span className="bg-red-600 text-white text-xs px-2 py-0.5 uppercase tracking-wider font-semibold">
            {video.type === "Mic Drop Performance" ? "Mic Drop" : "One Mic"}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="font-['Anton'] text-lg text-white group-hover:text-red-400 transition-colors uppercase tracking-wide">
          {video.artist}
        </div>
        <div className="text-white/40 text-xs mt-1 uppercase tracking-widest">{video.type}</div>
      </div>
    </div>
  );
}

export default function MurderMittenMic() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* -- NAV ----------------------------------------------- */}
      <SiteNav />

      {/* -- HERO ---------------------------------------------- */}
      <section className="pt-32 pb-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent" />
        <div className="container relative z-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">Live Performances · Detroit, MI</span>
          </div>
          <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase mb-4">
            MURDER MITTEN <span className="text-red-600">MIC</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Michigan artists. One mic. No excuses. Watch raw, unfiltered performances from the trenches.
          </p>
          <div className="mt-4 text-white/30 text-sm">{MIC_VIDEOS.length} performances</div>
        </div>
      </section>

      {/* -- VIDEO MODAL --------------------------------------- */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <button
              onClick={() => setActiveVideo(null)}
              className="mt-4 text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      {/* -- VIDEO GRID ---------------------------------------- */}
      <section className="py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MIC_VIDEOS.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => setActiveVideo(video.id)}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href="https://www.youtube.com/@MurderMittenMedia"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-white/20 text-white/60 hover:border-red-600 hover:text-red-500 px-8 py-3 text-sm uppercase tracking-widest transition-all duration-200"
            >
              View Full Channel on YouTube →
            </a>
          </div>
        </div>
      </section>

      {/* -- FOOTER -------------------------------------------- */}
      <footer className="border-t border-white/10 py-10 mt-8">
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
