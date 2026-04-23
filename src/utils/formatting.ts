export const fmt = {
  int: (n: number | null | undefined) =>
    n == null ? '-' : new Intl.NumberFormat('ko-KR').format(Math.round(n)),
  pct: (n: number | null | undefined, digits = 1) =>
    n == null ? '-' : `${n.toFixed(digits)}%`,
  sec: (n: number | null | undefined, digits = 2) =>
    n == null ? '-' : `${n.toFixed(digits)} s`,
  ea: (n: number | null | undefined) =>
    n == null ? '-' : `${fmt.int(n)} ea`,
  eaPerHr: (n: number | null | undefined) =>
    n == null ? '-' : `${fmt.int(n)} ea/hr`,
};
