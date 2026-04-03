export function formatMinutes(minutes: number | undefined): string {
  if (minutes == null || isNaN(minutes)) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatNumber(
  n: number,
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(undefined, opts).format(n);
}

export function pluralize(
  n: number,
  singular: string,
  plural?: string,
): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}
