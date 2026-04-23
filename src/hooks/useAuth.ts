import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'admin' | 'viewer' | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data: role = null } = useQuery<Role>({
    queryKey: ['profile', session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role ?? null) as Role;
    },
  });

  return { session, role, loading, user: session?.user ?? null };
}
