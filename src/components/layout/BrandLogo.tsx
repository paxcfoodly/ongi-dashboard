import { BRAND } from '../../lib/brand';

// 로고 파일이 없는 동안에는 같은 크기의 자리 표시를 보여준다
export function BrandLogo({ src = BRAND.logoSrc }: { src?: string | null }) {
  if (src) {
    return <img src={src} alt={BRAND.logoAlt} className="h-8 md:h-9 w-auto max-w-[140px] object-contain flex-none" />;
  }
  return (
    <span
      data-testid="brand-logo-placeholder"
      aria-hidden="true"
      className="w-8 h-8 md:w-9 md:h-9 flex-none rounded-lg bg-primary-light text-text font-bold text-[15px] flex items-center justify-center"
    >
      온
    </span>
  );
}
