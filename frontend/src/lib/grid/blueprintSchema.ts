// ─── Blueprint JSON Schema (Zod) ────────────────────────────────
// Validates blueprint JSON data before loading.
// Invalid blueprints are logged and skipped (graceful degradation).

import { z } from 'zod'

// ─── Sub-schemas ────────────────────────────────────────────────

const cellTypeSchema = z.enum(['empty', 'wall', 'door', 'furniture', 'decoration', 'interaction'])

const interactionTypeSchema = z.enum(['work', 'coffee', 'rest', 'sleep'])

const directionSchema = z.enum(['north', 'south', 'east', 'west'])

const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])

const spanSchema = z.object({
  w: z.number().int().positive(),
  d: z.number().int().positive(),
})

const coordSchema = z.object({
  x: z.number().int().nonnegative(),
  z: z.number().int().nonnegative(),
})

// ─── Placement Schema ───────────────────────────────────────────

const blueprintPlacementSchema = z.object({
  propId: z.string().min(1),
  x: z.number().int().nonnegative(),
  z: z.number().int().nonnegative(),
  type: cellTypeSchema.optional(),
  interactionType: interactionTypeSchema.optional(),
  rotation: rotationSchema.optional(),
  span: spanSchema.optional(),
})

// ─── Door Position Schema ───────────────────────────────────────

const doorPositionSchema = z.object({
  x: z.number().int().nonnegative(),
  z: z.number().int().nonnegative(),
  facing: directionSchema,
})

// ─── Interaction Points Schema ──────────────────────────────────

const interactionPointsSchema = z.object({
  work: z.array(coordSchema),
  coffee: z.array(coordSchema),
  sleep: z.array(coordSchema),
})

// ─── Full Blueprint Schema ──────────────────────────────────────

export const blueprintJSONSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gridWidth: z.number().int().positive(),
  gridDepth: z.number().int().positive(),
  cellSize: z.number().positive(),
  placements: z.array(blueprintPlacementSchema),
  doorPositions: z.array(doorPositionSchema),
  /** @deprecated Use doorPositions instead */
  doors: z.array(z.object({ x: z.number(), z: z.number() })).optional(),
  walkableCenter: coordSchema,
  interactionPoints: interactionPointsSchema,
})

// ─── Inferred Type ──────────────────────────────────────────────

export type BlueprintJSON = z.infer<typeof blueprintJSONSchema>
