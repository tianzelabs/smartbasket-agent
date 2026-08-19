# SmartBasket - ügyfél-forduló PoC: business case

*kb. 5 perces bemutatóhoz a vezetői körnek. A technikai részletekhez lásd a [`README.md`](../README.md)-t, a [`demo-transcript.md`](demo-transcript.md)-t és a [`questions.md`](questions.md)-t.*

---

## 1. dia - A helyzet

Eddig a SmartBasket a szervezeten belül dolgozott: a kollégák kérdezték, hol olcsóbb egy termék, és mit érdemes venni ([`docs/roi.md`](roi.md): egy 5 fős iroda konkrét megtakarítása). A vezetői kör kérdése: mit kapnak ebből **az ügyfeleink**?

Ez a PoC két, a cégvezető által megnevezett fájdalmat old meg:

- **#1 - "Az ügyfeleink munkaidőn kívül nem kapnak választ"** - a rendszer bármikor elérhető, nem kell hozzá ügyeletes kolléga.
- **#2 - "Ugyanazokat a kérdéseket válaszoljuk meg naponta százszor"** - az ár- és vásárlási tanácsadási kérdések nagy része önkiszolgálóvá válik, a kollégák csak azzal foglalkoznak, amihez tényleg ember kell.

Amit **nem** old meg, lásd 6. dia - ott is elmondjuk, miért nem.

---

## 2. dia - Mit mutat a PoC

Három élő beszélgetés, valós, mai adaton (nem előre begyakorolt forgatókönyv - teljes jegyzőkönyv: [`docs/demo-transcript.md`](demo-transcript.md)):

| Az ügyfél kérdése | Mit kapott |
|---|---|
| "Hol a legolcsóbb a Dove testápoló?" | Azonnali, aznapi hivatalos ár, üzletlánconként |
| "Milyen hőmérsékleten tartsam a hűtőt?" | Szakértői tanács, hivatalos forrás megjelölésével |
| "Reklamálni szeretnék, romlott terméket kaptam" | A rendszer **nem próbált a helyünkben dönteni** - azonnal jelezte egy kollégának, hogy itt emberi ügyintézés kell, és ezt az ügyfélnek is megmondta |

A harmadik eset a lényeg: amikor a kérdés nem az övé, a rendszer nem hazudik és nem próbálkozik - szól. Ez élőben is látszik a demón: abban a pillanatban, hogy felismeri a panaszt, a kollégának egy jól látható jelzés jelenik meg a képernyőn.

---

## 3. dia - Adattérkép (teljes)

| Mi | Kihez/hova kerül | Mikor | Kimegy-e a házon kívülre? |
|---|---|---|---|
| Az ügyfél kérdésének teljes szövege | Anthropic (a válaszadó AI-modell szolgáltatója, USA) | minden kérdésnél | **Igen** |
| Az ügyfél kérdése (tanácsadó kérdéseknél) | Cohere (a tudásbázis-keresést végző második szolgáltató) | csak vásárlási tanácsot kérő kérdéseknél | **Igen** - külön szolgáltató, külön hívás |
| A napi hivatalos árlista (GVH Árfigyelő) | Internetről a saját, helyi adatbázisunkba | naponta egyszer | Nem releváns - ez nyilvános, nem ügyfél-adat |
| A termékkatalógus és a tanácsadó tudásbázis | csak a saját szerverünkön | folyamatosan | **Nem** - sosem küldjük ki, csak olvassuk belőle a választ |
| Minden kérdés, válasz és a hozzá tartozó technikai részletek | saját belső naplófájlba | minden kérdésnél | **Nem** - de erre a szövegre ma nincs adatvédelmi szűrés vagy megőrzési szabály (lásd 7. dia) |
| Az emberi kollégának szóló jelzés (kérdés + indoklás) | saját belső naplófájlba + azonnali képernyő-jelzés | ha embert kell bevonni | **Nem** - de ma csak azt éri el, aki éppen az adott gépernyőt nézi, nincs önálló értesítő csatorna (pl. Slack, e-mail) |

**Amit sosem küldünk ki:** a rendszer hozzáférési adatait, és a nyers adatbázis-táblákat - ezekhez az AI-modell sosem fér hozzá közvetlenül. **Amit a rendszer ma nem is ismer:** ügyfél-azonosítót, fiókadatot, korábbi rendelést - ilyen adatot ma nem tárolunk, tehát az sem szivároghat ki.

---

## 4. dia - Rollout terv

