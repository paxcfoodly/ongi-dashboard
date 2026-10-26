import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 워커가 생성되기 전(메인 프로세스)에 KST로 고정 — 워커는 env를 상속한다.
// 테스트 파일 안에서 설정하면 CI(UTC)에서 적용되지 않는다.
process.env.TZ = 'Asia/Seoul';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // threads 풀에서 react-router ESM 청크 로드 시 간헐적으로 React.createContext 미정의 오류가 발생해 forks 풀로 격리한다.
    pool: 'forks',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
