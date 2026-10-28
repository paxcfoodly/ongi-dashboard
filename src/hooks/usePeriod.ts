import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parsePeriodParams, type Period } from '../lib/services/period';

// URL 쿼리(from·to)를 기간 상태로 쓴다. 쿼리 없음 = 오늘 모드(period null)
export function usePeriod(): {
  period: Period | null;
  error: string | null;
  setPeriod: (p: Period | null) => void;
} {
  const [params, setParams] = useSearchParams();
  const { period, error } = useMemo(() => parsePeriodParams(params), [params]);

  const setPeriod = useCallback(
    (p: Period | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (p) {
          next.set('from', p.from);
          next.set('to', p.to);
        } else {
          next.delete('from');
          next.delete('to');
        }
        return next;
      });
    },
    [setParams],
  );

  return { period, error, setPeriod };
}
