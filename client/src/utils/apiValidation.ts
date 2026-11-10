type ApiErrors = Record<string, { message: string }> | undefined;

/** API errors 객체 → 필드별 메시지 맵 (address.detailAddress → detailAddress) */
export function fieldErrorsFromApi(errors: ApiErrors): Record<string, string> {
  if (!errors) return {};
  const out: Record<string, string> = {};
  for (const [path, detail] of Object.entries(errors)) {
    const key = path.includes('.') ? path.split('.').pop()! : path;
    if (detail?.message) out[key] = detail.message;
  }
  return out;
}

/** 요약 문구: 필드 메시지 우선, 없으면 message */
export function validationSummary(data: { message?: string; errors?: ApiErrors } | undefined, fallback: string): string {
  const errors = data?.errors;
  if (errors) {
    const lines = Object.values(errors).map((e) => e.message).filter(Boolean);
    if (lines.length) return lines.join('\n');
  }
  return data?.message || fallback;
}
