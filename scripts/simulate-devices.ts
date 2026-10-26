// 장비 시뮬레이터: 실제 장비와 동일한 경로(POST /functions/v1/ingest)로 가짜 분 단위 데이터를 전송한다.
// 실행: node --env-file=.env.simulator scripts/simulate-devices.ts [--live | --backfill <시간>] [--offline <코드>]...
// 외부 의존성·다른 로컬 .ts import 없이 Node 단독 실행 가능해야 하므로 erasable TS 문법만 사용한다.
import { pathToFileURL } from 'node:url';

export type DeviceSpec = { code: string; kind: 'vision' | 'equipment'; ratio: number };

// seed 장비 코드와 동일 (supabase/migrations/20260424000009_seed_baseline.sql)
export const DEVICES: DeviceSpec[] = [
  { code: 'packaging_01', kind: 'equipment', ratio: 1.0 },
  { code: 'vision_01', kind: 'vision', ratio: 1.0 },
  { code: 'caser_01', kind: 'equipment', ratio: 0.99 },
  { code: 'taper_01', kind: 'equipment', ratio: 0.985 },
  { code: 'wrapper_01', kind: 'equipment', ratio: 0.98 },
  { code: 'conveyor_01', kind: 'equipment', ratio: 0.98 },
];

export type SendResult = 'ok' | 'duplicate' | 'error';
export type Args = { mode: 'live' | 'backfill'; hours: number; offline: string[] };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 분 단위로 내린 KST ISO 문자열 (YYYY-MM-DDTHH:mm:00+09:00)
export function toKstIso(d: Date): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return `${kst.toISOString().slice(0, 16)}:00+09:00`;
}

// [min, max] 구간 정수 (rand 0~0.999.. 에서 경계 초과 없음)
function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.min(Math.floor(rand() * (max - min + 1)), max - min);
}

// 한 분 버킷에 대한 6개 장비의 전송 본문을 만든다. 난수는 주입받는다.
export function buildMinute(bucket: Date, rand: () => number): Array<{ code: string; body: object }> {
  const bucketAt = toKstIso(bucket);
  const packagingOutput = randInt(rand, 28, 32);

  return DEVICES.map((dev) => {
    if (dev.kind === 'vision') {
      const total = packagingOutput;
      // 기대값 total×rate 를 확률적으로 구현: 정수부 + 소수부 확률로 1건 추가 (분당 0.4건 미만이라 반올림하면 항상 0)
      const expected = total * (0.005 + rand() * 0.007);
      const base = Math.floor(expected);
      const defect = base + (rand() < expected - base ? 1 : 0);
      const unknown = randInt(rand, 0, 1);
      // 음수 방지: 총량이 작아도 good >= 0 을 보장
      const safeDefect = Math.min(defect, total);
      const safeUnknown = Math.min(unknown, total - safeDefect);
      const good = total - safeDefect - safeUnknown;
      return {
        code: dev.code,
        body: {
          bucket_at: bucketAt,
          metrics: {
            total_inspected: total,
            good_count: good,
            defect_count: safeDefect,
            unknown_count: safeUnknown,
            inspection_time_seconds: Math.round((50 + rand() * 9.9) * 10) / 10,
          },
        },
      };
    }
    return {
      code: dev.code,
      body: {
        bucket_at: bucketAt,
        metrics: {
          runtime_seconds: randInt(rand, 55, 60),
          output_count: Math.round(packagingOutput * dev.ratio),
        },
      },
    };
  });
}

