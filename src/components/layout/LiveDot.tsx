import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function LiveDot() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function ping() {
      const { error } = await supabase.from('devices').select('id').limit(1);
      if (mounted) setOk(!error);
    }
    ping();
    const id = setInterval(ping, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${ok ? 'bg-good' : 'bg-danger'} animate-pulse`}
      />
      <span className="text-text-dim">{ok ? '연결됨' : '연결 오류'}</span>
    </span>
  );
}
