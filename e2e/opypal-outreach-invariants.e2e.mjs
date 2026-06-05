// Opypal Outreach Pipeline — automated invariant e2e suite
// =========================================================
//
// HOW TO RUN
// ----------
// `runTest` is only injected inside the Replit code_execution sandbox, so this
// module cannot be run with `node`/`tsx`. Execute it from the code_execution
// tool like this:
//
//   const { run } = await import("./e2e/opypal-outreach-invariants.e2e.mjs");
//   const results = await run(runTest);
//   console.log(JSON.stringify(results, null, 2));
//
// NOTE ON THE RUN LIMIT: the testing tool enforces a cap of ~10 test-runs per
// task. If `runTest` rejects almost instantly with
// "Maximum testing iterations (10) reached", the cap for the current task has
// been exhausted — it resets in a fresh session/conversation. This suite issues
// 2 runs, so start it on a task that still has budget.
//
// COVERAGE — three outreach invariants
//   1. Segment assign schedules an ELIGIBLE contact (1 scheduled / 0 skipped),
//      the scheduled email appears in the unified queue with a "Scheduled"
//      lifecycle badge, AND a contact already in a sequence is SKIPPED on the
//      same assign (0 scheduled / 1 skipped) — the no-double-send guard.
//   2. (covered together with #1 above)
//   3. An inbound human reply pauses ONLY the workspace resolved from the
//      forwarding inbox; an identical contact email in another workspace is
//      left fully untouched.
//
// ENVIRONMENT FACTS (development DB — shared with the app)
//   - Workspace 1 = "A3 Visual" is a real workspace used for the UI flow.
//     All seeded rows use a per-run unique email/name so they never collide
//     with real data, and every plan cleans up the rows it created.
//   - Eligibility (artifacts/api-server/src/routes/segments-ops.ts):
//     a contact converges into a scheduled_email ONLY when its sequence_status
//     is NOT in the stopped set
//       [paused_replied, paused_manual, do_not_contact, unsubscribed, bounce]
//     AND NOT in the active set
//       [active, pending, enrolled, in_progress, scheduled].
//     So 'completed' (or null) is ELIGIBLE; 'active' is SKIPPED.
//   - The auth middleware lowercases the Clerk email before matching
//     workspace_members.email, so seeded membership emails must be lowercase.
//   - The inbound webhook POST /api/inbound-email is public (no auth); it
//     derives the workspace from the recipient ("to") matching a workspace's
//     sender_identity.forwardingInbox.
//
// All test data uses a per-run unique id so repeated runs don't collide.

