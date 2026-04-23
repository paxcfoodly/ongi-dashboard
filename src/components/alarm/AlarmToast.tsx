import { useCallback } from 'react';
import { useAlarmRealtime } from '../../hooks/useAlarms';
import { toast } from '../../lib/toast';
import type { AlarmRow } from '../../hooks/useAlarms';

export function AlarmToast() {
  const onNew = useCallback((a: AlarmRow) => {
    const title = a.source === 'manual' ? '알람 (수동)' : '알람';
    const body = a.message;
    if (a.severity === 'danger')       toast.error(`${title}: ${body}`);
    else if (a.severity === 'warning') toast.warn(`${title}: ${body}`);
    else                               toast.info(`${title}: ${body}`);
  }, []);

  useAlarmRealtime(onNew);
  return null;
}
