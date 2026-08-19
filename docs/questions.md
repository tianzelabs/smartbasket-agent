# Kérdéslap (HF5) - felkészülés a kötekedőkre

A hat kapott kérdés és a két saját kérdés, egy-egy bekezdésnyi válasszal. Minden
válasz a saját PoC-ra mutat, nem általánosságokra - a hivatkozott fájlok a
repóban ellenőrizhetők.

## 1. Milyen személyes adat kerül a rendszerbe, és melyik pontján tűnik el vagy anonimizálódik?

Ma gyakorlatilag nincs explicit személyes adat modell: a séma (`products`,
`knowledge_documents`/`knowledge_chunks`) nem tartalmaz customer/account/order
entitást, a rendszer nem kér nevet, e-mailt vagy telefonszámot. Az egyetlen
"személyes" adat a felhasználó szabad szöveges kérdése, ami tartalmazhat
implicit információt (pl. "az én rendelésemmel van gond"). Ez a szöveg
nyersen megy tovább az Anthropic/Cohere API-khoz és íratlanul kerül a
`logs/*.jsonl`-be (`agent-log.ts`) - **anonimizálás vagy PII-szűrés ma nincs
beépítve**. Ez explicit, nyíltan vállalt hiányosság (lásd
[`business-case.md`](business-case.md) 6. dia, [`README.md`](../README.md)
"Mi nincs benne").

## 2. Hol fut a modell, hova utazik az adat, és mi az, ami sosem hagyja el a saját környezetünket?

A fő agent (Claude Sonnet 5) és a HyDE-lépés (Claude Haiku 4.5) Anthropic
felhőjében fut; a `searchKnowledge` embedding/rerank lépése (Cohere
`embed-v4.0`/`rerank-v3.5`) Cohere felhőjében. A kérdés szövege (és RAG esetén
a HyDE-generált hipotetikus válasz) mindkét esetben elhagyja a saját
környezetünket - ez minden `ask` hívásnál megtörténik, ha `searchKnowledge` is
fut, két külön szolgáltatóhoz. Amit **sosem** küldünk ki: a DB-kapcsolati
adatokat/credentialeket, és a nyers `products`/`knowledge_*` táblákat - az
agent kizárólag a `runSql` toolon és kizárólag a szemantikus `vw_*` view-kon
keresztül olvas, egy dedikált, DB-szerveren kikényszerített `SELECT`-only
Postgres-szerepkörrel (`db-readonly.ts`, `docs/db-migration-rationale.md`).

## 3. Melyik lépésnél hagy jóvá ember, mit lát a döntés előtt, és mit tud visszavonni utána?

Az egyetlen emberi jóváhagyási pont az `escalateToHuman` tool
(`packages/core/src/lib/tools/escalate/escalate-to-human-tool.ts`): ha a
rendszer bizonytalan (`searchKnowledge` `belowThreshold: true`) vagy panaszt/
reklamációt észlel, az agent nem ad végleges választ, hanem egy rekordot ír
(kérdés + a modell saját indoklása, miért nem tudta megválaszolni) a
`logs/escalations.jsonl`-be, ÉS a CLI azonnal egy 🔔 figyelmeztetést ír
stderr-re (`alertOnEscalation()`, `apps/cli/src/main.ts`), majd ezt közli az
ügyfélnek. A kolléga ezt a teljes indoklást látja, mielőtt felveszi a
kapcsolatot - de csak akkor, ha épp azt a terminált nézi, ahol a CLI fut;
csatorna-független (Slack/e-mail/ticketing) értesítés még nincs. "Visszavonás" fogalma itt
korlátozottan értelmezhető: az agent maga sosem hajt végre visszafordíthatatlan
műveletet (csak olvas), tehát nincs mit visszavonni az AI oldalán - a
kolléga feladata a tényleges ügyintézés, amit a rendszer nem is próbál
automatizálni.

## 4. Mi kerül naplóba, ki fér hozzá, és mennyi ideig marad meg?

