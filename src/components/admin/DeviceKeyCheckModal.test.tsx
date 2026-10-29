import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeviceKeyCheckModal } from './DeviceKeyCheckModal';
import type { DeviceRow } from '../../hooks/useAdminDevices';

// vi.fn 이 거부된 Promise를 추적하면 테스트가 실패로 잡히므로 호출 기록·응답은 직접 관리
const mocks = vi.hoisted(() => ({
  calls: [] as unknown[],
  respond: (() => Promise.resolve({})) as () => Promise<unknown>,
}));
vi.mock('../../hooks/useAdminDevices', () => ({
  useCheckDeviceKey: () => ({
    mutateAsync: (arg: unknown) => { mocks.calls.push(arg); return mocks.respond(); },
    isPending: false,
  }),
}));

const device: DeviceRow = {
  id: 'dev-1', code: 'packaging_01', name: '삼면포장기', type: 'equipment', role: 'primary_output',
  process_order: 1, active: true, last_seen_at: null, api_key_hash: 'x', api_key_prefix: 'ab12',
};

const result = {
  key_registered: true, match: false, match_after_cleanup: false, length: 48, clean_length: 48,
  has_whitespace: false, has_bearer: false, has_quotes: false, prefix: 'ff00', registered_prefix: 'ab12',
};

beforeEach(() => { mocks.calls = []; });

describe('DeviceKeyCheckModal', () => {
  it('붙여 넣은 키를 그대로 서버 확인에 보내고 결과를 보여 준다', async () => {
    mocks.respond = () => Promise.resolve(result);
    render(<DeviceKeyCheckModal device={device} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('확인할 API 키'), { target: { value: ' ff00key \n' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    // 공백까지 그대로 보내야 서버가 '공백 섞임'을 짚어 줄 수 있다
    expect(mocks.calls).toEqual([{ id: 'dev-1', key: ' ff00key \n' }]);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('등록된 키와 다릅니다.');
    expect(status).toHaveTextContent("'ff00'");
  });

  it('확인 실패는 오류로 보여 준다', async () => {
    mocks.respond = () => Promise.reject(new Error('only admin can check device api key'));
    render(<DeviceKeyCheckModal device={device} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('확인할 API 키'), { target: { value: 'k' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('only admin'));
  });

  it('장비가 없으면 열리지 않는다', () => {
    render(<DeviceKeyCheckModal device={null} onClose={() => {}} />);
    expect(screen.queryByLabelText('확인할 API 키')).not.toBeInTheDocument();
  });
});
