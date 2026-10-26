import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { IngestLogPage } from './IngestLogPage';
import { fetchIngestLogsForExport } from '../../hooks/useIngestLogs';
import { toast } from '../../lib/toast';

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

  // Value: protects=평가 대응용 수신 원본 CSV 내보내기(필터 전달·bucket_at 열·KST 날짜 파일명·10,000건 상한 경고); fails_when=다운로드가 안 만들어지거나 파일명이 UTC 날짜가 되거나 truncated 경고가 빠질 때; why_new=내보내기 버튼 경로를 다루는 테스트가 없었음; seam=none; no_claim=fetchIngestLogsForExport 의 실제 쿼리·상한 동작은 다루지 않음
  it('CSV 다운로드는 필터를 넘겨 내보내고 KST 날짜 파일명으로 저장하며 상한 초과 시 경고한다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T16:00:00Z')); // KST 2026-10-27 01:00
    vi.mocked(fetchIngestLogsForExport).mockResolvedValue({ rows: ROWS, truncated: true } as never);
    let blob: Blob | undefined;
    const createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:mock'; });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    let download = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    try {
      render(<IngestLogPage />);
      fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'success' } });
      fireEvent.click(screen.getByRole('button', { name: 'CSV 다운로드' }));
      await waitFor(() => expect(click).toHaveBeenCalled());
      expect(fetchIngestLogsForExport).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
      expect(download).toBe('ingest-logs-20261027.csv');
      const text = await blob!.text();
      expect(text).toContain('bucket_at');
      expect(text).toContain('2026-10-26T10:00:00+09:00');
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('10,000건'));
    } finally {
      click.mockRestore();
      vi.useRealTimers();
    }
  });

  // Value: protects=수신 로그 페이지 이동(다음/이전이 page±1로 훅을 다시 호출, 경계에서 버튼 비활성); fails_when=페이지 상태가 훅 인자로 전달되지 않거나 경계 비활성 조건이 깨질 때; why_new=페이지네이션 경로 테스트가 없었음; seam=none; no_claim=서버 range 계산은 다루지 않음
  it('다음/이전 버튼은 page+1/page-1 로 훅을 호출하고 경계에서 비활성화된다', () => {
    useIngestLogs.mockReturnValue({ data: { rows: ROWS, total: 250 }, isLoading: false });
    render(<IngestLogPage />);
    const lastPage = () => useIngestLogs.mock.calls[useIngestLogs.mock.calls.length - 1][0].page;
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(lastPage()).toBe(1);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(lastPage()).toBe(2);
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(lastPage()).toBe(1);
  });
});
