import { useState } from 'react';
import { Button } from '../common/Button';
import { downloadCsv } from '../../utils/csv';
import { periodDays, type Period } from '../../lib/services/period';
import { RAW_EXPORT_MAX_DAYS, rawEquipmentCsv, rawVisionCsv } from '../../lib/services/exportCsv';
import { fetchRawEquipment, fetchRawVision } from '../../hooks/useRawExport';

type Kind = 'equipment' | 'vision';

// 기간 조회 시 분 단위 원데이터(설비·AI 비전)를 CSV로 내려받음 — 31일 이하만
export function RawDataExport({ period }: { period: Period }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tooLong = periodDays(period) > RAW_EXPORT_MAX_DAYS;

  async function run(kind: Kind) {
    setBusy(kind);
    setLoaded(0);
    setError(null);
    try {
      const suffix = `${period.from}_${period.to}.csv`;
      if (kind === 'equipment') {
        const rows = await fetchRawEquipment(period, setLoaded);
        downloadCsv(rawEquipmentCsv(rows), `설비_분단위_${suffix}`);
      } else {
        const rows = await fetchRawVision(period, setLoaded);
        downloadCsv(rawVisionCsv(rows), `AI비전_분단위_${suffix}`);
      }
    } catch (e: unknown) {
      setError(`내려받기 실패: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">원데이터 내려받기 (분 단위)</h3>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={tooLong || busy !== null} onClick={() => run('equipment')}>
            설비 CSV
          </Button>
          <Button variant="secondary" disabled={tooLong || busy !== null} onClick={() => run('vision')}>
            AI 비전 CSV
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-text-dim">
        {tooLong
          ? `원데이터는 ${RAW_EXPORT_MAX_DAYS}일 이하 기간만 내려받을 수 있습니다. 기간을 나눠서 받아 주세요.`
          : busy
            ? `불러오는 중... ${loaded.toLocaleString('ko-KR')}건`
            : '선택한 기간의 1분 단위 수신 데이터를 엑셀에서 열 수 있는 CSV로 저장합니다.'}
      </p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </section>
  );
}