Minden `ask` hívás JSONL sort ír a `logs/` mappába (`agent-log.ts`):
időbélyeg, kérdés, teljes system prompt, válasz, modell, token-használat,
minden tool-hívás (input + eredmény), és a válaszidő. Hozzáférés: bárki, aki
fájlrendszer-szintű hozzáféréssel rendelkezik a szerverhez - **nincs külön
ACL/RBAC** a logokra. Megőrzés: **nincs retenciós/lejárati szabály** beépítve
ma - ez, a PII-szűrés hiányával együtt (1. kérdés), a legfontosabb
adatvédelmi rést jelentő pár a rendszerben.

## 5. Mi történik, ha az agent téved, és mennyi idő alatt állítható vissza az előző állapot?

Mivel az agent kizárólag olvas (négy független védelmi réteg: RO
Postgres-szerepkör, SQL-guard, `READ ONLY` tranzakció, `statement_timeout` -
`docs/db-migration-rationale.md`), adatíró hiba fogalmilag kizárt - "téved"
itt azt jelenti, hogy rossz vagy nem releváns választ ad. Erre a védőháló az
`escalateToHuman`: bizonytalanság esetén nem próbál találgatni. Az
árkatalógus adatkonzisztenciáját a napi import tranzakciós jellege védi
(`import-daily-dataset.ts`): egyetlen tranzakcióban töröl+ír, bármilyen hiba
esetén teljes rollback, az előző napi snapshot marad érvényben - tehát
adatszinten nincs "visszaállítási idő", mert soha nem kerül inkonzisztens
állapotba.

## 6. Ki lesz a rendszer gazdája a bevezetés után, és miből fogja látni, hogy jól működik?

Ez üzleti döntés, nem következik magából a kódból - a
[`business-case.md`](business-case.md) 4. diája az ügyfélszolgálat-vezetőt
javasolja mint owner, mivel a [`measurement-plan.md`](measurement-plan.md)
riportjainak (heti válaszidő/eszkalációs arány összesítő, havi vezetői dia)
is ő a fő címzettje - vagyis a mérés és a felelősség ugyanannál a szerepnél
fut össze.

---

## Saját kérdések (a legkényesebb pontok)

### 7. Ha egy ügyfél follow-up kérdést tesz fel, emlékszik rá a rendszer?

**Nem.** Az `askAgent()` minden hívásnál egy vadonatúj `messages` tömbbel
indul (`ask-agent.ts` 156-158. sor: `[{ role: 'user', content: question }]`)
- ez a CLI interaktív módjában is így van, soronként. Ha egy ügyfél rákérdez
"és mennyibe kerül összesen, ha ezt is hozzáadom?", a rendszer ezt önálló,
előzmény nélküli kérdésként kezeli, nem érti, mire vonatkozik a "ezt". Ez
ügyfél-forduló kontextusban komoly UX-korlát, amit a demón szándékosan nem
rejtünk el - ha a vezetői kör ilyet kérdez, ez a valós válasz, nem egy
kifogás.

### 8. Mennyire megbízható az eszkaláció triggere - mi van, ha egy panasz "átcsúszik"?

Az `escalateToHuman` hívása **nem kódban kikényszerített szabály**, hanem a
system prompt egy utasítása (`system-prompt.ts` `<rules>` szakasz), amit a
modell "belátása" szerint követ - nincs kulcsszó-lista vagy determinisztikus
osztályozó, ami garantálná, hogy minden panasz/reklamáció ténylegesen
eszkalálódik. A `searchKnowledge` `belowThreshold` ága determinisztikus (fix
relevancia-küszöb), de a "ez panasz, nem ár/tanács kérdés"
felismerés tisztán a modellre van bízva. Egy szokatlanul megfogalmazott,
dühös ügyfélkérdés elméletileg átcsúszhat, és az agent megpróbálhat rá
válaszolni ahelyett, hogy emberhez irányítana - ezt a golden set jellegű
teszteléssel (lásd `docs/golden-set-results.md` mintájára) érdemes lenne
szisztematikusan ellenőrizni a pilot előtt, ma ez nincs megtéve.
