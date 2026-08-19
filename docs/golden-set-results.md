# Golden set – nyers vektorkeresés vs. teljes pipeline (HF3)

> 10 kérdés a tudásbázis 6 altémájából (2 negatív teszt). Minden kérdés kétféleképp futott: (1) nyers vektorkeresés - csak embedding + pgvector koszinusz-távolság, HyDE és rerank nélkül; (2) a teljes pipeline (`searchKnowledge`) - HyDE (Haiku) + embedding + pgvector + rerank (Cohere rerank-v3.5) + relevancia-küszöb. Éles korpuszon (136 dokumentum, 326 chunk, valós Cohere/Anthropic hívásokkal) generálva.

**Összefoglaló:** a(z) 8 összevethető kérdésből **5-nél (63%)** a rerank ténylegesen átrendezte a top találatot (részletek lent és az összesítő táblában) - ez konkrét bizonyíték arra, hogy a rerank lépés érdemi hozzáadott értéket ad a nyers vektorkereséshez képest.

| # | Kérdés | Nyers top-1 | Teljes pipeline top-1 | Átrendezve? |
|---|---|---|---|---|
| q1-datum-cimke | Mit jelent a „minőségét megőrzi” és miben különbözik a „fogyasztható” jelöléstől? | Éhezünk és pazarolunk > Éhezünk és pazarolunk | Éhezünk és pazarolunk > Éhezünk és pazarolunk | Nem |
| q2-akcio-tulvasarlas | Hogyan kerülhetem el, hogy az akciók miatt túl sok élelmiszert vegyek? | GONDOLJA VÉGIG HIGGADTAN - Árkedvezmények | Apró lépésekkel az élelmiszerpazarlás csökkentéséért! | **IGEN** |
| q3-lejart-tejtermek | Mire figyeljek egy közeli lejáratú tejtermék megvásárlásakor? | Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban | Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban | **IGEN** |
| q4-bevasarlolista | Hogyan érdemes bevásárlólistát készíteni egy kétszemélyes háztartásnak? | Élelmiszer-tartalékolási útmutató (teljes kiadvány) | Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban | **IGEN** |
| q5-huto-homerseklet | Milyen hőmérsékleten érdemes tartani a hűtőszekrényt? | Apró lépésekkel az élelmiszerpazarlás csökkentéséért! | „A hűtő mindenre megoldás” – vagy mégsem? | **IGEN** |
| q6-nagy-kiszereles | Mindig gazdaságosabb a nagyobb kiszerelés? | A felnőtté válás küszöbén: tippek a pazarlásmentes konyhai szokások kialakításához | Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban | **IGEN** |
| q7-lejart-termek-jogok | Mit tehetek, ha lejárt terméket vásároltam? | Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban | Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban | Nem |
| q8-akcio-tisztesseges | Honnan tudom, hogy egy áruházlánc akciója valóban tisztességes, nem csak látszatkedvezmény? | Áruházláncok akciótartási gyakorlata | Áruházláncok akciótartási gyakorlata | Nem |
| q9-keszlet-negativ (negatív) | Van jelenleg készleten zabtej a Váci úti Aldiban? | Új kiadványok segítik az internetes élelmiszervásárlást és a biztonságos étrend-kiegészítő fogyasztást > Új kiadványok segítik az internetes élelmiszervásárlást és a biztonságos étrend-kiegészítő fogyasztást | _belowThreshold_ | n/a |
| q10-nutriscore-negativ (negatív) | Mit jelent a Nutri-Score besorolás és hogyan számolják ki? | Vásároljunk okosan! – Kérdések és válaszok | _belowThreshold_ | n/a |

---

## q1-datum-cimke

**Kérdés:** Mit jelent a „minőségét megőrzi” és miben különbözik a „fogyasztható” jelöléstől?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Éhezünk és pazarolunk > Éhezünk és pazarolunk
2. Vásároljunk okosan! – Kérdések és válaszok
3. Hiánypótló „lejárati útmutatót” állított össze a Nébih > Hiánypótló „lejárati útmutatót” állított össze a Nébih
4. Vásároljunk okosan! – Kérdések és válaszok
5. Vásároljunk okosan! – Kérdések és válaszok

