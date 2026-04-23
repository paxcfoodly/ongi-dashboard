import { Modal } from './Modal';
import { Button } from './Button';

export function ResponseModal({
  open, onClose, title, text, loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      {loading ? (
        <div className="text-text-dim text-sm">응답 생성 중… (10~30초 소요)</div>
      ) : (
        <pre className="whitespace-pre-wrap text-xs text-text font-sans leading-relaxed max-h-[60vh] overflow-auto">
          {text}
        </pre>
      )}
    </Modal>
  );
}
