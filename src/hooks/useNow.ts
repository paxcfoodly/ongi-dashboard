import { useEffect, useState } from 'react';

// 경과 시간 표시용 현재 시각 (이 훅을 쓰는 컴포넌트만 다시 그린다)
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
