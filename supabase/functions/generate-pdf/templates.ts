interface LotDocInput {
  lot_no: string;
  client_name: string;
  product_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  target_quantity: number | null;
  inspected: number;
  good_count: number;
  defect_count: number;
  unknown_count: number;
  defect_rate_pct: number;
  judgment: string;
}

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString('ko-KR');
}

function dateStr(s: string | null) {
  return s ? new Date(s).toLocaleString('ko-KR') : '-';
}

function judgmentColor(j: string): string {
  if (j === '정상') return '#1D9E75';
  if (j === '주의') return '#E8933A';
  if (j === '불합격') return '#D94444';
  return '#5F708A';
}

// Returns a pdfmake document definition (typed as any because @types aren't imported in Deno)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lotReportDoc(input: LotDocInput): any {
  return {
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 48],
    defaultStyle: { font: 'NotoSansKR', fontSize: 10, color: '#0F2340' },
    header: {
      margin: [48, 24, 48, 0],
      columns: [
        { text: '온기코퍼레이션', bold: true, fontSize: 13, color: '#1E64B4' },
        { text: '품질 성적서', alignment: 'right', fontSize: 10, color: '#5F708A' },
      ],
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage}/${pageCount}`,
      alignment: 'center',
      margin: [0, 8, 0, 0],
      fontSize: 8,
      color: '#8CA0B8',
    }),
    content: [
      { text: `LOT 품질 성적서`, bold: true, fontSize: 16, margin: [0, 0, 0, 12] },
      {
        columns: [
          [
            { text: 'LOT 번호', color: '#5F708A', fontSize: 9 },
            { text: input.lot_no, bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ],
          [
            { text: '납품처', color: '#5F708A', fontSize: 9 },
            { text: input.client_name, bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ],
          [
            { text: '발행일시', color: '#5F708A', fontSize: 9 },
            { text: new Date().toLocaleString('ko-KR'), fontSize: 11, margin: [0, 2, 0, 0] },
          ],
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: ['30%', '*'],
          body: [
            ['제품명', input.product_name ?? '-'],
            ['생산 시작', dateStr(input.started_at)],
            ['생산 종료', dateStr(input.ended_at)],
            ['목표 수량', input.target_quantity != null ? `${fmt(input.target_quantity)} ea` : '-'],
            ['검사 수량', `${fmt(input.inspected)} ea`],
            ['양품 수량', `${fmt(input.good_count)} ea`],
            ['불량 수량', `${fmt(input.defect_count)} ea`],
            ['판정불가', `${fmt(input.unknown_count)} ea`],
            ['불량률', `${input.defect_rate_pct.toFixed(2)}%`],
            [{ text: '판정', bold: true }, { text: input.judgment, bold: true, color: judgmentColor(input.judgment) }],
          ],
        },
        layout: {
          fillColor: (row: number) => (row % 2 === 0 ? '#F5F8FC' : null),
          hLineColor: () => '#DCE6F2',
          vLineColor: () => '#DCE6F2',
        },
        margin: [0, 0, 0, 24],
      },
      {
        columns: [
          { text: '품질관리 책임자', alignment: 'center', fontSize: 9, color: '#5F708A' },
          { text: '(서명)', alignment: 'center', fontSize: 9, color: '#8CA0B8' },
        ],
        margin: [0, 40, 0, 0],
      },
    ],
  };
}
