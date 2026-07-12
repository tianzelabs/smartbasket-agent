# SmartBasket Agent – ROI-levezetés egy 5 fős irodára

> A cél: számokkal alátámasztani, hogy egy 5 fős iroda mennyit takarít meg azzal, ha a heti bevásárlás előtti árösszehasonlítást a SmartBasket Agent CLI-vel végzi el, ahelyett hogy manuálisan nyitogatná a Tesco/Lidl/Aldi/Spar/Rossmann alkalmazásokat vagy szórólapokat.
>
> Minden feltételezés **külön van jelölve és állítható** - a levezetés célja a módszertan bemutatása, nem egy vitathatatlan "hivatalos" szám. A modellárazás valós, jelenlegi (2026-07-12) Anthropic API listaár; a token-számok a projekt saját, éles teszteiből származnak (lásd `docs/proposal-implementacio.md` B3 szakasz).

---

## 1. A megtakarítás forrása

Bevásárlás előtt sok háztartás (vagy iroda, ami maga vásárol be irodai/konyhai kellékeket) manuálisan hasonlítja össze az árakat több üzletlánc alkalmazásában/szórólapjában, hogy eldöntse, hol érdemes vásárolni. A SmartBasket ezt egyetlen természetes nyelvű kérdéssé egyszerűsíti.

**Időmegtakarítás** = (manuális összehasonlítás ideje) − (SmartBasket-tel eltöltött idő).

Ez a levezetés **kizárólag** ezt az időmegtakarítást számolja el pénzben. A ténylegesen olcsóbb boltban vásárlásból eredő közvetlen pénzügyi megtakarítást (5. pont) szándékosan **nem** építjük be a fő számba, hogy a levezetés konzervatív maradjon.

---

## 2. Feltételezések (állítható paraméterek)

| Paraméter                                       | Érték                                                                | Forrás/indoklás                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Iroda mérete                                    | 5 fő                                                                 | a feladat előírása                                                                                                      |
| Bevásárlás gyakorisága                          | heti 1 alkalom / fő                                                  | tipikus háztartási/irodai ritmus                                                                                        |
| Kérdések száma alkalmanként                     | 5 kérdés (pl. 5 különböző termékkategória ára)                       | konzervatív becslés                                                                                                     |
| Manuális összehasonlítás ideje                  | **10 / 13 / 18 perc / hét / fő** (konzervatív / közepes / optimista) | több üzletlánc app/szórólap átnézése, termékenként                                                                      |
| SmartBasket-tel eltöltött idő                   | **2 perc / hét / fő**                                                | 5 kérdés begépelése + válasz elolvasása; a valós teszteinkben a válaszidő 4,4-14,6 másodperc/kérdés volt (lásd 3. pont) |
| Órabér (teljes, munkáltatói költséggel terhelt) | **5000 / 6000 / 7500 HUF/óra** (konzervatív / közepes / optimista)   | állítható paraméter - illessze a saját szervezetéhez                                                                    |
| Bevezetési idő (egyszeri)                       | 2 óra / fő                                                           | telepítés, `.env` beállítás, első kipróbálás                                                                            |

---

## 3. Az AI-hívások tényleges költsége (valós adatokból)

A `claude-sonnet-5` modell jelenlegi (2026-07-12) listaára: **$3,00 / millió input token, $15,00 / millió output token** (bevezető ár 2026-08-31-ig: $2,00 / $10,00 - a levezetés a magasabb, tartós listaárral számol, hogy konzervatív maradjon).

A B3 fázis éles tesztjeiből (valós Anthropic API-hívások, valós GVH-adaton) mért tényleges token-felhasználás:

| Kérdés                                                     | Bemeneti token | Kimeneti token | API-hívások (tool loop) |
| ---------------------------------------------------------- | -------------- | -------------- | ----------------------- |
| "Hol a legolcsóbb a Dove testápoló?" (runSql-lel)          | ~1250          | ~200           | 2                       |
| "Milyen kategóriák érhetők el?" (listCategories-szel)      | ~1210          | ~170           | 2                       |
| "Hol a legolcsóbb a tej?" (nincs adat/DB-hozzáférés teszt) | 1210           | 169            | 1                       |

Egy tipikus, tool-hívást igénylő kérdés (a termék fő használati esete) ≈ **2500 bemeneti + 400 kimeneti token** két API-hívásban (a tool-use loop miatt: 1. hívás → tool_use, 2. hívás → végső válasz).

