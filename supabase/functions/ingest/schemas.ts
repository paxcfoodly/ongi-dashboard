import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const VisionMetricsSchema = z.object({
  bucket_at: z.string().datetime({ offset: true }),
  metrics: z.object({
    total_inspected: z.number().int().min(0),
    good_count: z.number().int().min(0),
    defect_count: z.number().int().min(0),
    unknown_count: z.number().int().min(0),
    inspection_time_seconds: z.number().min(0),
  }).refine(
    (m) => m.total_inspected === m.good_count + m.defect_count + m.unknown_count,
    { message: 'total_inspected must equal good + defect + unknown' }
  ),
});

export const EquipmentMetricsSchema = z.object({
  bucket_at: z.string().datetime({ offset: true }),
  metrics: z.object({
    runtime_seconds: z.number().int().min(0).max(60),
    output_count: z.number().int().min(0),
    extras: z.record(z.unknown()).optional(),
  }),
});

export type VisionMetrics = z.infer<typeof VisionMetricsSchema>;
export type EquipmentMetrics = z.infer<typeof EquipmentMetricsSchema>;
