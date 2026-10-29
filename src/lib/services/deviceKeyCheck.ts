// 장비 API 키 확인 결과(fn_admin_check_device_key)를 관리자에게 보여 줄 문장으로 바꿈

// 발급 키 길이: 24바이트 난수 → 16진수 48자리 (useAdminDevices.generateApiKey)
export const DEVICE_API_KEY_LENGTH = 48;

export interface DeviceKeyCheckResult {
  key_registered: boolean;
  match: boolean;
  match_after_cleanup: boolean;
  length: number;
  clean_length: number;
  has_whitespace: boolean;
  has_bearer: boolean;
  has_quotes: boolean;
  prefix: string;
  registered_prefix: string | null;
}

export type KeyCheckVerdict = 'unregistered' | 'match' | 'match_after_cleanup' | 'mismatch';

export interface KeyCheckDescription {
  verdict: KeyCheckVerdict;
  title: string;
  details: string[];
}

export function describeKeyCheck(r: DeviceKeyCheckResult): KeyCheckDescription {
  if (!r.key_registered) {
    return {
      verdict: 'unregistered',
      title: '이 장비는 아직 키가 발급되지 않았습니다.',
      details: ['[키 재발급]으로 키를 발급한 뒤 업체에 전달하세요.'],
    };
  }

  if (r.match) {
    return {
      verdict: 'match',
      title: '등록된 키와 일치합니다.',
      details: ['이 키로 보내는데도 invalid_key가 나오면 X-Device-Code(장비 코드)가 이 장비와 같은지 확인하세요.'],
    };
  }

  if (r.match_after_cleanup) {
    const extras: string[] = [];
    if (r.has_whitespace) extras.push('앞뒤 공백·줄바꿈');
    if (r.has_bearer) extras.push("'Bearer ' 접두어");
    if (r.has_quotes) extras.push('따옴표');
    return {
      verdict: 'match_after_cleanup',
      title: '키 자체는 맞지만 불필요한 문자가 섞여 있습니다.',
      details: [
        `섞인 문자: ${extras.join(', ')}`,
        'X-Api-Key 헤더에는 키 문자열만 넣도록 업체에 요청하세요.',
      ],
    };
  }

  const registered = r.registered_prefix
    ? `등록된 키 앞 4자리 '${r.registered_prefix}'`
    : '등록된 키 앞자리 기록 없음(재발급하면 기록됨)';
  const details = [`입력한 키 앞 4자리 '${r.prefix}' / ${registered}`];
  if (r.clean_length !== DEVICE_API_KEY_LENGTH) {
    details.push(`정상 키는 ${DEVICE_API_KEY_LENGTH}자리인데 입력한 키는 ${r.clean_length}자리입니다 — 일부만 복사됐을 수 있습니다.`);
  }
  if (r.registered_prefix && r.registered_prefix !== r.prefix) {
    details.push('앞자리부터 달라서 다른 키(이전에 발급한 키 등)를 쓰고 있을 가능성이 큽니다. 재발급 후 새 키를 전달하세요.');
  } else if (r.registered_prefix) {
    details.push('앞자리는 같으니 중간이나 끝 부분이 잘못 복사됐을 가능성이 큽니다.');
  }
  return { verdict: 'mismatch', title: '등록된 키와 다릅니다.', details };
}
