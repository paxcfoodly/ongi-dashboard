export function parseCsvRow(csv: string): Record<string, string> {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('csv must have header and at least one row');
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const row = lines[1].split(',').map((v) => v.trim());
  if (header.length !== row.length) {
    throw new Error('header/row column count mismatch');
  }
  return Object.fromEntries(header.map((h, i) => [h, row[i]]));
}

export function csvToVisionPayload(csv: string): unknown {
  const r = parseCsvRow(csv);
  return {
    bucket_at: r.bucket_at,
    metrics: {
      total_inspected: Number(r.total_inspected),
      good_count: Number(r.good_count),
      defect_count: Number(r.defect_count),
      unknown_count: Number(r.unknown_count),
      inspection_time_seconds: Number(r.inspection_time_seconds),
    },
  };
}

export function csvToEquipmentPayload(csv: string): unknown {
  const r = parseCsvRow(csv);
  return {
    bucket_at: r.bucket_at,
    metrics: {
      runtime_seconds: Number(r.runtime_seconds),
      output_count: Number(r.output_count),
    },
  };
}
