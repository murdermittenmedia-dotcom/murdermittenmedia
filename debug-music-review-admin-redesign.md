Music Review admin redesign verification findings (Aug 25, 2026)

At 1440x900, the public Music Review workspace now uses the available width with a two-column arrangement: current playback on the left and Live Chat on the right. The queue and submit/history/skip controls span the lower workspace. The page remains in the simplified no-judge state requested earlier.

At 390x844, the same layout stacks current playback above Live Chat and preserves large touch targets with no horizontal overflow. The existing global FloatingPlayer remains mounted by App.tsx, so the persistent bottom player is preserved across routes.

The admin overview at 1440x900 renders as a 260px branded sidebar, sticky top bar, real queue/member/payment metrics, current-track summary, and activity snapshot. At 390x844 it uses a drawer trigger and vertically stacked cards.

The first admin visual verification found and fixed a React hook-order crash caused by drawer state being declared after loading/auth early returns. The production build and focused regression tests pass after the fix. Existing unrelated TypeScript diagnostics remain in server/db.ts and server/routers.ts.