// 200 + duplicate:true -> duplicate, 200 -> ok, 그 외 error
export function classifyResponse(status: number, body: unknown): SendResult {
  if (status !== 200) return 'error';
  if (typeof body === 'object' && body !== null && (body as { duplicate?: unknown }).duplicate === true) {
    return 'duplicate';
  }
  return 'ok';
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { mode: 'live', hours: 0, offline: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') {
      args.mode = 'live';
    } else if (a === '--backfill') {
      const hours = Number(argv[++i]);
      if (!Number.isFinite(hours) || hours <= 0) throw new Error('--backfill 뒤에는 양수(시간)가 필요합니다');
      args.mode = 'backfill';
      args.hours = hours;
    } else if (a === '--offline') {
      const code = argv[++i];
      if (!code) throw new Error('--offline 뒤에는 장비 코드가 필요합니다');
      args.offline.push(code);
    }
  }
  return args;
}

type Stat = { ok: number; duplicate: number; error: number; lastError: string | null };

function floorToMinute(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 60000) * 60000);
}

function printStats(stats: Map<string, Stat>): void {
  for (const dev of DEVICES) {
    const s = stats.get(dev.code)!;
    console.log(`${dev.code.padEnd(14)} ok ${s.ok} / duplicate ${s.duplicate} / error ${s.error}`);
    if (s.lastError) console.log(`  마지막 error: ${s.lastError}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const keys = new Map<string, string | undefined>(
    DEVICES.map((d) => [d.code, process.env[`SIM_KEY_${d.code.toUpperCase()}`]]),
  );

  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anon) missing.push('SUPABASE_ANON_KEY');
  for (const d of DEVICES) {
    if (!args.offline.includes(d.code) && !keys.get(d.code)) missing.push(`SIM_KEY_${d.code.toUpperCase()}`);
  }
  if (missing.length > 0) {
    console.error(`누락된 환경변수: ${missing.join(', ')}`);
    process.exit(1);
  }

  const stats = new Map<string, Stat>(DEVICES.map((d) => [d.code, { ok: 0, duplicate: 0, error: 0, lastError: null }]));

  async function send(code: string, body: object): Promise<void> {
    const s = stats.get(code)!;
    try {
      const res = await fetch(`${url}/functions/v1/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anon}`,
          'X-Device-Code': code,
          'X-Api-Key': keys.get(code)!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // JSON이 아니면 원문 그대로 사용
      }
      const result = classifyResponse(res.status, parsed);
      s[result]++;
      if (result === 'error') s.lastError = `${res.status} ${text}`;
    } catch (e) {
      // 네트워크 오류도 중단하지 않고 집계
      s.error++;
      s.lastError = String(e);
    }
  }

  // 한 버킷을 오프라인 장비를 제외하고 6건 동시에 전송
  async function sendBucket(bucket: Date): Promise<void> {
    const items = buildMinute(bucket, Math.random).filter((i) => !args.offline.includes(i.code));
    await Promise.all(items.map((i) => send(i.code, i.body)));
  }

  if (args.offline.length > 0) console.log(`오프라인 장비(전송 생략): ${args.offline.join(', ')}`);

  if (args.mode === 'backfill') {
    const end = floorToMinute(new Date());
    const total = Math.round(args.hours * 60);
    console.log(`backfill: ${total}분 (${toKstIso(new Date(end.getTime() - total * 60000))} ~)`);
    for (let i = total; i >= 1; i--) {
      await sendBucket(new Date(end.getTime() - i * 60000));
    }
    printStats(stats);
    return;
  }

  // live: 다음 분 경계마다 직전 분 버킷 전송
  let stopped = false;
  const stop = () => {
    stopped = true;
    console.log('\n종료 — 누적 결과');
    printStats(stats);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log('live 시작 (Ctrl+C 로 종료)');
  while (!stopped) {
    const now = Date.now();
    const nextBoundary = (Math.floor(now / 60000) + 1) * 60000;
    await new Promise((r) => setTimeout(r, nextBoundary - now + 500));
    const bucket = new Date(nextBoundary - 60000);
    await sendBucket(bucket);
    console.log(`[${toKstIso(bucket)}] 전송 완료`);
    printStats(stats);
  }
}

// 직접 실행 시에만 main 호출 (테스트 import 시 부작용 없음)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
