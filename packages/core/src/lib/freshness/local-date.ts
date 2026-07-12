// Mai dátum ISO (YYYY-MM-DD) formátumban - a freshness-ellenőrzés ezt
// hasonlítja össze az import_metadata.import_date oszloppal.
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
