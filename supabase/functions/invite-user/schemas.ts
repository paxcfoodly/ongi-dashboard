import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const InviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(100),
  role: z.enum(['admin', 'viewer']).default('viewer'),
  password: z.string().min(8).max(128).optional(),
});

export type InviteUser = z.infer<typeof InviteUserSchema>;
