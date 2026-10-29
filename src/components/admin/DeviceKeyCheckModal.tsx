import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FormField, TextArea } from '../common/FormField';
import { useCheckDeviceKey } from '../../hooks/useAdminDevices';
import type { DeviceRow } from '../../hooks/useAdminDevices';
import { describeKeyCheck, type KeyCheckDescription } from '../../lib/services/deviceKeyCheck';

const TONE: Record<KeyCheckDescription['verdict'], string> = {
  match: 'border-good text-good-dark',
  match_after_cleanup: 'border-warn text-warn-dark',
  mismatch: 'border-danger text-danger-dark',
  unregistered: 'border-warn text-warn-dark',
};

// 업체가 쓰는 키를 붙여 넣어 등록된 키와 대조 — 키는 화면 상태에만 두고 저장하지 않음
export function DeviceKeyCheckModal({ device, onClose }: { device: DeviceRow | null; onClose: () => void }) {
  const checkMut = useCheckDeviceKey();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<KeyCheckDescription | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 다른 장비로 열 때마다 입력·결과 초기화
  useEffect(() => {
    setKey('');
    setResult(null);
    setError(null);
  }, [device?.id]);

  async function onCheck() {
    if (!device || !key) return;
    setError(null);
    try {
      const r = await checkMut.mutateAsync({ id: device.id, key });
      setResult(describeKeyCheck(r));
    } catch (e: unknown) {
      setResult(null);
      setError(`확인 실패: ${(e as Error).message}`);
    }
  }

  return (
    <Modal
      open={!!device}
      onClose={onClose}
      title={`API 키 확인 — ${device?.code ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button onClick={onCheck} disabled={!key || checkMut.isPending}>
            {checkMut.isPending ? '확인 중...' : '확인'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="업체가 X-Api-Key에 넣은 키">
          <TextArea
            aria-label="확인할 API 키"
            className="font-mono"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setResult(null);
            }}
            placeholder="키를 그대로 붙여 넣으세요"
          />
        </FormField>
        {result && (
          <div role="status" className={`border rounded p-3 text-xs space-y-1 ${TONE[result.verdict]}`}>
            <p className="font-semibold">{result.title}</p>
            {result.details.map((d) => (
              <p key={d} className="text-text">{d}</p>
            ))}
          </div>
        )}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <p className="text-[11px] text-text-dim">입력한 키는 등록된 키와 대조만 하고 어디에도 저장하지 않습니다.</p>
      </div>
    </Modal>
  );
}
