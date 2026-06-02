import { Router, type IRouter } from "express";
import { requireAuth, resolveWorkspace } from "../middleware/clerk-auth";
import meRouter from "./me";
import workspacesRouter from "./workspaces";
import adminRouter from "./admin";
import membersRouter from "./members";
import healthRouter from "./health";
import leadsRouter from "./leads";
import tasksRouter from "./tasks";
import templatesRouter from "./templates";
import assetsRouter from "./assets";
import dashboardRouter from "./dashboard";
import syncRouter from "./sync";
import contactsRouter from "./contacts";
import campaignsRouter from "./campaigns";
import templateSetsRouter from "./template-sets";
import sequenceRouter from "./sequence";
import outboundRouter from "./outbound";
import scheduledEmailsRouter from "./scheduled-emails";
import notificationsRouter from "./notifications";
import engagementEventsRouter from "./engagement-events";
import bulkSendRouter from "./bulk-send";
import inboundEmailRouter from "./inbound-email";
import partnersRouter from "./partners";
import partnerRequestsRouter from "./partner-requests";
import pricingRulesRouter from "./pricing-rules";
import outlookRouter from "./outlook";
import companiesRouter from "./companies";
import replyReviewRouter from "./reply-review";
import settingsRouter from "./settings";
import seedRouter from "./seed-templates";

const router: IRouter = Router();

// Public / unauthenticated.
router.use(healthRouter);
router.use(meRouter); // applies requireAuth internally
router.use(workspacesRouter); // applies requireAuth/requireSuperAdmin internally
router.use(adminRouter); // platform admin (super-admin only) — global users

// Partner-portal routers manage their own auth + workspace resolution
// internally (they expose public partner pages and intake endpoints).
router.use(partnersRouter);
router.use(partnerRequestsRouter);
router.use(pricingRulesRouter);

// Mixed routers: they contain PUBLIC webhook/tracking/callback routes that
// cannot carry an x-workspace-id header, so they apply auth + workspace
// resolution per-route internally and derive the workspace server-side for
// their public endpoints.
router.use(outboundRouter);
router.use(engagementEventsRouter);
router.use(inboundEmailRouter);
router.use(outlookRouter);

// Fully authenticated, workspace-scoped CRM / Sales OS routers. requireAuth +
// resolveWorkspace run here so every handler has a validated req.workspaceId
// and cross-workspace access is impossible.
const scoped = [requireAuth, resolveWorkspace] as const;
router.use(...scoped, membersRouter);
router.use(...scoped, leadsRouter);
router.use(...scoped, tasksRouter);
router.use(...scoped, templatesRouter);
router.use(...scoped, assetsRouter);
router.use(...scoped, dashboardRouter);
router.use(...scoped, syncRouter);
router.use(...scoped, contactsRouter);
router.use(...scoped, campaignsRouter);
router.use(...scoped, templateSetsRouter);
router.use(...scoped, sequenceRouter);
router.use(...scoped, scheduledEmailsRouter);
router.use(...scoped, notificationsRouter);
router.use(...scoped, bulkSendRouter);
router.use(...scoped, companiesRouter);
router.use(...scoped, replyReviewRouter);
router.use(...scoped, settingsRouter);
router.use(...scoped, seedRouter);

export default router;
