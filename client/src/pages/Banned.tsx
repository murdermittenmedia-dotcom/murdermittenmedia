/* ============================================================
   BANNED PAGE
   Shown when a banned user attempts to log in.
   No navigation — intentional dead end.
   ============================================================ */

import { ShieldOff, Mail } from "lucide-react";

export default function Banned() {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center px-6">
      {/* Red top bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-red-600" />

      <div className="max-w-lg w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full border-2 border-red-600/40 flex items-center justify-center bg-red-600/10">
            <ShieldOff className="w-9 h-9 text-red-500" />
          </div>
        </div>

        {/* Headline */}
        <div>
          <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase tracking-wider text-red-600 mb-3">
            BANNED
          </h1>
          <div className="w-16 h-0.5 bg-red-600 mx-auto mb-6" />
          <p className="text-white/60 text-base leading-relaxed">
            Your account has been banned from Murder Mitten Media. You are no longer permitted to access this platform.
          </p>
        </div>

        {/* Appeal section */}
        <div className="border border-white/10 bg-white/[0.03] p-6 text-left space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-red-600 flex-shrink-0" />
            <span className="text-xs text-white/50 uppercase tracking-widest font-semibold">To Appeal Your Ban</span>
          </div>
          <p className="text-white/50 text-sm leading-relaxed">
            If you believe this ban was issued in error, or you would like to appeal, contact us directly at the email below. Include your account name and a brief explanation.
          </p>
          <a
            href="mailto:murdermittenmedia@gmail.com?subject=Ban Appeal"
            className="flex items-center gap-3 mt-4 group"
          >
            <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0 group-hover:bg-red-600 transition-colors">
              <Mail className="w-4 h-4 text-red-400 group-hover:text-white transition-colors" />
            </div>
            <span className="text-red-400 group-hover:text-red-300 transition-colors text-sm font-semibold underline underline-offset-4 decoration-red-600/40">
              murdermittenmedia@gmail.com
            </span>
          </a>
        </div>

        {/* Footer note */}
        <p className="text-white/20 text-xs uppercase tracking-widest">
          Murder Mitten Media · Detroit, MI
        </p>
      </div>
    </div>
  );
}
