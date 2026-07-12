const DEFAULT_SOURCE_URL =
  'https://cdnarfigyeloprodweu.azureedge.net/excel/arfigyelo_napi_termekadatok.xlsx';

export function resolveSourceUrl(): string {
  const configured = process.env.ARFIGYELO_DAILY_XLSX_URL;
  return configured && configured.length > 0 ? configured : DEFAULT_SOURCE_URL;
}
