import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface PdfReportResponse {
  ok: boolean;
  url?: string;
  file?: string;
  error?: string;
}

export function useGeneratePdf() {
  return useMutation<PdfReportResponse, Error, { type: 'lot_report'; id: string }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: input,
      });
      if (error) throw error;
      return data as PdfReportResponse;
    },
  });
}