const TECH = `
Opypal (a3-sales-os web app + api-server) — outreach pipeline invariants.
- App base path: "/". Routes: /contacts (contacts list), /scheduled-emails (unified queue).
- Auth is Clerk; sign in programmatically with [Clerk Auth] (testClerkAuth:true).
  The backend resolves the caller's email and LOWERCASES it, then matches
  workspace_members.email, so seeded membership rows MUST be lowercase. A
  membership row must exist before sign-in so the user resolves to its
  workspace; granting membership in exactly one workspace makes the backend
  default to it (no x-workspace-id header needed). Memberships are re-queried
  every request, so reload the page once if a "No workspace access" gate shows.
- Assign-to-segment UI: each contacts-table row has a ghost icon button with
  class text-violet-600 and title="Assign to segment". Clicking it opens the
  AssignSegmentModal (heading "Assign to Segment"): a Subject input, a Body
  textarea, an optional scheduledFor datetime, and an "Assign" button. On
  success a toast appears: title "Assigned to segment", description
  "\${emailsCreated} email(s) scheduled, \${skipped} skipped".
- Eligibility: POST /api/segments/assign creates 1 scheduled_emails row for an
  eligible contact (sequence_status 'completed'/null) and SKIPS a contact whose
  sequence_status is in [active,pending,enrolled,in_progress,scheduled] or the
  stopped set — preventing a double-send.
- Unified queue (/scheduled-emails) lists scheduled_emails; a row whose status
  is 'scheduled' renders a lifecycle badge labeled "Scheduled" (blue).
- Inbound reply webhook: POST /api/inbound-email (PUBLIC, no auth) with JSON
  {from, to, subject, text, message_id}. It resolves the target workspace from
  "to" matching a workspace's sender_identity.forwardingInbox, classifies the
  message, and on a human reply pauses that workspace's sequences only. The
  response shape is { success:true, matched, leadId, matchMethod, isAutoReply,
  sequencesPaused, inboundEmailId }. NOTE: the response does NOT include a
  "classification" field (classification is persisted on the inbound_emails
  row), and "matched"/"leadId" refer to LEAD-level matching only — a
  contact-only reply correctly reports matched:false while still pausing the
  contact's sequences (sequencesPaused > 0). A human reply yields
  isAutoReply:false and sequencesPaused > 0.
- Relevant DB tables:
    workspaces(id, name, slug, sender_identity jsonb)
    workspace_members(workspace_id, email, role, status)
    contacts(id, workspace_id, full_name, company, email, sequence_status, next_send_at)
    sequence_steps(id, workspace_id, contact_id, step_number, delay_days, status, scheduled_for)
    scheduled_emails(id, workspace_id, contact_id, subject, body, scheduled_for, status, source)
    inbound_emails(id, workspace_id, message_id, classification)
    activity(id, workspace_id, related_scheduled_email_id)
`;

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// 1 & 2. Segment assign: eligible contact is scheduled (and appears in the
//        unified queue with a "Scheduled" badge); active contact is skipped.
// ---------------------------------------------------------------------------
function planAssignSchedulesAndSkips() {
  const id = uid();
  const loginEmail = `e2e-assign-${id}@example.com`; // lowercase (required)
  const eligEmail = `e2e-elig-${id}@example.com`;
  const activeEmail = `e2e-active-${id}@example.com`;
  const eligCompany = `EligibleCo ${id}`;
  const activeCompany = `ActiveCo ${id}`;
  const inList = `('${eligEmail}','${activeEmail}')`;
  return {
    name: "segment-assign-schedules-eligible-and-skips-active",
    testClerkAuth: true,
    relevantTechnicalDocumentation: TECH,
    testPlan: `
1. [New Context] Create a new browser context.
2. [DB] INSERT INTO workspace_members (workspace_id, email, role, status)
   VALUES (1, '${loginEmail}', 'operator', 'active') ON CONFLICT DO NOTHING;
3. [DB] Seed an ELIGIBLE contact (sequence_status 'completed' = eligible):
   INSERT INTO contacts (workspace_id, full_name, company, email, sequence_status)
   VALUES (1, 'E2E Eligible ${id}', '${eligCompany}', '${eligEmail}', 'completed');
4. [DB] Seed an ALREADY-IN-SEQUENCE contact (sequence_status 'active' = skipped):
   INSERT INTO contacts (workspace_id, full_name, company, email, sequence_status, next_send_at)
   VALUES (1, 'E2E Active ${id}', '${activeCompany}', '${activeEmail}', 'active', now());
5. [Clerk Auth] Sign in as {firstName:"Assign", lastName:"Operator", email:"${loginEmail}"}.
6. [Browser] Navigate to /contacts and wait for the contacts table. If a
   "No workspace access" screen shows, reload the page once.
7. [Browser] Locate the "E2E Eligible ${id}" / "${eligCompany}" row (use the
   page search/filter and type "${eligEmail}" if a search box exists).
8. [Verify] A row for "E2E Eligible ${id}" / "${eligCompany}" is visible.
9. [Browser] In that eligible row, click the violet icon button title="Assign to
   segment". In the "Assign to Segment" modal, fill Subject "E2E Inv1 ${id}" and
   Body "eligible body", leave scheduledFor empty, and click "Assign".
10. [Verify] A success toast appears: title "Assigned to segment", description
    contains "1 email(s) scheduled, 0 skipped". The modal closes.
11. [Browser] Locate the "E2E Active ${id}" / "${activeCompany}" row (search
    "${activeEmail}" if needed).
12. [Browser] In that active row, click the violet icon button title="Assign to
    segment". In the modal fill Subject "E2E Inv2 ${id}" and Body "active body",
    then click "Assign".
13. [Verify] A toast appears whose description contains
    "0 email(s) scheduled, 1 skipped" (the already-in-sequence contact was
    skipped — no duplicate scheduled email).
14. [Browser] Navigate to /scheduled-emails (the unified queue). If a search/
    filter box exists, type "${eligEmail}".
15. [Verify] A queue row for the eligible contact (${eligEmail} / ${eligCompany})
    is displayed and shows a lifecycle status badge labeled "Scheduled".
16. [DB] Confirm the scheduled-email counts (no double-send):
    SELECT c.email, count(se.id) AS scheduled_count
    FROM contacts c LEFT JOIN scheduled_emails se ON se.contact_id = c.id
    WHERE c.workspace_id = 1 AND c.email IN ${inList}
    GROUP BY c.email ORDER BY c.email;
17. [Verify] The result shows '${eligEmail}' with scheduled_count = 1 and
    '${activeEmail}' with scheduled_count = 0.
18. [DB] Cleanup (run all, in this order):
    DELETE FROM activity WHERE related_scheduled_email_id IN
      (SELECT id FROM scheduled_emails WHERE contact_id IN
        (SELECT id FROM contacts WHERE workspace_id=1 AND email IN ${inList}));
    DELETE FROM scheduled_emails WHERE contact_id IN
      (SELECT id FROM contacts WHERE workspace_id=1 AND email IN ${inList});
    DELETE FROM contacts WHERE workspace_id=1 AND email IN ${inList};
    DELETE FROM workspace_members WHERE workspace_id=1 AND email='${loginEmail}';
`,
  };
}

