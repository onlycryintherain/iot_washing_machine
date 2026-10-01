import { z } from 'zod';
export const reserveSchema=z.object({washerId:z.string().min(1),nickname:z.string().trim().max(24).optional()});
export const deviceEventSchema=z.object({event:z.enum(['RESERVE','START','ACTIVITY','NO_ACTIVITY','RESUME','FINISH','DOOR_OPEN','PICKUP','RESET']),timestamp:z.string().datetime().optional(),sensors:z.object({vibration:z.number().int().optional(),current:z.number().nonnegative().optional(),doorOpen:z.boolean().optional()}).optional()});
export const subscriptionSchema=z.object({endpoint:z.string().url(),keys:z.object({p256dh:z.string(),auth:z.string()})});
export const onboardingSchema=z.object({nickname:z.string().trim().min(1).max(60),studentId:z.string().trim().min(1).max(32)});
