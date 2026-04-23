import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Supabase generated types can be strict about update payload shapes; use an
// untyped view of the client for mutations (matches pattern used by other admin hooks).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface UserRow {
  id: string;
  full_name: string | null;
  role: 'admin' | 'viewer';
  active: boolean;
  created_at: string;
  email?: string;
}

export function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      // profiles + auth.users 조인은 RLS 때문에 직접 불가 → profiles만 조회
      const { data, error } = await sb
        .from('profiles')
        .select('id, full_name, role, active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });
}

export interface InviteInput {
  email: string;
  full_name: string;
  role: 'admin' | 'viewer';
  password?: string;
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteInput) => {
      const { data, error } = await supabase.functions.invoke('invite-user', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useUpdateUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, changes,
    }: { id: string; changes: Partial<Pick<UserRow, 'role' | 'active' | 'full_name'>> }) => {
      const { error } = await sb.from('profiles').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