// ---------------------------------------------------------------------------
// 3. Inbound reply pauses the correct pipeline in the correct workspace only.
// ---------------------------------------------------------------------------
function planReplyPausesCorrectWorkspace() {
  const id = uid();
  const email = `e2e-reply-${id}@example.com`;          // same contact email in both ws
  const fwd = `e2e-fwd-${id}@a3visual.com`;             // WA's forwarding inbox
  const slugA = `e2e-wa-${id}`;
  const slugB = `e2e-wb-${id}`;
  const msgId = `<e2e-${id}@mail.example.com>`;
  // A reply body that classifies as a genuine human reply (autoScore 0).
  const replyBody = "Yes, I would like to learn more. Can we schedule a call next week to discuss?";
  return {
    name: "inbound-reply-pauses-correct-workspace-only",
    testClerkAuth: false,
    relevantTechnicalDocumentation: TECH,
    testPlan: `
1. [New Context] Create a new browser context (no sign-in needed; the inbound
   webhook is public).
2. [DB] Create two throwaway workspaces. WA has a forwardingInbox hint; WB does not:
   INSERT INTO workspaces (name, slug, sender_identity) VALUES
     ('E2E WA ${id}', '${slugA}', '{"fromName":"WA","forwardingInbox":"${fwd}"}'),
     ('E2E WB ${id}', '${slugB}', '{"fromName":"WB"}');
3. [DB] Seed the SAME contact email, actively in a sequence, in WA:
   INSERT INTO contacts (workspace_id, full_name, company, email, sequence_status, next_send_at)
   SELECT id, 'Reply Tester', 'Acme', '${email}', 'active', now()
   FROM workspaces WHERE slug='${slugA}';
4. [DB] Seed the SAME contact email, actively in a sequence, in WB:
   INSERT INTO contacts (workspace_id, full_name, company, email, sequence_status, next_send_at)
   SELECT id, 'Reply Tester', 'Acme', '${email}', 'active', now()
   FROM workspaces WHERE slug='${slugB}';
5. [DB] Seed a scheduled sequence_step for the WA contact:
   INSERT INTO sequence_steps (workspace_id, contact_id, step_number, delay_days, status, scheduled_for)
   SELECT c.workspace_id, c.id, 1, 0, 'scheduled', now()
   FROM contacts c JOIN workspaces w ON w.id=c.workspace_id
   WHERE w.slug='${slugA}' AND c.email='${email}';
6. [DB] Seed a scheduled sequence_step for the WB contact:
   INSERT INTO sequence_steps (workspace_id, contact_id, step_number, delay_days, status, scheduled_for)
   SELECT c.workspace_id, c.id, 1, 0, 'scheduled', now()
   FROM contacts c JOIN workspaces w ON w.id=c.workspace_id
   WHERE w.slug='${slugB}' AND c.email='${email}';
7. [DB] Seed a scheduled scheduled_email for the WA contact:
   INSERT INTO scheduled_emails (workspace_id, contact_id, subject, body, scheduled_for, status, source)
   SELECT c.workspace_id, c.id, 'Hi', 'Body', now(), 'scheduled', 'segment'
   FROM contacts c JOIN workspaces w ON w.id=c.workspace_id
   WHERE w.slug='${slugA}' AND c.email='${email}';
8. [DB] Seed a scheduled scheduled_email for the WB contact:
   INSERT INTO scheduled_emails (workspace_id, contact_id, subject, body, scheduled_for, status, source)
   SELECT c.workspace_id, c.id, 'Hi', 'Body', now(), 'scheduled', 'segment'
   FROM contacts c JOIN workspaces w ON w.id=c.workspace_id
   WHERE w.slug='${slugB}' AND c.email='${email}';
9. [API] POST /api/inbound-email (public, no auth header) with JSON body:
   { "from": "${email}", "to": "${fwd}", "subject": "Re: Following up",
     "text": "${replyBody}", "message_id": "${msgId}" }
10. [Verify] The response is HTTP 200 with success:true, isAutoReply:false, and
    sequencesPaused greater than 0. (The response body does NOT contain a
    "classification" field, and matched:false is expected here because matching
    is lead-level only — the contact's sequences are still paused, which is what
    sequencesPaused > 0 confirms. classification is asserted from the DB below.)
11. [DB] Assert WA (the hinted workspace) was PAUSED:
    SELECT c.sequence_status,
      (SELECT count(*) FROM sequence_steps s WHERE s.contact_id=c.id AND s.status='canceled') AS canceled_steps,
      (SELECT count(*) FROM scheduled_emails se WHERE se.contact_id=c.id AND se.status='paused') AS paused_emails
    FROM contacts c JOIN workspaces w ON w.id=c.workspace_id
    WHERE w.slug='${slugA}' AND c.email='${email}';
12. [Verify] WA shows sequence_status = 'paused_replied', canceled_steps >= 1,
    and paused_emails >= 1.
13. [DB] Assert WB (no hint) is fully UNTOUCHED:
    SELECT c.sequence_status,
      (SELECT count(*) FROM sequence_steps s WHERE s.contact_id=c.id AND s.status='scheduled') AS scheduled_steps,
      (SELECT count(*) FROM scheduled_emails se WHERE se.contact_id=c.id AND se.status='scheduled') AS scheduled_emails
    FROM contacts c JOIN workspaces w ON w.id=c.workspace_id
    WHERE w.slug='${slugB}' AND c.email='${email}';
14. [Verify] WB shows sequence_status = 'active', scheduled_steps >= 1, and
    scheduled_emails >= 1 (nothing was paused or canceled in WB).
15. [DB] Assert the inbound email was attributed to WA only and classified human:
    SELECT w.slug, ie.classification
    FROM inbound_emails ie JOIN workspaces w ON w.id=ie.workspace_id
    WHERE ie.message_id='${msgId}';
16. [Verify] The inbound row's workspace slug is '${slugA}' and its
    classification is 'human_reply'.
17. [DB] Cleanup (run all; deletes only this run's two workspaces):
    DELETE FROM scheduled_emails WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug IN ('${slugA}','${slugB}'));
    DELETE FROM sequence_steps  WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug IN ('${slugA}','${slugB}'));
    DELETE FROM inbound_emails  WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug IN ('${slugA}','${slugB}'));
    DELETE FROM activity        WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug IN ('${slugA}','${slugB}'));
    DELETE FROM notifications   WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug IN ('${slugA}','${slugB}'));
    DELETE FROM contacts        WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug IN ('${slugA}','${slugB}'));
    DELETE FROM workspaces      WHERE slug IN ('${slugA}','${slugB}');
`,
  };
}

export const plans = [
  planAssignSchedulesAndSkips,
  planReplyPausesCorrectWorkspace,
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
