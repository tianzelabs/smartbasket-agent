# SmartBasket Agent – Business Requirements Specification (BRS)

## 1. Projekt célja

A SmartBasket Agent egy AI-alapú CLI alkalmazás, amely segít a felhasználónak
összehasonlítani a magyarországi üzletláncok árait egy bevásárlókosár alapján.

A rendszer a GVH Árfigyelő hivatalos napi termékadatbázisát használja.
A felhasználó természetes nyelven tehet fel kérdéseket, az agent SQL-lekérdezésekkel
válaszolja meg azokat.

A cél nem egyszerű árkeresés, hanem intelligens bevásárlási döntéstámogatás.

---

# 2. Üzleti probléma

Jelenleg a felhasználónak több weboldalt kell megnyitnia (Tesco, Lidl, Aldi,
Rossmann stb.), ha szeretné megtudni, hol érdemes megvásárolni egy adott
terméket vagy bevásárlókosarat.

Ez:

- időigényes
- manuális
- nehezen összehasonlítható
- minden keresést újra el kell végezni

A SmartBasket ezt automatizálja.

---

# 3. Célfelhasználó

Elsődleges célcsoport:

- magyarországi vásárlók
- rendszeresen bevásárló családok
- árérzékeny vásárlók

Másodlagos célcsoport:

- kis irodák
- egyéni vállalkozók
- oktatási célú AI agent demonstráció

---

# 4. Fő funkciók

A rendszer képes legyen:

- természetes nyelvű kérdések fogadására
- SQL-lekérdezések generálására
- Postgres adatbázis lekérdezésére
- üzletláncok árainak összehasonlítására
- kategóriák listázására
- termékek keresésére
- válaszok természetes nyelvű megfogalmazására

---

# 5. Automatikus adatfrissítés

A rendszer minden kérdés előtt ellenőrzi,
hogy az adatbázis a mai napi GVH Árfigyelő
adatsorokat tartalmazza-e.

Ha nem:

1. letölti a napi Excel fájlt
2. feldolgozza azt
3. frissíti a Postgres adatbázist
4. naplózza az importot
5. csak ezután válaszol

A felhasználónak ezt nem kell külön elindítania.

---

# 6. Adatforrás

Hivatalos adatforrás:

GVH Árfigyelő

https://cdnarfigyeloprodweu.azureedge.net/excel/arfigyelo_napi_termekadatok.xlsx

Az agent kizárólag ebből a forrásból importált,
lokálisan tárolt adatokat használ.

Közvetlen web scraping vagy online API-hívás
kérdés megválaszolásakor nem történik.

---

# 7. Példa kérdések

"Hol a legolcsóbb a Dove testápoló?"

"Melyik üzletláncban a legolcsóbb a csirkemell?"

"Milyen kategóriák érhetők el?"

"Melyik boltban kapható ez a termék?"

"Hasonlítsd össze a Tesco és a Lidl árait."

---

# 8. Nem cél (Out of Scope)

A projekt első verziója NEM tartalmazza:

- online rendelést
- fizetést
- felhasználói fiókokat
- kuponkezelést
- készletkezelést
- történeti árdiagramokat
- OCR feldolgozást
- webes felületet
- mobil alkalmazást

---

# 9. AI Agent viselkedése

Az agent:

- mindig Postgres adatbázisból dolgozik, a smartbasket_ro (RO) szerepkörön
- nem talál ki árakat
- nem talál ki termékeket
- nem talál ki üzletláncokat
- SQL segítségével keres adatot
- minden választ természetes nyelven fogalmaz meg

---

# 10. Functional Requirements

FR-01

A rendszer természetes nyelvű kérdést fogad.

FR-02

A rendszer ellenőrzi az adatok frissességét.

FR-03

Szükség esetén letölti a napi GVH Excel fájlt.

FR-04

Importálja az adatokat Postgres adatbázisba.

FR-05

A runSql tool segítségével SQL-lekérdezést hajt végre.

FR-06

A listCategories tool visszaadja az összes termékkategóriát.

FR-07

A válasz ugyanazon a nyelven érkezik,
amelyen a felhasználó kérdezett.

---

# 11. Non-functional Requirements

A rendszer legyen:

- lokálisan futtatható
- platformfüggetlen
- gyors (<5 másodperc tipikus lekérdezés)
- reprodukálható
- könnyen bővíthető
- jól naplózható

---

# 12. Sikerkritérium

A projekt akkor tekinthető késznek, ha:

- az agent sikeresen válaszol valós kérdésekre
- SQL segítségével olvassa az adatbázist
- automatikusan frissíti az adatokat
- minden válasz reprodukálható
- a CLI végpont teljesen működik
