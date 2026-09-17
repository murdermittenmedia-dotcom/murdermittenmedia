import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("site announcement workflow", () => {
  it("keeps the announcement durable, admin-controlled, and realtime", () => {
    const routerSource = source("server/routers.ts");
    const serverSource = source("server/_core/index.ts");
    const componentSource = source("client/src/components/SiteAnnouncementNotice.tsx");
    const appSource = source("client/src/App.tsx");
    const adminSource = source("client/src/pages/AdminPanel.tsx");

    expect(routerSource).toContain("announcements: router");
    expect(routerSource).toContain("getActive: publicProcedure");
    expect(routerSource).toContain("publish: adminProcedure");
    expect(routerSource).toContain("clear: adminProcedure");
    expect(routerSource).toContain("SITE_ANNOUNCEMENT_SETTING");
    expect(routerSource).toContain("broadcastSiteAnnouncement");
    expect(serverSource).toContain('io.emit("site:announcement", announcement)');
    expect(componentSource).toContain('socket.on("site:announcement"');
    expect(componentSource).toContain("mmm-dismissed-site-announcement");
    expect(appSource).toContain("<SiteAnnouncementNotice />");
    expect(adminSource).toContain("SiteAnnouncementComposer");
  });
});
