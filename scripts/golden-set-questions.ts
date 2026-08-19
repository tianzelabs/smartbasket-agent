export interface GoldenSetQuestion {
  id: string;
  question: string;
  isNegativeTest: boolean;
  note?: string;
}

// A HF3 golden set: 10 kérdés a tudásbázis 6 altémájából + 2 negatív teszt
// (docs/golden-set-results.md dokumentálja a kiértékelést).
export const GOLDEN_SET: GoldenSetQuestion[] = [
  {
    id: 'q1-datum-cimke',
    question:
      'Mit jelent a „minőségét megőrzi” és miben különbözik a „fogyasztható” jelöléstől?',
    isNegativeTest: false,
  },
  {
    id: 'q2-akcio-tulvasarlas',
    question: 'Hogyan kerülhetem el, hogy az akciók miatt túl sok élelmiszert vegyek?',
    isNegativeTest: false,
  },
  {
    id: 'q3-lejart-tejtermek',
    question: 'Mire figyeljek egy közeli lejáratú tejtermék megvásárlásakor?',
    isNegativeTest: false,
  },
  {
    id: 'q4-bevasarlolista',
    question: 'Hogyan érdemes bevásárlólistát készíteni egy kétszemélyes háztartásnak?',
    isNegativeTest: false,
  },
  {
    id: 'q5-huto-homerseklet',
    question: 'Milyen hőmérsékleten érdemes tartani a hűtőszekrényt?',
    isNegativeTest: false,
  },
  {
    id: 'q6-nagy-kiszereles',
    question: 'Mindig gazdaságosabb a nagyobb kiszerelés?',
    isNegativeTest: false,
  },
  {
    id: 'q7-lejart-termek-jogok',
    question: 'Mit tehetek, ha lejárt terméket vásároltam?',
    isNegativeTest: false,
  },
  {
    id: 'q8-akcio-tisztesseges',
    question: 'Honnan tudom, hogy egy áruházlánc akciója valóban tisztességes, nem csak látszatkedvezmény?',
    isNegativeTest: false,
  },
  {
    id: 'q9-keszlet-negativ',
    question: 'Van jelenleg készleten zabtej a Váci úti Aldiban?',
    isNegativeTest: true,
    note: 'A tudásbázis nem tartalmaz bolti készletadatot - ez a runSql/listCategories hatásköre is, de a searchKnowledge-nek sem szabad kitalálnia.',
  },
  {
    id: 'q10-nutriscore-negativ',
    question: 'Mit jelent a Nutri-Score besorolás és hogyan számolják ki?',
    isNegativeTest: true,
    note: 'A korpusz egyike sem tárgyalja a Nutri-Score módszertanát - a tudásbázisban nincs erre megbízható forrás.',
  },
];
