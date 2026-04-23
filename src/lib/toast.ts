import { toast as sonner } from 'sonner';

export const toast = {
  success: (message: string) =>
    sonner.success(message, { duration: 3000 }),
  error: (message: string) =>
    sonner.error(message, { duration: 5000 }),
  info: (message: string) =>
    sonner.message(message, { duration: 3000 }),
  warn: (message: string) =>
    sonner.warning(message, { duration: 4000 }),
};
