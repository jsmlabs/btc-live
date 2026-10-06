const PRICE_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero'
});

const SMALL_PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 4
});

export function formatPrice(value) {
  return Number.isFinite(value) ? PRICE_FORMATTER.format(value) : '—';
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${PERCENT_FORMATTER.format(value)}%` : '—';
}

export function formatUnsignedPercent(value) {
  return Number.isFinite(value) && value >= 0 ? `${SMALL_PERCENT_FORMATTER.format(value)}%` : '—';
}

export function formatVolume(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  const units = [
    { threshold: 1e12, suffix: 'T' },
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' }
  ];
  const unit = units.find((item) => value >= item.threshold);
  if (!unit) return PRICE_FORMATTER.format(value);
  return `${(value / unit.threshold).toFixed(2)}${unit.suffix}`;
}

export function formatSpread(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}
