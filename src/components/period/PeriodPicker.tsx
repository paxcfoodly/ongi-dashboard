import { useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { usePeriod } from '../../hooks/usePeriod';
import {
  PERIOD_PRESETS,
  kstToday,
  periodDays,
  presetPeriod,
  validatePeriod,
} from '../../lib/services/period';

const inputCls = 'bg-surface border border-border rounded px-2 py-1 text-xs';

export function PeriodPicker() {
  const { period, error, setPeriod } = usePeriod();
  const today = kstToday();
  const [from, setFrom] = useState(period?.from ?? today);
  const [to, setTo] = useState(period?.to ?? today);
  const [formError, setFormError] = useState<string | null>(null);

  // URL 기간이 바뀌면 입력칸도 맞춘다 (기간 모드 = 현재 기간, 오늘 모드 = 오늘)
  useEffect(() => {
    setFrom(period?.from ?? kstToday());
    setTo(period?.to ?? kstToday());
    setFormError(null);
  }, [period?.from, period?.to]);

  // 눌림 표시: 쿼리 없음 = 오늘, 아니면 같은 기간의 프리셋(없으면 직접 입력 범위)
  const pressedKey = period
    ? PERIOD_PRESETS.find((p) => {
        if (p.key === 'today') return false;
        const pp = presetPeriod(p.key);
        return pp.from === period.from && pp.to === period.to;
      })?.key ?? null
    : 'today';

  function submit() {
    const next = { from, to };
    const msg = validatePeriod(next);
    if (msg) {
      setFormError(msg);
      return;
    }
    setFormError(null);
    setPeriod(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {PERIOD_PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={pressedKey === p.key ? 'primary' : 'secondary'}
            aria-pressed={pressedKey === p.key}
            onClick={() => setPeriod(p.key === 'today' ? null : presetPeriod(p.key))}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-1 text-xs text-text-dim">
          <label htmlFor="period-from">시작일</label>
          <input id="period-from" type="date" className={inputCls} value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          <label htmlFor="period-to">종료일</label>
          <input id="period-to" type="date" className={inputCls} value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          <Button variant="secondary" onClick={submit}>조회</Button>
        </div>
      </div>
      {formError && <p role="alert" className="text-xs text-danger">{formError}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {period && (
        <p className="text-xs text-text-muted">
          {`조회 기간 ${period.from} ~ ${period.to} (${periodDays(period)}일) · 실시간 아님`}
        </p>
      )}
    </div>
  );
}
