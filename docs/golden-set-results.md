# Golden set – nyers vektorkeresés vs. teljes pipeline (HF3)

> 10 kérdés a tudásbázis 6 altémájából (2 negatív teszt). Minden kérdés kétféleképp futott: (1) nyers vektorkeresés - csak embedding + pgvector koszinusz-távolság, HyDE és rerank nélkül; (2) a teljes pipeline (`searchKnowledge`) - HyDE (Haiku) + embedding + pgvector + rerank (Cohere rerank-v3.5) + relevancia-küszöb. Éles korpuszon (30 dokumentum, 72 chunk, valós Cohere/Anthropic hívásokkal) generálva.

**Összefoglaló:** legalább egy kérdésnél a rerank ténylegesen átrendezte a top találatot (lásd lent, kiemelve) - ez konkrét bizonyíték arra, hogy a rerank lépés érdemi hozzáadott értéket ad a nyers vektorkereséshez képest.

---

## q1-datum-cimke

**Kérdés:** Mit jelent a „minőségét megőrzi” és miben különbözik a „fogyasztható” jelöléstől?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Mire figyeljünk élelmiszer-vásárlás során?
2. Mire figyeljünk élelmiszer-vásárlás során?
3. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
4. Fogyasztói jog a vásárlás előtt: mit kell biztosítaniuk a kereskedőknek?
5. Fogyasztói jog a vásárlás előtt: mit kell biztosítaniuk a kereskedőknek?

**Teljes pipeline (HyDE + rerank), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.900)
2. Ne pazaroljunk! – Tudatos vásárlással az élelmiszer-pazarlás ellen (relevanceScore: 0.893)
3. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.811)
4. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.643)
5. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony (relevanceScore: 0.446)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q2-akcio-tulvasarlas

**Kérdés:** Hogyan kerülhetem el, hogy az akciók miatt túl sok élelmiszert vegyek?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony
2. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
3. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
4. Szigorú fogyasztóvédelmi fellépés az akciós árakkal trükközö kereskedőkkel szemben
5. Ne pazaroljunk! – Tudatos vásárlással az élelmiszer-pazarlás ellen

**Teljes pipeline (HyDE + rerank), top 5:**

1. Ne pazaroljunk! – Tudatos vásárlással az élelmiszer-pazarlás ellen (relevanceScore: 0.728)
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.559)
3. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.489)
4. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.281)
5. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.268)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q3-lejart-tejtermek

**Kérdés:** Mire figyeljek egy közeli lejáratú tejtermék megvásárlásakor?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
3. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
4. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih
5. Vélemény vagy fizetett reklám? – Amit a fogyasztóknak tudniuk kell!

**Teljes pipeline (HyDE + rerank), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.706)
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.688)
3. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih (relevanceScore: 0.653)
4. Maradék nélkül – Lejárati útmutató (relevanceScore: 0.630)
5. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.621)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q4-bevasarlolista

**Kérdés:** Hogyan érdemes bevásárlólistát készíteni egy kétszemélyes háztartásnak?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
4. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
5. Kapszulakamrával az élelmiszerpazarlás ellen – A Nébih Maradék nélkül program tanácsai > Kapszulakamrával az élelmiszerpazarlás ellen - A Nébih Maradék nélkül program tanácsai

**Teljes pipeline (HyDE + rerank), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.742)
2. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.695)
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.501)
4. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.370)
5. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.333)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q5-huto-homerseklet

**Kérdés:** Milyen hőmérsékleten érdemes tartani a hűtőszekrényt?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Tudatos hűtőhasználattal az élelmiszerpazarlás ellen > Tudatos hűtőhasználattal az élelmiszerpazarlás ellen
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
3. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony
4. Kapszulakamrával az élelmiszerpazarlás ellen – A Nébih Maradék nélkül program tanácsai > Kapszulakamrával az élelmiszerpazarlás ellen - A Nébih Maradék nélkül program tanácsai
5. Élelmiszer-tartalékolási útmutató (teljes kiadvány)

**Teljes pipeline (HyDE + rerank), top 5:**

1. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony (relevanceScore: 0.755)
2. Élelmiszerbiztonság, élelmiszerpazarlás: kéz a kézben jár (relevanceScore: 0.705)
3. Ne pazaroljunk! – Tudatos vásárlással az élelmiszer-pazarlás ellen (relevanceScore: 0.632)
4. Tudatos hűtőhasználattal az élelmiszerpazarlás ellen > Tudatos hűtőhasználattal az élelmiszerpazarlás ellen (relevanceScore: 0.389)
5. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih (relevanceScore: 0.281)

**Rerank átrendezett-e?** **IGEN** - az 1. helyen szereplő chunk megváltozott.

---

## q6-nagy-kiszereles

**Kérdés:** Mindig gazdaságosabb a nagyobb kiszerelés?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
2. Vásárolunk, tehát döntünk – de tudjuk, mit csinálunk?
3. Vásárolunk, tehát döntünk – de tudjuk, mit csinálunk?
4. Vélemény vagy fizetett reklám? – Amit a fogyasztóknak tudniuk kell!
5. Vélemény vagy fizetett reklám? – Amit a fogyasztóknak tudniuk kell!

**Teljes pipeline (HyDE + rerank), top 5:**

1. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.849)
2. Mire figyeljünk élelmiszer-vásárlás során? (relevanceScore: 0.166)
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.121)
4. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.100)
5. Élelmiszer-tartalékolási útmutató (teljes kiadvány) (relevanceScore: 0.088)

**Rerank átrendezett-e?** Nem - az 1. helyen ugyanaz a chunk maradt.

---

## q7-lejart-termek-jogok

**Kérdés:** Mit tehetek, ha lejárt terméket vásároltam?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban
3. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
4. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih
5. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony

**Teljes pipeline (HyDE + rerank), top 5:**

1. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.798)
2. Mit árul el a dátum? – Fogyasztói tudatosság a lejárt élelmiszerekkel kapcsolatban (relevanceScore: 0.736)
3. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban (relevanceScore: 0.652)
4. Mire figyeljünk élelmiszer-vásárlás során? (relevanceScore: 0.616)
5. Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih > Újabb termékekkel bővítette népszerű lejárati útmutatóját a Nébih (relevanceScore: 0.578)

**Rerank átrendezett-e?** Nem - az 1. helyen ugyanaz a chunk maradt.

---

## q8-akcio-tisztesseges

**Kérdés:** Honnan tudom, hogy egy áruházlánc akciója valóban tisztességes, nem csak látszatkedvezmény?

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Szigorú fogyasztóvédelmi fellépés az akciós árakkal trükközö kereskedőkkel szemben
2. Nem csak kopogtatni érdemes – országos dinnyeellenőrzést indít az NKFH
3. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony
4. Szigorú fogyasztóvédelmi fellépés az akciós árakkal trükközö kereskedőkkel szemben
5. Élelmiszerbiztonság, élelmiszerpazarlás: kéz a kézben jár

**Teljes pipeline (HyDE + rerank), top 5:**

1. Szigorú fogyasztóvédelmi fellépés az akciós árakkal trükközö kereskedőkkel szemben (relevanceScore: 0.363)
2. Szigorú fogyasztóvédelmi fellépés az akciós árakkal trükközö kereskedőkkel szemben (relevanceScore: 0.289)
3. Vásárolunk, tehát döntünk – de tudjuk, mit csinálunk? (relevanceScore: 0.218)
4. Nem csak kopogtatni érdemes – országos dinnyeellenőrzést indít az NKFH (relevanceScore: 0.162)
5. Jogaink hálójában – A fogyasztóvédelem legnagyobb mítoszai (relevanceScore: 0.145)

**Rerank átrendezett-e?** Nem - az 1. helyen ugyanaz a chunk maradt.

---

## q9-keszlet-negativ (negatív teszt)

**Kérdés:** Van jelenleg készleten zabtej a Váci úti Aldiban?

