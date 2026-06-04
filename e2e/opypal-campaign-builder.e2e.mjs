// Opypal Campaign Builder — automated Playwright e2e suite
// =========================================================
//
// HOW TO RUN
// ----------
// `runTest` is only injected inside the Replit code_execution sandbox, so this
// module cannot be run with `node`/`tsx`. Execute it from the code_execution
// tool like this:
//
//   const { run } = await import("./e2e/opypal-campaign-builder.e2e.mjs");
//   const results = await run(runTest);
//   console.log(JSON.stringify(results, null, 2));
//
// NOTE ON THE RUN LIMIT: the testing tool enforces a cap of ~10 test-runs per
// task. If `runTest` rejects almost instantly with
// "Maximum testing iterations (10) reached", the cap for the current task has
// been exhausted — it resets in a fresh session/conversation. This suite issues
// 4 runs, so start it on a task that still has budget.
//
// COVERAGE
//   1. Segment creation + audience preview
//   2. Asset upload served only to the owning workspace (cross-ws 403, unauth 401)
//   3. Schedule create + run
//   4. Operator vs manager role gating
//
// ENVIRONMENT FACTS (development DB — shared with the app)
//   - Workspace 1 = "A3 Visual" holds campaign 4 "Q2 2026 General Outbound"
//     (draft) and email templates 28–34.
//   - Roles, lowest→highest: viewer < operator < manager < workspace_admin.
//       * operator can create/edit segments and schedules (mutate)
//       * manager can additionally "Send now" a segment and "Run" a schedule
//   - Segments resolve to leads; schedule send-windows are stored as integer
//     minutes.
//   - Every /api/* request is auth-gated; the active workspace is supplied via
//     the `x-workspace-id` header (the frontend stamps it from localStorage key
//     `opypal_current_workspace`). The server independently authorizes it.
//
// All test data uses a per-run unique id so repeated runs don't collide with
// each other or with the user's data.

const TECH = `
Opypal (a3-sales-os web app + api-server) — campaign builder.
- App base path: "/". Campaign builder lives at /campaigns/:id.
- Campaign 4 "Q2 2026 General Outbound" is in workspace 1 ("A3 Visual").
- Email templates 28-34 belong to workspace 1.
- Roles (low->high): viewer < operator < manager < workspace_admin.
  operator = create/edit segments & schedules; manager additionally = "Send now" a
  segment and "Run" a schedule.
- Campaign builder API routes:
    GET/POST /api/campaigns/:campaignId/segments
    GET/POST /api/campaigns/:campaignId/schedules
    GET/POST /api/campaigns/:campaignId/assets
    GET      /api/campaigns/:campaignId/performance
    GET      /api/campaign-segments/:id/audience
    GET      /api/campaign-segments/:id/performance
    POST     /api/campaign-segments/:id/preview-audience   (operator+)
    POST     /api/campaign-segments/:id/send               (manager+)
- Asset serving: GET /api/storage/objects/<objectPath>
    unauthenticated      -> 401
    member of other ws    -> 403
    member of owning ws    -> 200 (streams the file)
    owning ws, missing row -> 404
- Auth is Clerk; sign in programmatically with [Clerk Auth] (testClerkAuth:true).
- A workspace member row must exist before sign-in so the user resolves to the
  workspace; insert it with a [DB] step.
`;

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// 1. Segment creation + audience preview
// ---------------------------------------------------------------------------
function planSegmentCreationAndPreview() {
  const id = uid();
  const email = `e2e-seg-${id}@example.com`;
  const segmentName = `E2E Hotels ${id}`;
  return {
    name: "segment-creation-and-audience-preview",
    testClerkAuth: true,
    relevantTechnicalDocumentation: TECH,
    testPlan: `
1. [New Context] Create a new browser context.
2. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (1, '${email}', 'operator', 'active') ON CONFLICT DO NOTHING;
3. [Clerk Auth] Sign in as {firstName:"Seg", lastName:"Operator", email:"${email}"}.
4. [Browser] Navigate to "/" and wait for the authenticated dashboard (left sidebar visible).
5. [Browser] Open campaign 4 by navigating to /campaigns/4. Wait for the campaign
   builder to load and show a segments section.
6. [Browser] Create a new segment named "${segmentName}": open the segment
   creation form, choose a template (any of templates 28-34), set the audience
   filter to contact type / lead type "Hotels", and save the segment.
7. [Verify] The new segment "${segmentName}" appears in the campaign's segment list.
8. [Browser] Open the audience preview for "${segmentName}" (preview-audience).
9. [Verify] An audience preview is shown (a count of matching leads and/or a list
   of preview recipients). It must render without an error toast or 4xx error.
`,
  };
}

