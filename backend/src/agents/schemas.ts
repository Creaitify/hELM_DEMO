import { z } from 'zod';

/**
 * What each specialist's answer must actually be, checked before it is used.
 *
 * The prompts already describe the shape they want. Describing it is not the
 * same as getting it: an answer that renames `findings` to `results`, or nests
 * the array one level deeper, parses perfectly well as JSON and then arrives
 * downstream as a run of `String(row.x ?? default)` defaults — a finding
 * titled "Finding" with an empty observation, filed under the model's name.
 * Validating here means the only two outcomes are the answer the shape asked
 * for or an honest fallback, never a hollow record wearing the model's byline.
 *
 * The rule for strictness: anything the reader sees as a claim is required,
 * and anything the orchestrator already derives in code is optional. A model
 * cannot be trusted to supply a figure, but it must be held to supplying the
 * prose it was asked for.
 */

/** Minor units arrive as a string, a number, or nothing. Only the first is usable. */
const minorUnits = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) =>
    value === null || value === undefined || value === '' ? undefined : String(value),
  );

const listOfText = z
  .array(z.unknown())
  .optional()
  .transform((rows) => (rows ?? []).map((row) => String(row)).filter(Boolean));

export const FINDING_RESULT_SCHEMA = z.object({
  findings: z
    .array(
      z.object({
        // The two fields a person actually reads. An empty one is a defect,
        // not a default.
        title: z.string().min(1),
        observation: z.string().min(1),
        kind: z.enum(['observed', 'calculated', 'inferred']).catch('observed'),
        severity: z.enum(['decision', 'watch', 'stable']).catch('watch'),
        confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
        confidenceNote: z.string().optional().default(''),
        affectedCampaignIds: listOfText,
        recommendedNextStep: z.string().optional().default(''),
      }),
    )
    .min(1),
  recommendations: z
    .array(
      z.object({
        findingIndex: z.union([z.number(), z.string()]).optional(),
        action: z.string().min(1),
        rationale: z.string().optional().default(''),
        assumptions: listOfText,
        risks: listOfText,
        expectedDirection: z
          .enum(['increase', 'decrease', 'protect', 'investigate'])
          .catch('investigate'),
        expectedRange: z.string().optional().default(''),
        capMinorUnits: minorUnits,
        horizon: z.string().optional().default('14 days'),
        stopConditions: listOfText,
        effort: z.enum(['low', 'medium', 'high']).catch('medium'),
        urgency: z.enum(['today', 'this_week', 'this_month']).catch('this_week'),
      }),
    )
    .optional()
    .default([]),
});

export const DIRECTION_RESULT_SCHEMA = z.object({
  directions: z
    .array(
      z.object({
        title: z.string().min(1),
        // The line that gets set large in the still. A blank one is the whole
        // deliverable missing.
        headline: z.string().min(1),
        subline: z.string().optional().default(''),
        rationale: z.string().optional().default(''),
        direction: z
          .enum(['product-proof', 'field-use', 'typographic', 'evidence'])
          .catch('product-proof'),
      }),
    )
    .min(1),
});

/**
 * The review verdict.
 *
 * `passed` is a strict boolean rather than anything truthy: a reviewer
 * answering the string "false" is refusing the work, and coercing that to
 * `true` turns every such refusal into a release.
 */
export const VERDICT_SCHEMA = z.object({
  grounding: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  passed: z.boolean(),
  note: z.string().optional().default(''),
});

export type FindingResult = z.infer<typeof FINDING_RESULT_SCHEMA>;
export type DirectionResult = z.infer<typeof DIRECTION_RESULT_SCHEMA>;
export type Verdict = z.infer<typeof VERDICT_SCHEMA>;
