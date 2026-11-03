import { createContext, useContext, useEffect, useState } from 'react';

export interface KpiFoldValue {
  opened: Set<string>;
  allOpen: boolean;
  register: (label: string) => () => void;
  toggle: (label: string) => void;
  setAll: (open: boolean) => void;
}

export const KpiFoldContext = createContext<KpiFoldValue | null>(null);

// 묶음 안의 카드는 묶음 상태를, 묶음 밖(기간 조회)의 카드는 자기 상태를 쓴다
export function useKpiFoldItem(label: string) {
  const fold = useContext(KpiFoldContext);
  const [localOpen, setLocalOpen] = useState(false);
  const register = fold?.register;

  useEffect(() => register?.(label), [register, label]);

  if (fold) return { open: fold.opened.has(label), toggle: () => fold.toggle(label) };
  return { open: localOpen, toggle: () => setLocalOpen((v) => !v) };
}