**Teljes pipeline (HyDE + rerank), top 5:**

1. Éhezünk és pazarolunk > Éhezünk és pazarolunk (relevanceScore: 0.927)
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.900)
3. Vásároljunk okosan! – Kérdések és válaszok (relevanceScore: 0.867)
4. Vásároljunk okosan! – Kérdések és válaszok (relevanceScore: 0.842)
5. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.811)

**Rerank átrendezett-e?** Nem - az 1. helyen ugyanaz a chunk maradt.

---

## q2-akcio-tulvasarlas

**Kérdés:** Hogyan kerülhetem el, hogy az akciók miatt túl sok élelmiszert vegyek?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. GONDOLJA VÉGIG HIGGADTAN - Árkedvezmények
2. Hogyan ismerjük fel a megtévesztő akciókat? Avagy mit jelent valójában a „-70%” kedvezmény?
3. Tovább csökkent a pazarlás a magyar háztartásokban > 2016 óta követjük nyomon a magyar háztartásokban keletkező élelmiszerhulladék mennyiségét. A 2025-ös felmérés eredményei szerint tovább erősödött a kedvező tendencia: az elkerülhető élelmiszerhulladék, vagyis az élelmiszerpazarlás mértéke az elmúlt kilenc évben 37,2%-kal csökkent. Az otthoni pazarlás hátterében továbbra is ugyanazok a mindennapi hibák állnak: a túlvásárlás, a túlzott főzés és a megfeledkezett élelmiszerek.
4. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony
5. Áruházláncok akciótartási gyakorlata

**Teljes pipeline (HyDE + rerank), top 5:**

1. Apró lépésekkel az élelmiszerpazarlás csökkentéséért! (relevanceScore: 0.693)
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.559)
3. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.489)
4. Hogyan ismerjük fel a megtévesztő akciókat? Avagy mit jelent valójában a „-70%” kedvezmény? (relevanceScore: 0.282)
5. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.268)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q3-lejart-tejtermek

**Kérdés:** Mire figyeljek egy közeli lejáratú tejtermék megvásárlásakor?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
3. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
4. Újabb termékekkel bővült népszerű lejárati útmutatónk
5. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih

**Teljes pipeline (HyDE + rerank), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.706)
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.688)
3. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih (relevanceScore: 0.653)
4. Vásároljunk okosan! – Kérdések és válaszok (relevanceScore: 0.649)
5. Maradék nélkül – Lejárati útmutató (relevanceScore: 0.630)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q4-bevasarlolista

**Kérdés:** Hogyan érdemes bevásárlólistát készíteni egy kétszemélyes háztartásnak?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
4. A felnőtté válás küszöbén: tippek a pazarlásmentes konyhai szokások kialakításához
5. Vásároljunk okosan! – Kérdések és válaszok

**Teljes pipeline (HyDE + rerank), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.741)
2. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.695)
3. Sietős hétköznapok maradék nélkül (relevanceScore: 0.632)
4. Vásároljunk okosan! – Kérdések és válaszok (relevanceScore: 0.541)
5. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.501)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q5-huto-homerseklet

**Kérdés:** Milyen hőmérsékleten érdemes tartani a hűtőszekrényt?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Apró lépésekkel az élelmiszerpazarlás csökkentéséért!
2. Hűtőútmutató
3. Hűtőútmutató
4. Hűtőútmutató
5. Vásároljunk okosan! – Kérdések és válaszok

**Teljes pipeline (HyDE + rerank), top 5:**