1. **Pilot**: egy ügyfélcsatorna mögé kötve (pl. a webshop chat-ablaka), korlátozott, önkéntes ügyfélkörön, 2-4 hét. A döntéshozó logika ma is teljesen független attól, hogy a kérdés terminálból vagy egy weboldalról érkezik - tehát ez egy felület hozzáadása, nem a rendszer újraépítése.
2. **Döntési pont**: pilot után - ha az eszkalációs arány és a hibaarány stabil (lásd [`docs/measurement-plan.md`](measurement-plan.md)), és a kollégák visszaigazolják, hogy az emberhez irányított esetek indoklása értelmes, nem félrevezető. Konkrét küszöbszámot még nem tűztünk ki - ez a pilot egyik célja.
3. **Teljes bevezetés**: csak azután, hogy a mai "naplózás + képernyő-jelzés" megoldás egy valódi, önálló értesítő csatornára vált (pl. Slack, e-mail, ügyfélszolgálati rendszer) - enélkül a "gyors emberi segítség" ígérete csak addig tart, amíg valaki éppen odanéz.
4. **Owner go-live után**: az ügyfélszolgálat vezetője - ő kapja a mérési terv riportjait is.

---

## 5. dia - Mérési terv (összefoglaló)

Teljes tábla: [`docs/measurement-plan.md`](measurement-plan.md). Minden sor a rendszer ma is meglévő naplózásából számolható - egyik sem elméleti, jövőbeli mérőszám.

- **Válaszidő**: a 3 bemutatott kérdésen 10-18 másodperc között - a tanácsadási kérdések érezhetően lassabbak, mint a tiszta ár-kérdések.
- **Eszkalációs arány** (hány kérdésnél kellett emberhez fordulni): azt méri, mikor *bizonytalan* a rendszer - nem csak a sikeres eseteket számoljuk.
- **Hibaarány** (tényleges technikai hiba, nem eszkaláció): külön mérőszám, hogy lássuk, mikor *téved* a rendszer, nem csak mikor *nem tud* válaszolni.
- **Költség kérdésenként**: a felhasznált AI-szolgáltatások díjszabása alapján.
- Két mérőszám még **hiányzik** és be kell építeni (ügyfél-elégedettség visszajelzés, a kollégák tényleges időmegtakarítása) - ezekhez ma nincs adatforrásunk, ezt nyíltan jelezzük is.

---

## 6. dia - Mit nem old meg ez a PoC

A rendszer ma **semmit nem tud az ügyfeleink kilétéről, rendeléseiről vagy korábbi ügyeiről** - nincs ilyen adat a rendszerben. Emiatt tudatosan **nem** oldja meg:

- **#3** - az új ügyfél elveszettség-érzését (nincs onboarding-folyamat)
- **#4** - "hol tart az ügyem" kérdést (nincs ügy-nyilvántartás)
- **#7** - a szerződéskötési papírmunkát
- **#8** - a sürgősség szerinti sorban állást (a rendszer ma nem priorizál)
- **#10** - az elvándorlás-előrejelzést (nincs történeti ügyfél-adat, amiből tanulni lehetne)

Az emberi jóváhagyási pont ma **naplózás + azonnali képernyő-jelzés**, nem valódi ügyfélszolgálati integráció - ez a legfontosabb darab, amit teljes bevezetés előtt hozzá kell építeni.

---

## 7. dia - Kockázatok és zárókérdés

Két dolog, ami a demón kényes kérdés lehet ([`docs/questions.md`](questions.md)-ban részletesen):

1. **Az ügyfél follow-up kérdése ma nem kapcsolódik automatikusan az előzőhöz** - minden kérdést a rendszer önálló, előzmény nélküli beszélgetésként kezel. Ha valaki rákérdez "és mennyibe kerül, ha ezt is hozzáadom?", a rendszer nem fogja tudni, mire gondol.
2. **Az, hogy egy kérdés emberi beavatkozást igényel-e, a rendszer saját mérlegelésén múlik** - nincs kőbe vésett szabálylista, ami garantálná, hogy minden panasz vagy kényes eset ténylegesen eljut egy kollégához.

**Kérdés a vezetői körnek**: a pilot költségvetése elég-e ahhoz, hogy a mai naplózás+képernyő-jelzés megoldásból egy valódi, önálló ügyfélszolgálati integrációra váltsunk, mielőtt teljes bevezetésre kerül sor - enélkül a "gyors emberi segítség" ígérete csak annyit ér, amennyire gyakran néz oda valaki?
