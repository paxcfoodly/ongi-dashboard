import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const from = (loc.state as { from?: string })?.from ?? '/kpi';
    nav(from, { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form
        onSubmit={onSubmit}
        className="bg-surface border border-border rounded-lg p-8 w-full max-w-sm shadow-sm"
      >
        <h1 className="text-xl font-bold text-primary mb-1">온기 대시보드</h1>
        <p className="text-text-dim text-xs mb-6">등록된 계정으로 로그인하세요.</p>

        <label htmlFor="email" className="block text-xs text-text-dim mb-1">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-border rounded px-3 py-2 mb-4 focus:outline-none focus:border-primary"
        />

        <label htmlFor="pw" className="block text-xs text-text-dim mb-1">
          비밀번호
        </label>
        <input
          id="pw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          className="w-full border border-border rounded px-3 py-2 mb-4 focus:outline-none focus:border-primary"
        />

        {err && <div className="text-danger text-xs mb-3">{err}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded text-white font-medium bg-primary hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