1. „A hűtő mindenre megoldás” – vagy mégsem? (relevanceScore: 0.882)
2. Apró lépésekkel az élelmiszerpazarlás csökkentéséért! (relevanceScore: 0.871)
3. Hűtőútmutató (relevanceScore: 0.854)
4. Hőség és fokozott villamosenergia-terhelés: így őrizhetjük meg az élelmiszerek biztonságát (relevanceScore: 0.799)
5. Hűtőútmutató (relevanceScore: 0.796)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q6-nagy-kiszereles

**Kérdés:** Mindig gazdaságosabb a nagyobb kiszerelés?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. A felnőtté válás küszöbén: tippek a pazarlásmentes konyhai szokások kialakításához
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
3. GONDOLJA VÉGIG HIGGADTAN - Árkedvezmények
4. Éhezünk és pazarolunk > Éhezünk és pazarolunk
5. NKFH adatbázis a kiszereléscsökkentések átláthatóvá tételéért és a fogyasztók védelméért

**Teljes pipeline (HyDE + rerank), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.849)
2. A felnőtté válás küszöbén: tippek a pazarlásmentes konyhai szokások kialakításához (relevanceScore: 0.643)
3. Jobb, mint a „hagyományos”? (relevanceScore: 0.275)
4. Apró lépésekkel az élelmiszerpazarlás csökkentéséért! (relevanceScore: 0.258)
5. Adagkalkulátor (relevanceScore: 0.132)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q7-lejart-termek-jogok

**Kérdés:** Mit tehetek, ha lejárt terméket vásároltam?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
3. Termékvisszahívás - Csipkebogyó hús 100 g (Herbária, Pannonhalmi) termékek esetében nem engedélyezett növényvédőszer-hatóanyag tartalom miatt
4. Vásároljunk okosan! – Kérdések és válaszok
5. Újabb termékekkel bővült népszerű lejárati útmutatónk

**Teljes pipeline (HyDE + rerank), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.798)
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.736)
3. Lejárt élelmiszer? Adhatsz neki egy esélyt! (relevanceScore: 0.697)
4. Újabb termékekkel bővült népszerű lejárati útmutatónk (relevanceScore: 0.658)
5. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.652)

**Rerank átrendezett-e?** Nem - az 1. helyen ugyanaz a chunk maradt.

---

## q8-akcio-tisztesseges

**Kérdés:** Honnan tudom, hogy egy áruházlánc akciója valóban tisztességes, nem csak látszatkedvezmény?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Áruházláncok akciótartási gyakorlata
2. Általános fogyasztói kosár ellenőrzés: az akciós árak többsége megfelelt a szabályoknak
3. Hogyan ismerjük fel a megtévesztő akciókat? Avagy mit jelent valójában a „-70%” kedvezmény?
4. Szigorú fogyasztóvédelmi fellépés az akciós árakkal trükközö kereskedőkkel szemben
5. Ma van a fekete péntek – Legyen megfontolt és vigyázzon az akciókkal!

**Teljes pipeline (HyDE + rerank), top 5:**

1. Áruházláncok akciótartási gyakorlata (relevanceScore: 0.762)
2. GONDOLJA VÉGIG HIGGADTAN - Árkedvezmények (relevanceScore: 0.529)
3. Általános fogyasztói kosár ellenőrzés: az akciós árak többsége megfelelt a szabályoknak (relevanceScore: 0.522)
4. Hogyan ismerjük fel a megtévesztő akciókat? Avagy mit jelent valójában a „-70%” kedvezmény? (relevanceScore: 0.496)
5. Hogyan ismerjük fel a megtévesztő akciókat? Avagy mit jelent valójában a „-70%” kedvezmény? (relevanceScore: 0.419)

**Rerank átrendezett-e?** Nem - az 1. helyen ugyanaz a chunk maradt.

---

## q9-keszlet-negativ (negatív teszt)

**Kérdés:** Van jelenleg készleten zabtej a Váci úti Aldiban?