// ---------------------------------------------------------------------------
// 2. Asset upload served only to the owning workspace (cross-ws 403, unauth 401)
// ---------------------------------------------------------------------------
function planAssetServingIsolation() {
  const id = uid();
  const ownerEmail = `e2e-asset-owner-${id}@example.com`;   // workspace 1
  const outsiderEmail = `e2e-asset-out-${id}@example.com`;  // workspace 2 only
  const assetName = `e2e-asset-${id}.png`;
  return {
    name: "asset-serving-workspace-isolation",
    testClerkAuth: true,
    relevantTechnicalDocumentation: TECH,
    testPlan: `
1. [New Context] Create a new browser context (context A — owner).
2. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (1, '${ownerEmail}', 'manager', 'active') ON CONFLICT DO NOTHING;
3. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (2, '${outsiderEmail}', 'manager', 'active') ON CONFLICT DO NOTHING;
4. [Clerk Auth] Sign in as {firstName:"Asset", lastName:"Owner", email:"${ownerEmail}"}.
5. [Browser] Navigate to /campaigns/4 and open the campaign's assets section.
6. [Browser] Upload a small image asset (file name "${assetName}"). Wait for the
   upload to finish and the asset to appear in the asset list.
7. [Verify] The asset "${assetName}" appears in campaign 4's asset list, and its
   served URL (under /api/storage/objects/...) loads for the owner (HTTP 200 /
   image renders). Note the asset's object path / served URL (call it ASSET_URL)
   for the next steps.
8. [API] As the signed-in owner, GET ASSET_URL.
9. [Verify] The owner request returns HTTP 200 (the owning workspace can read it).
10. [New Context] Create a new browser context (context B — outsider).
11. [Clerk Auth] Sign in as {firstName:"Asset", lastName:"Outsider", email:"${outsiderEmail}"}.
12. [API] As the outsider (member of workspace 2 only, with x-workspace-id: 2),
    GET ASSET_URL.
13. [Verify] The outsider request returns HTTP 403 (a member of another workspace
    cannot read workspace 1's asset).
14. [New Context] Create a new browser context (context C — unauthenticated).
15. [API] Without signing in, GET ASSET_URL.
16. [Verify] The unauthenticated request returns HTTP 401.
`,
  };
}

// ---------------------------------------------------------------------------
// 3. Schedule create + run
// ---------------------------------------------------------------------------
function planScheduleCreateAndRun() {
  const id = uid();
  const email = `e2e-sched-${id}@example.com`;
  const segmentName = `E2E Sched Seg ${id}`;
  return {
    name: "schedule-create-and-run",
    testClerkAuth: true,
    relevantTechnicalDocumentation: TECH,
    testPlan: `
1. [New Context] Create a new browser context.
2. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (1, '${email}', 'manager', 'active') ON CONFLICT DO NOTHING;
3. [Clerk Auth] Sign in as {firstName:"Sched", lastName:"Manager", email:"${email}"}.
4. [Browser] Navigate to /campaigns/4 and wait for the campaign builder to load.
5. [Browser] Ensure there is a segment with a template and a non-empty audience:
   create a segment "${segmentName}" with a template (28-34) and audience filter
   lead type "Hotels" if no usable segment exists.
6. [Browser] Create a schedule for the campaign: open the schedule form, pick a
   send window (a time of day) and save it.
7. [Verify] The new schedule appears in the campaign's schedule list with the
   chosen send window.
8. [Browser] Trigger "Run" on the schedule (manager can run it).
9. [Verify] Running succeeds — a success confirmation/toast appears and no 4xx/5xx
   error is shown. The schedule reflects a run (status/last-run updates).
`,
  };
}

// ---------------------------------------------------------------------------
// 4. Operator vs manager role gating
// ---------------------------------------------------------------------------
function planRoleGating() {
  const id = uid();
  const operatorEmail = `e2e-role-op-${id}@example.com`;
  const managerEmail = `e2e-role-mgr-${id}@example.com`;
  return {
    name: "operator-vs-manager-role-gating",
    testClerkAuth: true,
    relevantTechnicalDocumentation: TECH,
    testPlan: `
1. [New Context] Create a new browser context (context A — operator).
2. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (1, '${operatorEmail}', 'operator', 'active') ON CONFLICT DO NOTHING;
3. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (1, '${managerEmail}', 'manager', 'active') ON CONFLICT DO NOTHING;
4. [Clerk Auth] Sign in as {firstName:"Role", lastName:"Operator", email:"${operatorEmail}"}.
5. [Browser] Navigate to /campaigns/4 and open a segment.
6. [Verify] As an operator: creating/editing a segment and previewing the
   audience is allowed, BUT the privileged actions are blocked — the segment
   "Send now" action and the schedule "Run" action are hidden or disabled.
7. [API] As the operator (x-workspace-id: 1), POST /api/campaign-segments/<segmentId>/send.
8. [Verify] The operator send request is rejected with HTTP 403 (insufficient permissions).
9. [New Context] Create a new browser context (context B — manager).
10. [Clerk Auth] Sign in as {firstName:"Role", lastName:"Manager", email:"${managerEmail}"}.
11. [Browser] Navigate to /campaigns/4 and open the same segment.
12. [Verify] As a manager: the segment "Send now" and the schedule "Run" actions
    are visible and enabled.
13. [API] As the manager (x-workspace-id: 1), POST /api/campaign-segments/<segmentId>/send
    (or trigger a schedule run).
14. [Verify] The manager privileged request is accepted (HTTP 2xx) — manager has
    the elevated permission the operator lacked.
`,
  };
}

export const plans = [
  planSegmentCreationAndPreview,
  planAssetServingIsolation,
  planScheduleCreateAndRun,
  planRoleGating,
];

// Run the whole suite. Pass the sandbox-injected `runTest` in.
// Stops early and reports if the per-task run limit is hit.
export async function run(runTest) {
  const results = [];
  for (const makePlan of plans) {
    const { name, ...args } = makePlan();
    try {
      const res = await runTest(args);
      results.push({ name, status: res.status, testOutput: res.testOutput, screenshotPaths: res.screenshotPaths });
      console.log(`[${name}] -> ${res.status}`);
    } catch (e) {
      const msg = String(e?.message ?? e);
      results.push({ name, status: "error", error: msg });
      console.log(`[${name}] -> ERROR: ${msg}`);
      if (msg.includes("Maximum testing iterations")) {
        console.log("Per-task test-run limit reached — stopping. Resume in a fresh session.");
        break;
      }
    }
  }
  return results;
}
