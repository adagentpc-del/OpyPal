import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  db,
  templatesTable,
  templateSetsTable,
  sequenceTemplatesTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  A3_PREMIUM_CATEGORIES,
  A3_PREMIUM_SEQUENCE_NAME,
  A3_PREMIUM_STEPS,
} from "./a3-premium-template-content";

// ---------------------------------------------------------------------------
// A3 Visual (workspace_id = 1) premium template library seed.
//
// Seeds the exact premium copy supplied by the A3 team as editable DB records:
//   - 9 categories x 2 initial templates (18 templates, type "intro")
//   - 1 shared follow-up sequence ("A3 Premium Default Follow-Up Sequence")
//     with 7 steps at 3d / 7d / 14d / 1mo / 3mo / 6mo / 1yr
//
// Idempotent and additive: it only inserts records that do not already exist
// (matched by name within workspace 1), so later edits in the Templates and
// Sequences UI are never overwritten. It does NOT touch other workspaces, and
// it does NOT delete or modify A3's pre-existing templates.
//
// The shared sequence is assigned as the default for each premium initial
// template only when that template has no linked sequence yet (i.e. unless a
// category-specific override already exists).
// ---------------------------------------------------------------------------

const A3_WORKSPACE_ID = 1;

export interface A3PremiumSeedResult {
  templatesCreated: number;
  templatesLinked: number;
  setsCreated: number;
  stepsCreated: number;
}

export async function seedA3PremiumTemplatesIfNeeded(): Promise<A3PremiumSeedResult> {
  const result: A3PremiumSeedResult = {
    templatesCreated: 0,
    templatesLinked: 0,
    setsCreated: 0,
    stepsCreated: 0,
  };

  // --- 1. Initial templates (idempotent by name within workspace 1) ---------
  const existingTemplates = await db
    .select({ name: templatesTable.name })
    .from(templatesTable)
    .where(eq(templatesTable.workspaceId, A3_WORKSPACE_ID));
  const existingNames = new Set(existingTemplates.map((t) => t.name));

  const allPremiumNames: string[] = [];

  for (const cat of A3_PREMIUM_CATEGORIES) {
    for (const tpl of cat.templates) {
      allPremiumNames.push(tpl.name);
      if (existingNames.has(tpl.name)) continue;
      await db.insert(templatesTable).values({
        workspaceId: A3_WORKSPACE_ID,
        name: tpl.name,
        category: cat.category,
        type: "intro",
        subject: tpl.subject,
        body: tpl.body,
        description: `${cat.category} — premium initial outreach`,
        isActive: true,
      });
      result.templatesCreated++;
    }
  }

  // --- 2. Shared premium follow-up sequence (template set + steps) ----------
  const existingSet = await db
    .select({ id: templateSetsTable.id })
    .from(templateSetsTable)
    .where(
      and(
        eq(templateSetsTable.workspaceId, A3_WORKSPACE_ID),
        eq(templateSetsTable.name, A3_PREMIUM_SEQUENCE_NAME),
      ),
    );

  let setId: number;
  if (existingSet.length > 0) {
    setId = existingSet[0].id;
  } else {
    const [createdSet] = await db
      .insert(templateSetsTable)
      .values({
        workspaceId: A3_WORKSPACE_ID,
        name: A3_PREMIUM_SEQUENCE_NAME,
        description:
          "Shared premium default follow-up sequence — 3d / 7d / 14d / 1mo / 3mo / 6mo / 1yr",
        category: "nurture",
        isActive: true,
      })
      .returning();
    setId = createdSet.id;
    result.setsCreated++;
  }

  // Insert steps only if the set has none yet (avoids duplicating on re-run).
  const existingSteps = await db
    .select({ id: sequenceTemplatesTable.id })
    .from(sequenceTemplatesTable)
    .where(
      and(
        eq(sequenceTemplatesTable.workspaceId, A3_WORKSPACE_ID),
        eq(sequenceTemplatesTable.templateSetId, setId),
      ),
    );

  if (existingSteps.length === 0) {
    for (const step of A3_PREMIUM_STEPS) {
      await db.insert(sequenceTemplatesTable).values({
        workspaceId: A3_WORKSPACE_ID,
        templateSetId: setId,
        stepNumber: step.stepNumber,
        name: step.stepLabel,
        subject: step.subject,
        body: step.body,
        delayDays: step.delayDays,
        delayValue: step.delayValue,
        delayUnit: step.delayUnit,
        stepLabel: step.stepLabel,
        channel: "email",
        isActive: true,
      });
      result.stepsCreated++;
    }
  }

  // --- 3. Assign shared sequence as default for premium initial templates ---
  // Only link templates that have no linked sequence yet (no override).
  if (allPremiumNames.length > 0) {
    const linkTargets = await db
      .select({ id: templatesTable.id })
      .from(templatesTable)
      .where(
        and(
          eq(templatesTable.workspaceId, A3_WORKSPACE_ID),
          inArray(templatesTable.name, allPremiumNames),
          isNull(templatesTable.linkedTemplateSetId),
        ),
      );

    if (linkTargets.length > 0) {
      await db
        .update(templatesTable)
        .set({
          linkedTemplateSetId: setId,
          linkedSequenceId: setId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(templatesTable.workspaceId, A3_WORKSPACE_ID),
            inArray(
              templatesTable.id,
              linkTargets.map((t) => t.id),
            ),
          ),
        );
      result.templatesLinked = linkTargets.length;
    }
  }

  if (
    result.templatesCreated > 0 ||
    result.setsCreated > 0 ||
    result.stepsCreated > 0 ||
    result.templatesLinked > 0
  ) {
    logger.info({ ...result }, "Seeded A3 premium template library (workspace 1)");
  }

  return result;
}
