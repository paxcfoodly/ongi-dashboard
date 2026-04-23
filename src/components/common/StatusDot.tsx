type Health = 'running' | 'warn' | 'offline';

const classes: Record<Health, string> = {
  running: 'bg-good',
  warn:    'bg-warn',
  offline: 'bg-danger',
};

export function StatusDot({ health }: { health: Health }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${classes[health]} ${
        health === 'running' ? 'animate-pulse' : ''
      }`}
    />
  );
}
