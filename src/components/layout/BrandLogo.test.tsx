import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandLogo } from './BrandLogo';

describe('BrandLogo', () => {
  it('로고 파일이 있으면 이미지를 표시한다', () => {
    render(<BrandLogo src="/logo.svg" />);
    expect(screen.getByRole('img', { name: '온기코퍼레이션 로고' })).toHaveAttribute('src', '/logo.svg');
  });

  it('로고 파일이 없으면 자리 표시를 보여주고 깨진 이미지를 만들지 않는다', () => {
    const { container } = render(<BrandLogo src={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('brand-logo-placeholder')).toBeInTheDocument();
  });
});
