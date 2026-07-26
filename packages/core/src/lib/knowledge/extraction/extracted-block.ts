// Közös blokk-reprezentáció HTML és PDF kinyerés között (docs/rag-chunking-strategy.md).
// A chunking modul ez alapján dolgozik, nem tudja (és nem kell tudnia), hogy
// a forrás HTML vagy PDF volt.
export interface ExtractedBlock {
  // 0 = bekezdés/listaelem (nincs heading), 2 = H2-szintű alcím, 3 = H3-szintű alcím.
  // PDF-nél mindig 0, mert a kinyert szövegben nincs megbízható heading-jelölés.
  level: 0 | 2 | 3;
  text: string;
  isListItem: boolean;
}
