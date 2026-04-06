import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(tasksRouter);
router.use(templatesRouter);
router.use(assetsRouter);
router.use(dashboardRouter);
router.use(syncRouter);
router.use(contactsRouter);
router.use(campaignsRouter);
router.use(templateSetsRouter);
router.use(sequenceRouter);
router.use(outboundRouter);
router.use(scheduledEmailsRouter);

export default router;
