import { useEffect, useState } from 'react';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const p = (n: number) => String(n).padStart(2, '0');

function format(d: Date) {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} (${
    DAYS[d.getDay()]
  }) ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function Clock() {
  const [now, setNow] = useState(() => format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-text-dim">{now}</span>;
}
