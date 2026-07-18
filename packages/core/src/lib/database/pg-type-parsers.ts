import pg from 'pg';

const NUMERIC_OID = 1700;
const INT8_OID = 20;
const DATE_OID = 1082;

// A Postgres NUMERIC (árak) és BIGINT (pl. COUNT(*)) oszlopokat
// alapértelmezésben stringként adja vissza a pg driver (tetszőleges
// pontosság megőrzése miatt) - ez a projekt viszont natív JS number-t vár,
// ahogy az SQLite verzió is tette. Az értékek mérete messze a Number
// biztonságos tartományán belül van ebben a katalógusban; a NUMERIC
// oszloptípus a DB-oldali (SUM/AVG) kerekítési hibák ellen véd, ezek a
// parserek csak a JS-oldali visszaadási formátumot igazítják vissza.
pg.types.setTypeParser(NUMERIC_OID, (value: string) => parseFloat(value));
pg.types.setTypeParser(INT8_OID, (value: string) => parseInt(value, 10));

// A pg driver a DATE oszlopokat (pl. import_date) alapértelmezésben helyi
// időzóna szerint értelmezett JS Date objektummá alakítja - ez UTC-től
// eltérő gépi időzónánál egy nappal el tudja csúsztatni a dátumot
// (pl. toISOString()-nál). A projekt máshol is sima "YYYY-MM-DD" stringként
// kezeli a dátumokat (todayIsoDate() is ezt adja) - itt megtartjuk a nyers
// stringet, nincs Date-konverzió, nincs időzóna-kétértelműség.
// Side-effect import: minden pg.Client-et létrehozó modul importálja.
pg.types.setTypeParser(DATE_OID, (value: string) => value);
