import { useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { KpiFoldContext } from '../../hooks/useKpiFoldItem';

// 성과지표 카드들의 산출식 펼침 상태를 한곳에서 관리한다 (자동 갱신이 되어도 유지)
export function KpiFoldProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const known = useRef<Set<string>>(new Set());

  const register = useCallback((label: string) => {
    known.current.add(label);
    return () => {
      known.current.delete(label);
    };
  }, []);

  const toggle = useCallback((label: string) => {
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(label)) next.add(label);
      return next;
    });
  }, []);

  const setAll = useCallback((open: boolean) => {
    setOpened(open ? new Set(known.current) : new Set());
  }, []);

  const value = useMemo(
    // 펼침 상태가 바뀔 때만 다시 계산되며, 그 시점에는 카드 등록이 끝나 있다
    () => ({ opened, allOpen: opened.size > 0 && opened.size === known.current.size, register, toggle, setAll }),
    [opened, register, toggle, setAll],
  );

  return <KpiFoldContext.Provider value={value}>{children}</KpiFoldContext.Provider>;
}

export function KpiFoldAllButton() {
  const fold = useContext(KpiFoldContext);
  if (!fold) return null;
  return (
    <button
      type="button"
      onClick={() => fold.setAll(!fold.allOpen)}
      className="text-[12px] text-text-dim hover:text-text"
    >
      {fold.allOpen ? '산출식 모두 접기' : '산출식 모두 펼치기'}
    </button>
  );
}
