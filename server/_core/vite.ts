import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// ── Per-route OG meta tag definitions ────────────────────────────────────────
const BASE_URL = "https://murdermittenmedia.com";

interface RouteMeta {
  title: string;
  description: string;
  image?: string;
  imageWidth?: string;
  imageHeight?: string;
  url?: string;
}

const ROUTE_META: Array<{ test: (p: string) => boolean; meta: RouteMeta }> = [
  {
    test: (p) => p === "/merch" || p.startsWith("/merch/"),
    meta: {
      title: "Official Murder Mitten Merch",
      description: "Shop the limited first release from Murder Mitten Media.",
      image: `${BASE_URL}/manus-storage/merch-share_50fb0a5b.jpg`,
      imageWidth: "1200",
      imageHeight: "630",
      url: `${BASE_URL}/merch`,
    },
  },
  {
    test: (p) => p === "/" || p === "",
    meta: {
      title: "Murder Mitten Media | Where the Industry Watches the Trenches",
      description: "Murder Mitten Media — Michigan's #1 rap, culture, and viral content media brand. EST. 2022. 4.5M+ views.",
      image: `${BASE_URL}/manus-storage/mmm_logo_8689da6b.png`,
      url: BASE_URL,
    },
  },
];

function buildOgTags(meta: RouteMeta): string {
  const tags: string[] = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${meta.title}" />`,
    `<meta property="og:description" content="${meta.description}" />`,
    `<meta property="og:url" content="${meta.url ?? BASE_URL}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${meta.title}" />`,
    `<meta name="twitter:description" content="${meta.description}" />`,
  ];
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${meta.image}" />`);
    tags.push(`<meta name="twitter:image" content="${meta.image}" />`);
  }
  if (meta.imageWidth)  tags.push(`<meta property="og:image:width" content="${meta.imageWidth}" />`);
  if (meta.imageHeight) tags.push(`<meta property="og:image:height" content="${meta.imageHeight}" />`);
  return tags.join("\n    ");
}

function injectOgTags(html: string, pathname: string): string {
  const route = ROUTE_META.find((r) => r.test(pathname));
  if (!route) return html;
  const { meta } = route;
  // Remove any existing og: / twitter: meta tags from the static template
  let out = html.replace(/<meta\s+property="og:[^"]+"[^>]*\/>/g, "");
  out = out.replace(/<meta\s+name="twitter:[^"]+"[^>]*\/>/g, "");
  // Inject fresh tags before </head>
  const ogBlock = buildOgTags(meta);
  out = out.replace("</head>", `    ${ogBlock}\n  </head>`);
  // Update <title>
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  return out;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      const pathname = url.split("?")[0];
      const finalPage = injectOgTags(page, pathname);
      res.status(200).set({ "Content-Type": "text/html" }).end(finalPage);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist — inject OG tags per route
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    const pathname = (req.originalUrl || "/").split("?")[0];
    const finalHtml = injectOgTags(html, pathname);
    res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  });
}