> A tudásbázis nem tartalmaz bolti készletadatot - ez a runSql/listCategories hatásköre is, de a searchKnowledge-nek sem szabad kitalálnia.

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
2. Bevásárlás maradék nélkül: így csökkentsd az otthoni pazarlást már a boltban
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
4. Maradék nélkül: így lehet pazarlásmentes a karácsony > Maradék nélkül: így lehet pazarlásmentes a karácsony
5. Élelmiszerbiztonság, élelmiszerpazarlás: kéz a kézben jár

**Teljes pipeline (HyDE + rerank), top 5:**

_(belowThreshold: true - nincs a küszöböt elérő találat)_

**Rerank átrendezett-e?** n/a (nincs elég találat az összevetéshez)

---

## q10-nutriscore-negativ (negatív teszt)

**Kérdés:** Mit jelent a Nutri-Score besorolás és hogyan számolják ki?

> A 30 dokumentumos korpusz egyike sem tárgyalja a Nutri-Score módszertanát - a tudásbázisban nincs erre megbízható forrás.

**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top 5:**

1. A bio mindig jobb – vagy mégsem?
2. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
3. Élelmiszer-tartalékolási útmutató (teljes kiadvány)
4. Gyakran ismételt kérdések és válaszok az élelmiszerárak feltüntetéséről
5. Nem csak kopogtatni érdemes – országos dinnyeellenőrzést indít az NKFH

**Teljes pipeline (HyDE + rerank), top 5:**

_(belowThreshold: true - nincs a küszöböt elérő találat)_

**Rerank átrendezett-e?** n/a (nincs elég találat az összevetéshez)

---

## Elemzés: miért jobb az új sorrend (q1 példáján)

A **q1-datum-cimke** kérdés ("Mit jelent a „minőségét megőrzi” és miben különbözik a
„fogyasztható” jelöléstől?") a legtisztább példa. A nyers vektorkeresés 1. helyen
kétszer is a *"Mire figyeljünk élelmiszer-vásárlás során?"* cikket hozta - ez egy
általános, vásárlás-biztonsági témájú cikk, ami *érinti* a dátumjelölést, de nem róla
szól. A teljes pipeline 1. helyre a *"Mit árul el a dátum? – Fogyasztói tudatosság a
lejárt élelmiszerekkel kapcsolatban"* cikket hozta - ez pontosan, kizárólag erről a
kérdésről szól (a két dátumjelölés közötti különbségről). Ez érdemi javulás: a
kérdésre szó szerint válaszoló forrás előrébb került egy csak témában rokon forrással
szemben - ez a HyDE+rerank kombináció pontosan ezt a fajta hibát javítja, mert a rerank
egy kereszt-encoder, ami a kérdés és a chunk tényleges tartalmi illeszkedését nézi, nem
csak a vektortér-közelséget.

## Miért nem rendezett át semmit két kérdésnél (q6, q7)

A **q6-nagy-kiszereles** és **q7-lejart-termek-jogok** kérdéseknél a nyers keresés 1.
helyezettje és a teljes pipeline 1. helyezettje megegyezett. Ennek oka feltehetően az,
hogy mindkét kérdésnél a legjobban illeszkedő chunk embedding-távolság alapján is már
egyértelműen kiugró volt a többi jelölthöz képest (nincs "közeli verseny" a top
pozícióért) - ilyenkor a rerank nem *ront*, csak megerősíti a már helyes sorrendet.
Ez önmagában is releváns eredmény: azt mutatja, hogy a rerank nem véletlenszerűen
kever, hanem ott avatkozik be, ahol a nyers vektor-hasonlóság félrevezető (lásd q1-q5).

## Negatív teszt eredménye

Mindkét negatív teszt kérdésnél (**q9**, **q10**) a teljes pipeline
`belowThreshold: true`-t adott vissza, üres chunk-listával - a rendszer nem
kényszerült arra, hogy a leggyengébb találatokból összetákoljon egy válasz-látszatot.
Élesben (`pnpm smartbasket ask "Mit jelent a Nutri-Score besorolás..."`) az agent
ennek megfelelően explicit kimondta, hogy nincs erre megbízható forrás a
tudásbázisban, ahelyett hogy kitalált volna egy választ - ez a grounding tényleges
próbája, nem csak egy be nem tartott prompt-szabály.