**Költség/kérdés:**

```
2500 × ($3,00 / 1 000 000) + 400 × ($15,00 / 1 000 000)
= $0,0075 + $0,006
= $0,0135 / kérdés  (≈ 4,9 Ft/kérdés, ~360 Ft/USD árfolyamon)
```

**Éves API-költség** (5 fő × 5 kérdés/hét × 52 hét = 1300 kérdés/év):

```
1300 × 4,9 Ft ≈ 6 400 Ft/év
```

Ez a projekt üzemeltetési költségének gyakorlatilag a teljes egésze - nincs szerver, nincs hosting, a CLI helyben fut, az egyetlen visszatérő költség az Anthropic API-hívás.

---

## 4. A számítás

```
Heti időmegtakarítás/fő = manuális idő − SmartBasket idő
Éves óra-megtakarítás   = 5 fő × heti megtakarítás (perc) × 52 hét / 60
Éves érték              = éves óra-megtakarítás × órabér
Nettó éves haszon        = éves érték − éves API-költség − egyszeri bevezetési költség (csak 1. évben)
```

| Forgatókönyv | Heti megtakarítás/fő |  Órabér | Éves óra-megtakarítás | Éves érték | Éves API-költség | Egyszeri bevezetés (5×2 óra) | **Nettó haszon (1. év)** |
| ------------ | -------------------: | ------: | --------------------: | ---------: | ---------------: | ---------------------------: | -----------------------: |
| Konzervatív  |               8 perc | 5000 Ft |              34,7 óra | 173 300 Ft |         6 400 Ft |                    50 000 Ft |           **116 900 Ft** |
| Közepes      |              11 perc | 6000 Ft |              47,7 óra | 286 000 Ft |         6 400 Ft |                    60 000 Ft |           **219 600 Ft** |
| Optimista    |              16 perc | 7500 Ft |              69,3 óra | 519 750 Ft |         6 400 Ft |                    75 000 Ft |           **438 350 Ft** |

_(a 2. évtől kezdve az egyszeri bevezetési költség elmarad, a nettó haszon a teljes éves értékkel egyenlő a csekély API-költség levonása után)_

**Megtérülési idő** (közepes forgatókönyv): a heti érték ≈ 286 000 / 52 ≈ 5500 Ft/hét, az egyszeri bevezetési költség (60 000 Ft) ≈ **11 hét (kb. 2,5 hónap)** alatt térül meg.

---

## 5. Nem számolt, további haszon (upside, nincs a fenti számban)

A fenti levezetés **kizárólag az időmegtakarítást** számolja el. Emellett a ténylegesen olcsóbb üzletláncban való vásárlás közvetlen pénzügyi megtakarítást is hoz - ezt szándékosan nem építettük a fő számba, mert termékenként/családonként nagyon eltérő, de irányadó példaként:

- Ha egy 5 fős iroda összesen kb. 50 000 Ft/hét élelmiszer- és drogéria-jellegű kiadást hasonlít össze, és a SmartBasket segítségével átlagosan csak **5%-kal** olcsóbb üzletláncban vásárol (a GVH Árfigyelő nyilvános adatai szerint azonos termékek ára üzletláncok között gyakran ennél nagyobb mértékben is szór),
- az **évi 50 000 × 0,05 × 52 ≈ 130 000 Ft** további, valós pénzbeli megtakarítás - a fenti időmegtakarítási számon **felül**.

---

## 6. Összefoglalás

|                                                                      | Érték                                            |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| Éves API-üzemeltetési költség                                        | ~6 400 Ft (elhanyagolható)                       |
| Nettó éves haszon (közepes forgatókönyv, 1. év, bevezetéssel együtt) | ~220 000 Ft                                      |
| Nettó éves haszon (2. évtől)                                         | ~280 000 Ft                                      |
| Megtérülési idő                                                      | ~2,5 hónap                                       |
| Nem számolt további upside                                           | akár +130 000 Ft/év (tényleges olcsóbb vásárlás) |

Az üzemeltetési költség (~6 400 Ft/év) nagyságrendekkel kisebb, mint a megtakarított munkaidő értéke bármelyik forgatókönyvben - az AI-hívások költsége gyakorlatilag elhanyagolható egy időt megtakarító eszköz esetén, még konzervatív feltételezésekkel is.
