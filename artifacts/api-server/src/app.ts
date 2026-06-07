import express, { type Express } from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middleware/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Clerk Frontend API proxy (production only — streams raw bytes, must run
// before body parsers).
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve the publishable key from the incoming host so the same server can
// serve multiple Clerk custom domains; falls back to CLERK_PUBLISHABLE_KEY.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// ---------------------------------------------------------------------------
// Production static serving for a single-service deploy (e.g. Render).
// The build step copies the built SPAs next to the bundled server:
//   <dist>/client                     -> a3-sales-os        (served at "/")
//   <dist>/client/a3-partner-portal   -> a3-partner-portal  (served at "/a3-partner-portal")
// In development the Vite dev servers handle the frontends, so this is skipped.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  const clientDir = path.join(__dirname, "client");
  const partnerDir = path.join(clientDir, "a3-partner-portal");

  if (fs.existsSync(partnerDir)) {
    app.use("/a3-partner-portal", express.static(partnerDir, { index: false }));
    app.get(/^\/a3-partner-portal(\/.*)?$/, (_req, res) => {
      res.sendFile(path.join(partnerDir, "index.html"));
    });
  }

  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false }));
    // SPA fallback for the Sales OS app: any non-/api, non-asset route returns
    // the SPA shell so client-side routing works on refresh/deep links.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }
}

export default app;
