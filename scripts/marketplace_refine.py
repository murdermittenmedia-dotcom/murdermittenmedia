from pathlib import Path

producer = Path('/home/ubuntu/murdermittenmedia/client/src/pages/BeatProducer.tsx')
s = producer.read_text()
old = '</div></section><section className="border border-white/10 bg-[#0f0f0f] p-6"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-green-400"><CircleDollarSign'
new = '''</div>{!plan?.isPro && <div className="mt-5 border border-yellow-500/30 bg-yellow-500/[.05] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-yellow-200">Upgrade to Beat Pro</p><p className="mt-1 text-xs text-white/50">Unlock the full producer toolkit and keep 100% of every license.</p></div><button type="button" onClick={() => startUpgrade("year")} disabled={upgrade.isPending} className="shrink-0 bg-yellow-400 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-yellow-300 disabled:opacity-50">{upgrade.isPending ? "Loading…" : "Upgrade to Pro"}</button></div><div className="mt-3 grid gap-2 text-[10px] font-bold uppercase tracking-wide text-white/60 sm:grid-cols-2"><span>Unlimited uploads</span><span>100% royalties</span><span>AI title + tag help</span><span>Cover discovery</span><span>Preview producer tags</span><span>Direct payment methods</span></div></div>}</section><section className="border border-white/10 bg-[#0f0f0f] p-6"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-green-400"><CircleDollarSign'''
if old not in s:
    raise SystemExit('producer plan insertion target not found')
s = s.replace(old, new, 1)
old = '<YouTubeImport isPro={!!plan?.isPro} importing={importYouTube.isPending || suggestMetadata.isPending} onUpgrade={startUpgrade} onImport={importYouTubeListing} />{plan?.isPro && <ListingWizard generating={generateListingDraft.isPending} onGenerate={applyListingDraft} />}<div className="grid gap-6 md:grid-cols-2">'
new = '<details className="border border-white/10 bg-black/15 p-4"><summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-white/70">Optional tools · AI + YouTube import</summary><div className="mt-4 space-y-4"><YouTubeImport isPro={!!plan?.isPro} importing={importYouTube.isPending || suggestMetadata.isPending} onUpgrade={startUpgrade} onImport={importYouTubeListing} />{plan?.isPro && <ListingWizard generating={generateListingDraft.isPending} onGenerate={applyListingDraft} />}</div></details><div className="grid gap-6 md:grid-cols-2">'
if old not in s:
    raise SystemExit('producer optional tools target not found')
s = s.replace(old, new, 1)
old = '<TagBuilder isPro={!!plan?.isPro} onUpgrade={startUpgrade} source={tagSource} atSeconds={tagAtSeconds} customFile={customTag} setSource={setTagSource} setAtSeconds={setTagAtSeconds} setCustomFile={setCustomTag} /><BeatPreviewStudio source={master || (editing ? editing.masterFileUrl : null)} previewStartSeconds={previewStart} tagSource={tagSource} tagAtSeconds={tagAtSeconds} customTag={customTag} resolvedTagAudio={tagPreviewQuery.data} tagLoadError={tagPreviewQuery.isError} onPreviewReady={setBrowserPreview} /><LeaseBuilder leases={leases} setLeases={setLeases} />'
new = '<details className="border border-white/10 bg-black/15 p-4"><summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-white/70">Optional tools · preview + producer tag</summary><div className="mt-4 space-y-4"><TagBuilder isPro={!!plan?.isPro} onUpgrade={startUpgrade} source={tagSource} atSeconds={tagAtSeconds} customFile={customTag} setSource={setTagSource} setAtSeconds={setTagAtSeconds} setCustomFile={setCustomTag} /><BeatPreviewStudio source={master || (editing ? editing.masterFileUrl : null)} previewStartSeconds={previewStart} tagSource={tagSource} tagAtSeconds={tagAtSeconds} customTag={customTag} resolvedTagAudio={tagPreviewQuery.data} tagLoadError={tagPreviewQuery.isError} onPreviewReady={setBrowserPreview} /></div></details><details className="border border-white/10 bg-black/15 p-4"><summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-white/70">License options</summary><div className="mt-4"><LeaseBuilder leases={leases} setLeases={setLeases} /></div></details>'
if old not in s:
    raise SystemExit('producer preview tools target not found')
s = s.replace(old, new, 1)
producer.write_text(s)

invite = Path('/home/ubuntu/murdermittenmedia/client/src/pages/BeatProInvite.tsx')
s = invite.read_text()
old = '<div className="p-7"><div className="grid gap-3 sm:grid-cols-3">'
new = '<div className="p-7"><div className="mb-5 border border-green-500/30 bg-green-500/[.06] p-4"><p className="text-sm font-black uppercase tracking-widest text-green-300">$0 charged today</p><p className="mt-1 text-xs leading-relaxed text-white/55">Your saved payment method is only billed {money(annualPriceCents)}/year after the full {trialDays}-day trial, unless you cancel first.</p></div><div className="grid gap-3 sm:grid-cols-3">'
if old not in s:
    raise SystemExit('invite copy target not found')
invite.write_text(s.replace(old, new, 1))

test = Path('/home/ubuntu/murdermittenmedia/server/beat-pro-trial-invite.test.ts')
s = test.read_text()
if 'expect(router).toContain("trial_period_days: BEAT_PRO_TRIAL_DAYS")' not in s:
    raise SystemExit('trial test target not found')
test.write_text(s.replace('expect(router).toContain("trial_period_days: BEAT_PRO_TRIAL_DAYS")', 'expect(router).toContain("trial_end: Math.floor(Date.now() / 1000) + BEAT_PRO_TRIAL_DAYS * 24 * 60 * 60")', 1))
print('Marketplace refinements applied')
