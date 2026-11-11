import { Link, useLocation } from "wouter";
import { ArrowLeft, FileText, Shield } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { SiteSettingsTab } from "./AdminPanel";

export default function AdminEditorialDesk() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#080808] text-white/40">Loading Editorial Desk…</div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080808] px-6 text-white">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="font-['Anton'] text-4xl uppercase">Admin access required</h1>
          <p className="mt-3 text-sm text-white/45">The Editorial Desk is restricted to Murder Mitten administrators.</p>
          <Button className="mt-6 bg-red-600 hover:bg-red-500" onClick={() => navigate("/")}>Return home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-24 sm:px-6 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/45 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to Admin Command
            </Link>
            <div className="flex items-center gap-3 text-red-400">
              <FileText className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Admin publishing workspace</span>
            </div>
            <h1 className="mt-2 font-['Anton'] text-5xl uppercase leading-none sm:text-7xl">Editorial <span className="text-red-600">Desk</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45">Create, edit, review, and publish Murder Mitten articles. ChatGPT-connected drafts remain unpublished until you approve them here.</p>
          </div>
          <Link href="/admin?tab=settings" className="inline-flex items-center justify-center border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/60 transition hover:border-red-500/60 hover:text-white">Open content settings</Link>
        </header>
        <SiteSettingsTab editorialOnly />
      </main>
    </div>
  );
}
