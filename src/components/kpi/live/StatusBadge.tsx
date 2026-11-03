import type { LiveState, LiveStateKey } from '../../../lib/services/liveStatus';

const tones: Record<LiveStateKey, string> = {
  run: 'bg-good-light text-good-dark',
  idle: 'bg-surface2 text-text-dim',
  delay: 'bg-warn-light text-warn-dark',
  off: 'bg-danger-light text-danger-dark',
};

// 색만으로 구분되지 않도록 모양이 다른 아이콘을 함께 쓴다
const icons: Record<LiveStateKey, string> = {
  run: 'M4 2.5v11l9-5.5z',
  idle: 'M4 3h3v10H4zM9 3h3v10H9z',
  delay: 'M8 1.5 15 14H1z',
  off: 'M3.4 2 8 6.6 12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z',
};

export function StatusBadge({ state }: { state: LiveState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[14px] font-bold whitespace-nowrap ${tones[state.key]}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="w-3 h-3 flex-none">
        <path d={icons[state.key]} fill="currentColor" />
      </svg>
      {state.label}
    </span>
  );
}
