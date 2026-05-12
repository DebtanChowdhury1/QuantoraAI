export const formatConfidencePercent = (value, decimals = 3) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${(numeric * 100).toFixed(decimals)}%`;
};

export const formatCurrency = (value, options = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: options.currency || 'USD',
    minimumFractionDigits: numeric >= 1 ? options.minimumFractionDigits ?? 2 : 4,
    maximumFractionDigits: numeric >= 1 ? options.maximumFractionDigits ?? 2 : 8,
  }).format(numeric);
};

export const formatUsdAsCurrency = (value, { currency = 'USD', rate = 1, ...options } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return formatCurrency(numeric * Number(rate || 1), { currency, ...options });
};

export const formatPercent = (value, decimals = 3) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(decimals)}%`;
};
