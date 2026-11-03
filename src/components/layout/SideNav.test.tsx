import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SideNav } from './SideNav';

const original = Element.prototype.scrollIntoView;

describe('SideNav', () => {
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  it('현재 경로의 메뉴를 스크롤 영역 안으로 스크롤한다', () => {
    const scrolled: string[] = [];
    // jsdom 에는 scrollIntoView 가 없어 프로토타입에 목을 단다
    Element.prototype.scrollIntoView = vi.fn(function (this: Element, opts?: boolean | ScrollIntoViewOptions) {
      scrolled.push(`${this.textContent}|${JSON.stringify(opts)}`);
    });
    render(
      <MemoryRouter initialEntries={['/admin/ingest-logs']}>
        <SideNav showAdmin />
      </MemoryRouter>,
    );
    expect(scrolled).toEqual([`수신 원본|${JSON.stringify({ inline: 'nearest', block: 'nearest' })}`]);
  });

  it('기간 대상 메뉴는 기간 쿼리를 유지하고 그 외 메뉴는 유지하지 않는다', () => {
    render(
      <MemoryRouter initialEntries={['/kpi?from=2026-10-01&to=2026-10-07']}>
        <SideNav showAdmin={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'AI 성능지표' }).getAttribute('href')).toContain('?from=2026-10-01&to=2026-10-07');
    expect(screen.getByRole('link', { name: 'LOT 이력' }).getAttribute('href')).toBe('/lot');
  });

  it('관리자 메뉴는 관리자에게만 보인다', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/kpi']}>
        <SideNav showAdmin={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: '수신 원본' })).not.toBeInTheDocument();
    unmount();
    render(
      <MemoryRouter initialEntries={['/kpi']}>
        <SideNav showAdmin />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '수신 원본' })).toBeInTheDocument();
  });
});