> A tudásbázis nem tartalmaz bolti készletadatot - ez a runSql/listCategories hatásköre is, de a searchKnowledge-nek sem szabad kitalálnia.

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Új kiadványok segítik az internetes élelmiszervásárlást és a biztonságos étrend-kiegészítő fogyasztást > Új kiadványok segítik az internetes élelmiszervásárlást és a biztonságos étrend-kiegészítő fogyasztást
2. Termékvisszahívás - ALDI Baromfivirsli csirkemellel 280 g tej allergén (sajt) jelenléte miatt
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
4. Vásároljunk okosan! – Kérdések és válaszok
5. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban

**Teljes pipeline (HyDE + rerank), top 5:**

_(belowThreshold: true - nincs a küszöböt elérő találat)_

**Rerank átrendezett-e?** n/a (nincs elég találat az összevetéshez)

---

## q10-nutriscore-negativ (negatív teszt)

**Kérdés:** Mit jelent a Nutri-Score besorolás és hogyan számolják ki?

> A korpusz egyike sem tárgyalja a Nutri-Score módszertanát - a tudásbázisban nincs erre megbízható forrás.

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Vásároljunk okosan! – Kérdések és válaszok
2. Vásároljunk okosan! – Kérdések és válaszok
3. Vásároljunk okosan! – Kérdések és válaszok
4. Vásároljunk okosan! – Kérdések és válaszok
5. A bio mindig jobb – vagy mégsem?

**Teljes pipeline (HyDE + rerank), top 5:**

_(belowThreshold: true - nincs a küszöböt elérő találat)_

**Rerank átrendezett-e?** n/a (nincs elég találat az összevetéshez)

---

## Elemzés: miért jobb az új sorrend (q2-akcio-tulvasarlas példáján)

A **q2-akcio-tulvasarlas** kérdésnél ("Hogyan kerülhetem el, hogy az akciók miatt túl sok élelmiszert vegyek?") a nyers
vektorkeresés 1. helyre a *"GONDOLJA VÉGIG HIGGADTAN - Árkedvezmények"* találatot hozta, míg a
teljes pipeline (HyDE + rerank) 1. helyre a *"Apró lépésekkel az élelmiszerpazarlás csökkentéséért!"*
találatot tette. Ez jellemzően azt jelenti, hogy a nyers vektorkeresés egy
témában rokon, de a kérdésre nem közvetlenül válaszoló chunk-ot rangsorolt
elsőre, a rerank pedig egy kereszt-encoderrel a kérdés és a chunk tényleges
tartalmi illeszkedését nézve javította ezt - nem csak a vektortér-közelséget.
(A további átrendezett kérdéseket lásd az összesítő táblában és az egyes
szekciókban fent.)

## Miért nem rendezett át semmit 3 kérdésnél (q1-datum-cimke, q7-lejart-termek-jogok, q8-akcio-tisztesseges)

Ezeknél a kérdéseknél a nyers keresés 1. helyezettje és a teljes pipeline 1.
helyezettje megegyezett. Ennek oka feltehetően az, hogy a legjobban illeszkedő
chunk embedding-távolság alapján is már egyértelműen kiugró volt a többi
jelölthöz képest (nincs "közeli verseny" a top pozícióért) - ilyenkor a rerank
nem *ront*, csak megerősíti a már helyes sorrendet. Ez önmagában is releváns
eredmény: azt mutatja, hogy a rerank nem véletlenszerűen kever, hanem ott
avatkozik be, ahol a nyers vektor-hasonlóság félrevezető.

## Negatív teszt eredménye

Mind a(z) 2 negatív teszt kérdésnél (q9-keszlet-negativ, q10-nutriscore-negativ) a teljes pipeline `belowThreshold: true`-t adott vissza, üres chunk-listával - a rendszer nem kényszerült arra, hogy a leggyengébb találatokból összetákoljon egy válasz-látszatot. Élesben az agent ennek megfelelően explicit kimondja, hogy nincs erre megbízható forrás a tudásbázisban, ahelyett hogy kitalálna egy választ - ez a grounding tényleges próbája, nem csak egy be nem tartott prompt-szabály.
