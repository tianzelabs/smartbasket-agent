import { describe, expect, it } from 'vitest';
import { extractHtmlBlocks } from './extract-html-blocks.js';

// A Readability cikk-felismeréshez kellő hosszúságú, "valódi cikk"-szerű HTML
// kell (rövid próba-snippetnél a Readability nem ismeri fel tartalomnak) -
// ezért a törzs bekezdései szándékosan hosszabbak.
const ARTICLE_HTML = `
<html>
  <head><title>Teszt cikk</title></head>
  <body>
    <nav><a href="/">Főoldal</a><a href="/rolunk">Rólunk</a></nav>
    <article>
      <h1>Tudatos vásárlás otthon</h1>
      <p>Ez a bevezető bekezdés, ami elmagyarázza, miért fontos a tudatos
      vásárlás a mindennapi háztartási kiadások szempontjából, és hogyan
      segíthet elkerülni a felesleges pazarlást a hétköznapokban.</p>
      <h2>Tervezés</h2>
      <p>Készíts heti menütervet és bevásárlólistát, mielőtt elindulsz a
      boltba, mert ez segít elkerülni az impulzusvásárlásokat és azt, hogy
      olyan termékeket vegyél, amikre valójában nincs is szükséged.</p>
      <ul>
        <li>Nézd át előbb, mi van otthon a hűtőben és a kamrában.</li>
        <li>Csak annyit vegyél, amennyit ténylegesen el is fogyasztotok.</li>
      </ul>
      <h3>Akciók</h3>
      <p>Egy akció csak akkor éri meg, ha a termék ténylegesen elfogy, mielőtt
      lejárna, különben a "spórolás" valójában pazarlássá válik.</p>
    </article>
    <footer>Copyright 2026 - minden jog fenntartva.</footer>
  </body>
</html>
`;

// A portal.nebih.gov.hu sablonon reprodukált eset: a cikk (col-md-8) mellett,
// UGYANABBAN a szülő row-ban egy "Friss hírek" doboz (col-md-4) áll, teljesen
// más témájú teaser-cikkekkel - a Readability néhány rövidebb törzsű oldalon
// ezt is a cikk részének ítéli.
const ARTICLE_WITH_SIDEBAR_HTML = `
<html>
  <head><title>Teszt cikk</title></head>
  <body>
    <div class="row">
      <div class="col-md-8">
        <article>
          <h1>Tudatos hűtőhasználattal az élelmiszerpazarlás ellen</h1>
          <p>Ez a bevezető bekezdés arról szól, hogyan érdemes a hűtőszekrényt
          berendezni és milyen hőmérsékleten tartani, hogy minél tovább
          eltarthatók legyenek benne az élelmiszerek anélkül, hogy megromlanának.</p>
          <h2>Tárolási tippek</h2>
          <p>Tartsd a nyers húst mindig a hűtő alsó polcán, hogy a leve ne
          csepegjen rá a többi élelmiszerre, és rendszeresen ellenőrizd a
          lejárati dátumokat, mielőtt új adagot vásárolnál.</p>
        </article>
      </div>
      <div class="col-md-4">
        <h2 class="news-title-display-page">Friss hírek</h2>
        <div class="nebih-article-small">
          <article class="article-small">
            <h2>Újabb Baranya vármegyei házisertés-állományban jelent meg az afrikai sertéspestis</h2>
            <p class="lead">A Nébih laboratóriuma ismét megerősítette az afrikai
            sertéspestis vírus jelenlétét egy Baranya vármegyei
            házisertés-állományban.</p>
          </article>
        </div>
      </div>
    </div>
    <footer>Copyright 2026 - minden jog fenntartva.</footer>
  </body>
</html>
`;

describe('extractHtmlBlocks', () => {
  it('strips the portal.nebih.gov.hu "Friss hírek" sidebar widget, keeping only the real article', () => {
    const blocks = extractHtmlBlocks(ARTICLE_WITH_SIDEBAR_HTML, 'https://portal.nebih.gov.hu/-/teszt');
    const allText = blocks.map((block) => block.text).join(' ');

    expect(allText).not.toContain('Friss hírek');
    expect(allText).not.toContain('sertéspestis');
    expect(allText).toContain('Tárolási tippek');
  });


  it('strips navigation and footer noise, keeping only the article body', () => {
    const blocks = extractHtmlBlocks(ARTICLE_HTML, 'https://example.com/cikk');
    const allText = blocks.map((block) => block.text).join(' ');

    expect(allText).not.toContain('Főoldal');
    expect(allText).not.toContain('Copyright 2026');
  });

  it('assigns heading levels to H2/H3 and level 0 to paragraphs/list items', () => {
    const blocks = extractHtmlBlocks(ARTICLE_HTML, 'https://example.com/cikk');

    const h2 = blocks.find((block) => block.text === 'Tervezés');
    const h3 = blocks.find((block) => block.text === 'Akciók');
    const listItem = blocks.find((block) =>
      block.text.startsWith('Nézd át előbb'),
    );

    expect(h2?.level).toBe(2);
    expect(h3?.level).toBe(3);
    expect(listItem?.isListItem).toBe(true);
    expect(listItem?.level).toBe(0);
  });

  it('throws a human-readable error when there is no readable content', () => {
    expect(() =>
      extractHtmlBlocks('<html><body><nav>x</nav></body></html>', 'https://example.com/empty'),
    ).toThrow(/Nem sikerült kinyerni/);
  });
});
