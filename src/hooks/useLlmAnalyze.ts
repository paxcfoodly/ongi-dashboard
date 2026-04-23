import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface LlmResponse {
  ok: boolean;
  text: string;
  model: string;
}

export function useCostImprovement() {
  return useMutation<LlmResponse, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('llm-analyze', {
        body: { type: 'cost_improvement' },
      });
      if (error) throw error;
      return data as LlmResponse;
    },
  });
}

export function useClaimResponse() {
  return useMutation<LlmResponse, Error, { claim_id: string }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('llm-analyze', {
        body: { type: 'claim_response', claim_id: input.claim_id },
      });
      if (error) throw error;
      return data as LlmResponse;
    },
  });
}
