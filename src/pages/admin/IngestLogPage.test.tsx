import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IngestLogPage } from './IngestLogPage';

vi.mock('../../lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BODY = '{"bucket_at":"2026-10-26T10:00:00+09:00","metrics":{"total_inspected":100,"good_count":95}}';
const ROWS = vi.hoisted(() => [
  {
    id: 2, device_code: 'vision_01', received_at: '2026-10-26T01:00:00Z', status: 'success',
    error_message: null, content_type: 'application/json', raw_payload: null,
    raw_body: '{"bucket_at":"2026-10-26T10:00:00+09:00","metrics":{"total_inspected":100,"good_count":95}}',
  },
  {
    id: 1, device_code: 'vision_01', received_at: '2026-10-26T00:00:00Z', status: 'invalid_key',
    error_message: 'bad key', content_type: null, raw_payload: null, raw_body: null,
  },
]);
const useIngestLogs = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useIngestLogs', () => ({
  useIngestLogs,
  fetchIngestLogsForExport: vi.fn(),
  PAGE_SIZE: 100,
}));
const DEVICES = vi.hoisted(() => [{ code: 'vision_01', name: '비전 1' }]);
vi.mock('../../hooks/useAdminDevices', () => ({
  useDevices: () => ({ data: DEVICES }),
}));

describe('IngestLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIngestLogs.mockReturnValue({ data: { rows: ROWS, total: 2 }, isLoading: false });
  });

  it('전송 규격 안내와 ingest 경로를 표시한다', () => {
    render(<IngestLogPage />);
    expect(screen.getByText('전송 규격 안내')).toBeInTheDocument();
    expect(screen.getAllByText(/\/functions\/v1\/ingest/).length).toBeGreaterThan(0);
  });

  it('상태 Pill 2종과 원본 앞부분, 총 건수를 표시한다', () => {
    render(<IngestLogPage />);
    expect(screen.getAllByText('success').length).toBeGreaterThan(0);
    expect(screen.getAllByText('invalid_key').length).toBeGreaterThan(0);
    expect(screen.getByText(BODY.slice(0, 40), { exact: false })).toBeInTheDocument();
    expect(screen.getByText('총 2건')).toBeInTheDocument();
    expect(screen.getByText('2026-10-26 10:00:00')).toBeInTheDocument(); // KST 변환
  });

  it('행 클릭 시 모달에 원문과 정렬된 JSON을 표시한다', () => {
    render(<IngestLogPage />);
    fireEvent.click(screen.getByText('2026-10-26 10:00:00'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText(/"total_inspected": 100/)).toBeInTheDocument();
  });

  it('raw_body가 null이면 미저장 문구를 표시한다', () => {
    render(<IngestLogPage />);
    fireEvent.click(screen.getByText('2026-10-26 09:00:00'));
    expect(screen.getAllByText(/원본 미저장/).length).toBeGreaterThan(0);
  });

  it('상태 필터 변경 시 status가 포함된 인자로 훅을 호출한다', () => {
    render(<IngestLogPage />);
    fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'duplicate' } });
    const calls = useIngestLogs.mock.calls;
    const last = calls[calls.length - 1];
    expect(last[0]).toMatchObject({ status: 'duplicate', page: 0 });
  });
});
