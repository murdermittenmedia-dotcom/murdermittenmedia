Music Review admin control-board verification (Aug 25, 2026)

The admin board now presents a clear sequence: live session status and broadcast state, audio routing, audience reactions, chat/viewer controls, comment vibe, playback mode, pricing, viewer-count display, pending skip payments, and now-playing queue controls.

The public /review workspace was verified at 1440x900 and 390x844. Desktop uses a wide two-column current-playback/live-chat layout with the lower queue and action tabs spanning the workspace. Mobile stacks the playback and chat cards without horizontal overflow. The existing radio, queue, submit, history, skip, and global persistent-player surfaces remain present.

The first grouped-control edit briefly introduced an extra JSX closing tag; the production build caught it, it was removed, and the next build completed successfully. Full Vitest suite currently passes 71 tests. Existing unrelated TypeScript diagnostics remain in server/db.ts and server/routers.ts.
