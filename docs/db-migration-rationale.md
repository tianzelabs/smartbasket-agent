# SmartBasket Agent – SQLite → PostgreSQL migráció indoklása

> A döntés alapja a beadott HF1 tanári visszajelzése:
>
> _"Egy megjegyzés: a stack-től eltértél (SQLite). A saját use case-hez ez védhető döntés, csak a
> read-only védelmi réteget nézd át, hogy SQLite-on is legalább kétrétegű legyen, mert ott nincs
> szerepkör-alapú védelem, mint Postgresben."_
>
> Ez a doksi leírja, mit találtam a beadott SQLite-rétegben, miért nem elég önmagában, és milyen
> Postgres-alapú tervet vezettünk be helyette – ugyanazzal a RW/RO szerepkör-mintával, amit az órai
> `plantbase` referencia is használ.

---

## 1. Mi volt a beadott állapotban

A `runSql` tool már a beadáskor is két réteget használt:

1. **`sql-guard.ts`** – alkalmazás-szintű ellenőrzés: csak egyetlen `SELECT`/`WITH` statement,
   tiltott kulcsszavak (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `PRAGMA`, `ATTACH` stb.).
2. **`db-readonly.ts`** – a `runSql` egy külön, `better-sqlite3 { readonly: true }` kapcsolaton fut,
   ami az `SQLITE_OPEN_READONLY` flaget adja át az SQLite motornak.

Ez a második réteg **valóban független** volt az elsőtől – leellenőriztem: egy közvetlenül a
readonly kapcsolaton, a guard megkerülésével futtatott `INSERT` az SQLite motortól
`SQLITE_READONLY` hibát kapott, tehát nem csak egy második, ugyanolyan hibázható
alkalmazáskód-ellenőrzés volt.

**A tanár által jelzett hiányosság:** mindkét réteg **ugyanabban a Node-folyamatban, ugyanazon a
fájl-kapcsolaton** érvényesült. Nincs mögötte olyan, a lekérdezés-kódtól teljesen független
kikényszerítés, mint egy Postgres-szerveren futó `GRANT SELECT` / hiányzó `INSERT`-jog – ahol maga
az adatbázis-szerver, egy másik process, tartja számon, hogy egy adott bejelentkezett szerepkör
fizikailag sem tud írni, függetlenül attól, hogy a kliens mit próbál küldeni.

## 2. Az új terv: két Postgres-szerepkör, négy réteg

A `docs/proposal-implementacio.md` eredetileg is deklarálta, hogy az SQLite-os
readonly-kapcsolat + guard páros "a Postgres-referenciák RW/RO role-párjának SQLite-natív
megfelelője" – ezt a megfelelőt most lecseréljük az eredetire. A `runSql`/`listCategories`/
`checkDatasetFreshness` a `smartbasket_ro` Postgres-szerepkörön fut, aminek **kizárólag** `SELECT`
joga van a `public` sémában:

1. **DB-szerepkör (`smartbasket_ro`)** – a Postgres szerver maga utasítja el az `INSERT`/`UPDATE`/
   `DELETE`/DDL parancsokat, a klienskódtól teljesen függetlenül. Ez válaszol közvetlenül a tanári
   megjegyzésre.
2. **`sql-guard.ts`** – változatlan: egyetlen `SELECT`/`WITH` statement, tiltott kulcsszavak.
3. **`START TRANSACTION READ ONLY`** – minden `runSql`-lekérdezés egy explicit read-only
   tranzakcióban fut a session szintjén is.
4. **`statement_timeout`** – 5 másodperces korlát, DoS-védelemként (elszabadult/összetett
   lekérdezés nem tarthatja végtelenségig a kapcsolatot).

A séma írása (migráció, napi import) egy külön, `smartbasket` (RW) szerepkörön megy –
ugyanaz a RW/RO szétválasztás, mint eddig, csak most DB-szerver szinten is kikényszerítve.

## 3. Miért nem Prisma

A projekt eredeti döntése (`konvenciok.md` 6. pont, "SQL-first, no ORM") változatlan marad: a
sémát sima `.sql` migrációs fájlok írják le, amiket egy kis, kézzel írt migrációs futtató
alkalmaz – nincs Prisma, nincs ORM az agent SQL-je előtt. Ez a Postgres-váltás után is így marad;
az egyetlen visszamaradó, dokumentált eltérés a `stack.md`-től ez az ORM-mentesség, nem az
adatbázis-motor.

## 4. Mi nem változik

- A request flow változatlan: `CLI → ensureFreshDataset()/checkDatasetFreshness() → DB → Agent
  (tool loop) → runSql() → DB → NL válasz`.
- Az agent továbbra is kizárólag a `vw_products`/`vw_categories`/`vw_best_prices` szemantikus
  view-kat éri el, sosem a nyers `products` táblát.
- A napi import továbbra is snapshot-alapú, tranzakciós, egy lépésben cserélt (`DELETE` + batch
  `INSERT` + `import_metadata` bejegyzés, hibánál teljes rollback).
- A `sql-guard.ts` egyetlen sort sem változik – a fenti négy rétegből ez a második, nem az egyetlen.
