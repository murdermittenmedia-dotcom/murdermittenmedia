import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getOAuthLoginUrl } from "@/const";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function Login() {
  const [, navigate] = useLocation();
  const returnPath = useMemo(() => safeReturnPath(new URLSearchParams(window.location.search).get("returnTo")), []);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = trpc.auth.login.useMutation({
    onSuccess: () => { toast.success("Welcome back to the Mitten."); navigate(returnPath); },
    onError: (error) => toast.error(error.message),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: () => { toast.success("Your Murder Mitten account is ready."); navigate(returnPath); },
    onError: (error) => toast.error(error.message),
  });
  const isPending = login.isPending || register.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate({ username, password });
    else register.mutate({ username, password, name: name || undefined, email: email || undefined });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(209,0,0,0.22),transparent_36%),radial-gradient(circle_at_90%_90%,rgba(90,0,0,0.18),transparent_38%)]" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(/manus-storage/mmm_logo_8689da6b.png)", backgroundPosition: "right -12rem bottom -14rem", backgroundRepeat: "no-repeat", backgroundSize: "42rem" }} />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 lg:justify-between lg:gap-16">
        <section className="hidden max-w-xl lg:block">
          <div className="mb-7 flex items-center gap-4"><img src={LOGO} alt="Murder Mitten Media" className="h-16 w-16 rounded-full border-2 border-red-600/60" /><div><p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">Murder Mitten Media</p><p className="mt-1 text-sm text-white/40">The industry watches the trenches.</p></div></div>
          <h1 className="font-['Anton'] text-7xl uppercase leading-[0.9] tracking-tight xl:text-8xl">Pull up<br /><span className="text-red-600">to the Mitten.</span></h1>
          <p className="mt-7 max-w-md border-l-2 border-red-600 pl-5 text-lg leading-relaxed text-white/55">Sign in to submit music, join the conversation, manage your creator tools, and get closer to the culture.</p>
        </section>

        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-black/75 p-6 shadow-2xl shadow-red-950/30 backdrop-blur-xl sm:p-8">
          <div className="mb-7 text-center lg:text-left"><img src={LOGO} alt="Murder Mitten Media logo" className="mx-auto mb-4 h-14 w-14 rounded-full border border-red-500/50 lg:hidden" /><p className="text-xs font-black uppercase tracking-[0.28em] text-red-500">Welcome to the Mitten</p><h2 className="mt-2 font-['Anton'] text-4xl uppercase">{mode === "login" ? "Sign in" : "Create account"}</h2><p className="mt-2 text-sm text-white/45">{mode === "login" ? "Keep your existing login options or use your Murder Mitten account." : "Create a Murder Mitten username and password in seconds."}</p></div>
          <a href={getOAuthLoginUrl(returnPath)} className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/20 bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90"><LogIn className="h-4 w-4" /> Continue with Google / existing login</a>
          <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/25"><span className="h-px flex-1 bg-white/10" />Or use Murder Mitten account<span className="h-px flex-1 bg-white/10" /></div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && <><label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/45">Display name (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-red-500" placeholder="Your artist or display name" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/45">Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-red-500" placeholder="you@example.com" /></label></>}
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/45">Username</span><input required value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} autoComplete="username" className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-red-500" placeholder="your_username" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/45">Password</span><div className="relative"><input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "register" ? 8 : 1} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-3 pr-11 text-sm outline-none transition placeholder:text-white/25 focus:border-red-500" placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
            <button disabled={isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60">{mode === "login" ? <LockKeyhole className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{isPending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="h-4 w-4" /></button>
          </form>
          <button type="button" onClick={() => setMode((value) => value === "login" ? "register" : "login")} className="mt-5 w-full text-center text-xs text-white/45 transition hover:text-white">{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
          <Link href="/" className="mt-6 block text-center text-[10px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60">Return to Murder Mitten Media</Link>
        </section>
      </div>
    </main>
  );
}
