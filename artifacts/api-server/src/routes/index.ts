import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import tasksRouter from "./tasks";
import templatesRouter from "./templates";
import assetsRouter from "./assets";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(tasksRouter);
router.use(templatesRouter);
router.use(assetsRouter);
router.use(dashboardRouter);

export default router;
