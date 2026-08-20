export interface SeparableVerbData {
  infinitive: string;
  prefix: string;
  translationEn: string;
  translationRu: string;
  presentThirdPerson: string;
  simplePast: string;
  pastParticiple: string;
}

export const SEPARABLE_VERBS: SeparableVerbData[] = [
  // ── an- ──
  { infinitive: 'anfangen', prefix: 'an', translationEn: 'to start, begin', translationRu: 'начинать', presentThirdPerson: 'fängt an', simplePast: 'fing an', pastParticiple: 'angefangen' },
  { infinitive: 'anrufen', prefix: 'an', translationEn: 'to call (phone)', translationRu: 'звонить', presentThirdPerson: 'ruft an', simplePast: 'rief an', pastParticiple: 'angerufen' },
  { infinitive: 'ankommen', prefix: 'an', translationEn: 'to arrive', translationRu: 'прибывать', presentThirdPerson: 'kommt an', simplePast: 'kam an', pastParticiple: 'angekommen' },
  { infinitive: 'ansehen', prefix: 'an', translationEn: 'to look at', translationRu: 'смотреть на', presentThirdPerson: 'sieht an', simplePast: 'sah an', pastParticiple: 'angesehen' },
  { infinitive: 'anziehen', prefix: 'an', translationEn: 'to put on (clothes)', translationRu: 'надевать', presentThirdPerson: 'zieht an', simplePast: 'zog an', pastParticiple: 'angezogen' },
  { infinitive: 'anbieten', prefix: 'an', translationEn: 'to offer', translationRu: 'предлагать', presentThirdPerson: 'bietet an', simplePast: 'bot an', pastParticiple: 'angeboten' },
  { infinitive: 'anmelden', prefix: 'an', translationEn: 'to register, sign up', translationRu: 'регистрировать(ся)', presentThirdPerson: 'meldet an', simplePast: 'meldete an', pastParticiple: 'angemeldet' },
  { infinitive: 'anerkennen', prefix: 'an', translationEn: 'to recognize, acknowledge', translationRu: 'признавать', presentThirdPerson: 'erkennt an', simplePast: 'erkannte an', pastParticiple: 'anerkannt' },
  { infinitive: 'anstellen', prefix: 'an', translationEn: 'to employ; to turn on', translationRu: 'нанимать; включать', presentThirdPerson: 'stellt an', simplePast: 'stellte an', pastParticiple: 'angestellt' },
  { infinitive: 'anhalten', prefix: 'an', translationEn: 'to stop; to hold', translationRu: 'останавливать(ся)', presentThirdPerson: 'hält an', simplePast: 'hielt an', pastParticiple: 'angehalten' },

  // ── auf- ──
  { infinitive: 'aufwachen', prefix: 'auf', translationEn: 'to wake up', translationRu: 'просыпаться', presentThirdPerson: 'wacht auf', simplePast: 'wachte auf', pastParticiple: 'aufgewacht' },
  { infinitive: 'aufstehen', prefix: 'auf', translationEn: 'to get up, stand up', translationRu: 'вставать', presentThirdPerson: 'steht auf', simplePast: 'stand auf', pastParticiple: 'aufgestanden' },
  { infinitive: 'aufmachen', prefix: 'auf', translationEn: 'to open', translationRu: 'открывать', presentThirdPerson: 'macht auf', simplePast: 'machte auf', pastParticiple: 'aufgemacht' },
  { infinitive: 'aufräumen', prefix: 'auf', translationEn: 'to clean up, tidy', translationRu: 'убирать', presentThirdPerson: 'räumt auf', simplePast: 'räumte auf', pastParticiple: 'aufgeräumt' },
  { infinitive: 'aufpassen', prefix: 'auf', translationEn: 'to pay attention', translationRu: 'быть внимательным', presentThirdPerson: 'passt auf', simplePast: 'passte auf', pastParticiple: 'aufgepasst' },
  { infinitive: 'aufhören', prefix: 'auf', translationEn: 'to stop, cease', translationRu: 'прекращать', presentThirdPerson: 'hört auf', simplePast: 'hörte auf', pastParticiple: 'aufgehört' },
  { infinitive: 'aufgeben', prefix: 'auf', translationEn: 'to give up; to post', translationRu: 'сдаваться; отправлять', presentThirdPerson: 'gibt auf', simplePast: 'gab auf', pastParticiple: 'aufgegeben' },
  { infinitive: 'auffallen', prefix: 'auf', translationEn: 'to stand out, be noticeable', translationRu: 'бросаться в глаза', presentThirdPerson: 'fällt auf', simplePast: 'fiel auf', pastParticiple: 'aufgefallen' },
  { infinitive: 'aufnehmen', prefix: 'auf', translationEn: 'to record; to take in', translationRu: 'записывать; принимать', presentThirdPerson: 'nimmt auf', simplePast: 'nahm auf', pastParticiple: 'aufgenommen' },
  { infinitive: 'aufschreiben', prefix: 'auf', translationEn: 'to write down', translationRu: 'записывать', presentThirdPerson: 'schreibt auf', simplePast: 'schrieb auf', pastParticiple: 'aufgeschrieben' },

  // ── aus- ──
  { infinitive: 'ausgehen', prefix: 'aus', translationEn: 'to go out', translationRu: 'выходить (в свет)', presentThirdPerson: 'geht aus', simplePast: 'ging aus', pastParticiple: 'ausgegangen' },
  { infinitive: 'aussehen', prefix: 'aus', translationEn: 'to look, appear', translationRu: 'выглядеть', presentThirdPerson: 'sieht aus', simplePast: 'sah aus', pastParticiple: 'ausgesehen' },
  { infinitive: 'ausmachen', prefix: 'aus', translationEn: 'to turn off; to matter', translationRu: 'выключать; иметь значение', presentThirdPerson: 'macht aus', simplePast: 'machte aus', pastParticiple: 'ausgemacht' },
  { infinitive: 'ausziehen', prefix: 'aus', translationEn: 'to take off (clothes); to move out', translationRu: 'снимать (одежду); съезжать', presentThirdPerson: 'zieht aus', simplePast: 'zog aus', pastParticiple: 'ausgezogen' },
  { infinitive: 'auspacken', prefix: 'aus', translationEn: 'to unpack', translationRu: 'распаковывать', presentThirdPerson: 'packt aus', simplePast: 'packte aus', pastParticiple: 'ausgepackt' },
  { infinitive: 'ausschalten', prefix: 'aus', translationEn: 'to switch off', translationRu: 'выключать', presentThirdPerson: 'schaltet aus', simplePast: 'schaltete aus', pastParticiple: 'ausgeschaltet' },
  { infinitive: 'aussprechen', prefix: 'aus', translationEn: 'to pronounce', translationRu: 'произносить', presentThirdPerson: 'spricht aus', simplePast: 'sprach aus', pastParticiple: 'ausgesprochen' },
  { infinitive: 'ausfüllen', prefix: 'aus', translationEn: 'to fill out (form)', translationRu: 'заполнять', presentThirdPerson: 'füllt aus', simplePast: 'füllte aus', pastParticiple: 'ausgefüllt' },
  { infinitive: 'auswählen', prefix: 'aus', translationEn: 'to select, choose', translationRu: 'выбирать', presentThirdPerson: 'wählt aus', simplePast: 'wählte aus', pastParticiple: 'ausgewählt' },
  { infinitive: 'ausbilden', prefix: 'aus', translationEn: 'to train, educate', translationRu: 'обучать', presentThirdPerson: 'bildet aus', simplePast: 'bildete aus', pastParticiple: 'ausgebildet' },

  // ── bei- ──
  { infinitive: 'beitragen', prefix: 'bei', translationEn: 'to contribute', translationRu: 'вносить вклад', presentThirdPerson: 'trägt bei', simplePast: 'trug bei', pastParticiple: 'beigetragen' },
  { infinitive: 'beibringen', prefix: 'bei', translationEn: 'to teach, impart', translationRu: 'обучать', presentThirdPerson: 'bringt bei', simplePast: 'brachte bei', pastParticiple: 'beigebracht' },
  { infinitive: 'beiwohnen', prefix: 'bei', translationEn: 'to attend, be present', translationRu: 'присутствовать', presentThirdPerson: 'wohnt bei', simplePast: 'wohnte bei', pastParticiple: 'beigewohnt' },
  { infinitive: 'beilegen', prefix: 'bei', translationEn: 'to enclose; to settle', translationRu: 'вкладывать; урегулировать', presentThirdPerson: 'legt bei', simplePast: 'legte bei', pastParticiple: 'beigelegt' },

  // ── ein- ──
  { infinitive: 'einkaufen', prefix: 'ein', translationEn: 'to shop', translationRu: 'делать покупки', presentThirdPerson: 'kauft ein', simplePast: 'kaufte ein', pastParticiple: 'eingekauft' },
  { infinitive: 'einladen', prefix: 'ein', translationEn: 'to invite', translationRu: 'приглашать', presentThirdPerson: 'lädt ein', simplePast: 'lud ein', pastParticiple: 'eingeladen' },
  { infinitive: 'einschlafen', prefix: 'ein', translationEn: 'to fall asleep', translationRu: 'засыпать', presentThirdPerson: 'schläft ein', simplePast: 'schlief ein', pastParticiple: 'eingeschlafen' },
  { infinitive: 'einpacken', prefix: 'ein', translationEn: 'to pack', translationRu: 'упаковывать', presentThirdPerson: 'packt ein', simplePast: 'packte ein', pastParticiple: 'eingepackt' },
  { infinitive: 'einsteigen', prefix: 'ein', translationEn: 'to get in/on (vehicle)', translationRu: 'садиться (в транспорт)', presentThirdPerson: 'steigt ein', simplePast: 'stieg ein', pastParticiple: 'eingestiegen' },
  { infinitive: 'einziehen', prefix: 'ein', translationEn: 'to move in', translationRu: 'въезжать', presentThirdPerson: 'zieht ein', simplePast: 'zog ein', pastParticiple: 'eingezogen' },
  { infinitive: 'einsetzen', prefix: 'ein', translationEn: 'to use, deploy', translationRu: 'использовать, применять', presentThirdPerson: 'setzt ein', simplePast: 'setzte ein', pastParticiple: 'eingesetzt' },
  { infinitive: 'einrichten', prefix: 'ein', translationEn: 'to set up, furnish', translationRu: 'обустраивать', presentThirdPerson: 'richtet ein', simplePast: 'richtete ein', pastParticiple: 'eingerichtet' },
  { infinitive: 'einteilen', prefix: 'ein', translationEn: 'to divide, schedule', translationRu: 'разделять, планировать', presentThirdPerson: 'teilt ein', simplePast: 'teilte ein', pastParticiple: 'eingeteilt' },
  { infinitive: 'einwerfen', prefix: 'ein', translationEn: 'to drop in (mail); to interject', translationRu: 'опускать (письмо); вставлять (слово)', presentThirdPerson: 'wirft ein', simplePast: 'warf ein', pastParticiple: 'eingeworfen' },

  // ── mit- ──
  { infinitive: 'mitkommen', prefix: 'mit', translationEn: 'to come along', translationRu: 'идти с кем-то', presentThirdPerson: 'kommt mit', simplePast: 'kam mit', pastParticiple: 'mitgekommen' },
  { infinitive: 'mitnehmen', prefix: 'mit', translationEn: 'to take along', translationRu: 'брать с собой', presentThirdPerson: 'nimmt mit', simplePast: 'nahm mit', pastParticiple: 'mitgenommen' },
  { infinitive: 'mitbringen', prefix: 'mit', translationEn: 'to bring along', translationRu: 'приносить с собой', presentThirdPerson: 'bringt mit', simplePast: 'brachte mit', pastParticiple: 'mitgebracht' },
  { infinitive: 'mitmachen', prefix: 'mit', translationEn: 'to join in, participate', translationRu: 'участвовать', presentThirdPerson: 'macht mit', simplePast: 'machte mit', pastParticiple: 'mitgemacht' },
  { infinitive: 'mitteilen', prefix: 'mit', translationEn: 'to inform, communicate', translationRu: 'сообщать', presentThirdPerson: 'teilt mit', simplePast: 'teilte mit', pastParticiple: 'mitgeteilt' },
  { infinitive: 'mitwirken', prefix: 'mit', translationEn: 'to collaborate, contribute', translationRu: 'сотрудничать', presentThirdPerson: 'wirkt mit', simplePast: 'wirkte mit', pastParticiple: 'mitgewirkt' },
  { infinitive: 'mitfahren', prefix: 'mit', translationEn: 'to ride along', translationRu: 'ехать вместе', presentThirdPerson: 'fährt mit', simplePast: 'fuhr mit', pastParticiple: 'mitgefahren' },
  { infinitive: 'mitreden', prefix: 'mit', translationEn: 'to have a say', translationRu: 'участвовать в разговоре', presentThirdPerson: 'redet mit', simplePast: 'redete mit', pastParticiple: 'mitgeredet' },

  // ── nach- ──
  { infinitive: 'nachdenken', prefix: 'nach', translationEn: 'to think, reflect', translationRu: 'размышлять', presentThirdPerson: 'denkt nach', simplePast: 'dachte nach', pastParticiple: 'nachgedacht' },
  { infinitive: 'nachfragen', prefix: 'nach', translationEn: 'to inquire, ask', translationRu: 'спрашивать, уточнять', presentThirdPerson: 'fragt nach', simplePast: 'fragte nach', pastParticiple: 'nachgefragt' },
  { infinitive: 'nachgehen', prefix: 'nach', translationEn: 'to pursue; (clock) to be slow', translationRu: 'следовать; отставать (о часах)', presentThirdPerson: 'geht nach', simplePast: 'ging nach', pastParticiple: 'nachgegangen' },
  { infinitive: 'nachmachen', prefix: 'nach', translationEn: 'to imitate, copy', translationRu: 'подражать', presentThirdPerson: 'macht nach', simplePast: 'machte nach', pastParticiple: 'nachgemacht' },
  { infinitive: 'nachschlagen', prefix: 'nach', translationEn: 'to look up (in a book)', translationRu: 'справляться (в книге)', presentThirdPerson: 'schlägt nach', simplePast: 'schlug nach', pastParticiple: 'nachgeschlagen' },
  { infinitive: 'nachweisen', prefix: 'nach', translationEn: 'to prove, verify', translationRu: 'доказывать', presentThirdPerson: 'weist nach', simplePast: 'wies nach', pastParticiple: 'nachgewiesen' },

  // ── vor- ──
  { infinitive: 'vorbereiten', prefix: 'vor', translationEn: 'to prepare', translationRu: 'готовить(ся)', presentThirdPerson: 'bereitet vor', simplePast: 'bereitete vor', pastParticiple: 'vorbereitet' },
  { infinitive: 'vorstellen', prefix: 'vor', translationEn: 'to introduce; to imagine', translationRu: 'представлять', presentThirdPerson: 'stellt vor', simplePast: 'stellte vor', pastParticiple: 'vorgestellt' },
  { infinitive: 'vorschlagen', prefix: 'vor', translationEn: 'to suggest, propose', translationRu: 'предлагать', presentThirdPerson: 'schlägt vor', simplePast: 'schlug vor', pastParticiple: 'vorgeschlagen' },
  { infinitive: 'vorhaben', prefix: 'vor', translationEn: 'to plan, intend', translationRu: 'планировать', presentThirdPerson: 'hat vor', simplePast: 'hatte vor', pastParticiple: 'vorgehabt' },
  { infinitive: 'vorlesen', prefix: 'vor', translationEn: 'to read aloud', translationRu: 'читать вслух', presentThirdPerson: 'liest vor', simplePast: 'las vor', pastParticiple: 'vorgelesen' },
  { infinitive: 'vorbeikommen', prefix: 'vorbei', translationEn: 'to come by, visit', translationRu: 'заходить в гости', presentThirdPerson: 'kommt vorbei', simplePast: 'kam vorbei', pastParticiple: 'vorbeigekommen' },
  { infinitive: 'vorwerfen', prefix: 'vor', translationEn: 'to reproach, accuse', translationRu: 'упрекать', presentThirdPerson: 'wirft vor', simplePast: 'warf vor', pastParticiple: 'vorgeworfen' },
  { infinitive: 'vorziehen', prefix: 'vor', translationEn: 'to prefer', translationRu: 'предпочитать', presentThirdPerson: 'zieht vor', simplePast: 'zog vor', pastParticiple: 'vorgezogen' },

  // ── zu- ──
  { infinitive: 'zumachen', prefix: 'zu', translationEn: 'to close, shut', translationRu: 'закрывать', presentThirdPerson: 'macht zu', simplePast: 'machte zu', pastParticiple: 'zugemacht' },
  { infinitive: 'zuhören', prefix: 'zu', translationEn: 'to listen to', translationRu: 'слушать', presentThirdPerson: 'hört zu', simplePast: 'hörte zu', pastParticiple: 'zugehört' },
  { infinitive: 'zustimmen', prefix: 'zu', translationEn: 'to agree', translationRu: 'соглашаться', presentThirdPerson: 'stimmt zu', simplePast: 'stimmte zu', pastParticiple: 'zugestimmt' },
  { infinitive: 'zunehmen', prefix: 'zu', translationEn: 'to increase; to gain weight', translationRu: 'увеличиваться; набирать вес', presentThirdPerson: 'nimmt zu', simplePast: 'nahm zu', pastParticiple: 'zugenommen' },
  { infinitive: 'zuschauen', prefix: 'zu', translationEn: 'to watch, observe', translationRu: 'наблюдать', presentThirdPerson: 'schaut zu', simplePast: 'schaute zu', pastParticiple: 'zugeschaut' },
  { infinitive: 'zulassen', prefix: 'zu', translationEn: 'to allow, permit', translationRu: 'допускать', presentThirdPerson: 'lässt zu', simplePast: 'ließ zu', pastParticiple: 'zugelassen' },
  { infinitive: 'zubereiten', prefix: 'zu', translationEn: 'to prepare (food)', translationRu: 'готовить (еду)', presentThirdPerson: 'bereitet zu', simplePast: 'bereitete zu', pastParticiple: 'zubereitet' },
  { infinitive: 'zurückkommen', prefix: 'zurück', translationEn: 'to come back, return', translationRu: 'возвращаться', presentThirdPerson: 'kommt zurück', simplePast: 'kam zurück', pastParticiple: 'zurückgekommen' },
  { infinitive: 'zurückgeben', prefix: 'zurück', translationEn: 'to give back, return', translationRu: 'возвращать', presentThirdPerson: 'gibt zurück', simplePast: 'gab zurück', pastParticiple: 'zurückgegeben' },
  { infinitive: 'zurückziehen', prefix: 'zurück', translationEn: 'to withdraw, pull back', translationRu: 'отступать, отводить', presentThirdPerson: 'zieht zurück', simplePast: 'zog zurück', pastParticiple: 'zurückgezogen' },

  // ── weg- ──
  { infinitive: 'weggehen', prefix: 'weg', translationEn: 'to go away, leave', translationRu: 'уходить', presentThirdPerson: 'geht weg', simplePast: 'ging weg', pastParticiple: 'weggegangen' },
  { infinitive: 'wegnehmen', prefix: 'weg', translationEn: 'to take away', translationRu: 'отнимать, убирать', presentThirdPerson: 'nimmt weg', simplePast: 'nahm weg', pastParticiple: 'weggenommen' },
  { infinitive: 'wegwerfen', prefix: 'weg', translationEn: 'to throw away', translationRu: 'выбрасывать', presentThirdPerson: 'wirft weg', simplePast: 'warf weg', pastParticiple: 'weggeworfen' },
  { infinitive: 'weglaufen', prefix: 'weg', translationEn: 'to run away', translationRu: 'убегать', presentThirdPerson: 'läuft weg', simplePast: 'lief weg', pastParticiple: 'weggelaufen' },
  { infinitive: 'wegbringen', prefix: 'weg', translationEn: 'to take away, remove', translationRu: 'уносить, убирать', presentThirdPerson: 'bringt weg', simplePast: 'brachte weg', pastParticiple: 'weggebracht' },

  // ── her-/hin- ──
  { infinitive: 'herkommen', prefix: 'her', translationEn: 'to come (here)', translationRu: 'приходить (сюда)', presentThirdPerson: 'kommt her', simplePast: 'kam her', pastParticiple: 'hergekommen' },
  { infinitive: 'hinfahren', prefix: 'hin', translationEn: 'to go (there)', translationRu: 'ехать (туда)', presentThirdPerson: 'fährt hin', simplePast: 'fuhr hin', pastParticiple: 'hingefahren' },
  { infinitive: 'herstellen', prefix: 'her', translationEn: 'to produce, manufacture', translationRu: 'производить', presentThirdPerson: 'stellt her', simplePast: 'stellte her', pastParticiple: 'hergestellt' },
  { infinitive: 'hinlegen', prefix: 'hin', translationEn: 'to put down, lay down', translationRu: 'класть', presentThirdPerson: 'legt hin', simplePast: 'legte hin', pastParticiple: 'hingelegt' },
  { infinitive: 'hinweisen', prefix: 'hin', translationEn: 'to point out, indicate', translationRu: 'указывать', presentThirdPerson: 'weist hin', simplePast: 'wies hin', pastParticiple: 'hingewiesen' },
  { infinitive: 'hergeben', prefix: 'her', translationEn: 'to hand over, give up', translationRu: 'отдавать', presentThirdPerson: 'gibt her', simplePast: 'gab her', pastParticiple: 'hergegeben' },
  { infinitive: 'hinsetzen', prefix: 'hin', translationEn: 'to sit down', translationRu: 'садиться', presentThirdPerson: 'setzt hin', simplePast: 'setzte hin', pastParticiple: 'hingesetzt' },

  // ── zusammen- ──
  { infinitive: 'zusammenarbeiten', prefix: 'zusammen', translationEn: 'to work together', translationRu: 'работать вместе', presentThirdPerson: 'arbeitet zusammen', simplePast: 'arbeitete zusammen', pastParticiple: 'zusammengearbeitet' },
  { infinitive: 'zusammenfassen', prefix: 'zusammen', translationEn: 'to summarize', translationRu: 'обобщать', presentThirdPerson: 'fasst zusammen', simplePast: 'fasste zusammen', pastParticiple: 'zusammengefasst' },
  { infinitive: 'zusammenkommen', prefix: 'zusammen', translationEn: 'to come together, meet', translationRu: 'собираться вместе', presentThirdPerson: 'kommt zusammen', simplePast: 'kam zusammen', pastParticiple: 'zusammengekommen' },
  { infinitive: 'zusammensetzen', prefix: 'zusammen', translationEn: 'to assemble, put together', translationRu: 'собирать, составлять', presentThirdPerson: 'setzt zusammen', simplePast: 'setzte zusammen', pastParticiple: 'zusammengesetzt' },
  { infinitive: 'zusammenstellen', prefix: 'zusammen', translationEn: 'to compile, arrange', translationRu: 'составлять, подбирать', presentThirdPerson: 'stellt zusammen', simplePast: 'stellte zusammen', pastParticiple: 'zusammengestellt' },

  // ── Other common prefixes ──
  { infinitive: 'abholen', prefix: 'ab', translationEn: 'to pick up, collect', translationRu: 'забирать', presentThirdPerson: 'holt ab', simplePast: 'holte ab', pastParticiple: 'abgeholt' },
  { infinitive: 'abfahren', prefix: 'ab', translationEn: 'to depart', translationRu: 'отправляться', presentThirdPerson: 'fährt ab', simplePast: 'fuhr ab', pastParticiple: 'abgefahren' },
  { infinitive: 'abgeben', prefix: 'ab', translationEn: 'to hand in, submit', translationRu: 'сдавать', presentThirdPerson: 'gibt ab', simplePast: 'gab ab', pastParticiple: 'abgegeben' },
  { infinitive: 'abschließen', prefix: 'ab', translationEn: 'to lock; to complete', translationRu: 'запирать; завершать', presentThirdPerson: 'schließt ab', simplePast: 'schloss ab', pastParticiple: 'abgeschlossen' },
  { infinitive: 'abnehmen', prefix: 'ab', translationEn: 'to remove; to lose weight', translationRu: 'снимать; худеть', presentThirdPerson: 'nimmt ab', simplePast: 'nahm ab', pastParticiple: 'abgenommen' },
  { infinitive: 'abstellen', prefix: 'ab', translationEn: 'to park; to stop', translationRu: 'парковать; прекращать', presentThirdPerson: 'stellt ab', simplePast: 'stellte ab', pastParticiple: 'abgestellt' },
  { infinitive: 'durchführen', prefix: 'durch', translationEn: 'to carry out, execute', translationRu: 'выполнять, проводить', presentThirdPerson: 'führt durch', simplePast: 'führte durch', pastParticiple: 'durchgeführt' },
  { infinitive: 'durchsetzen', prefix: 'durch', translationEn: 'to enforce, prevail', translationRu: 'проводить, добиваться', presentThirdPerson: 'setzt durch', simplePast: 'setzte durch', pastParticiple: 'durchgesetzt' },
  { infinitive: 'feststellen', prefix: 'fest', translationEn: 'to determine, ascertain', translationRu: 'устанавливать, констатировать', presentThirdPerson: 'stellt fest', simplePast: 'stellte fest', pastParticiple: 'festgestellt' },
  { infinitive: 'festhalten', prefix: 'fest', translationEn: 'to hold on; to record', translationRu: 'держать; фиксировать', presentThirdPerson: 'hält fest', simplePast: 'hielt fest', pastParticiple: 'festgehalten' },
  { infinitive: 'stattfinden', prefix: 'statt', translationEn: 'to take place, occur', translationRu: 'происходить, состояться', presentThirdPerson: 'findet statt', simplePast: 'fand statt', pastParticiple: 'stattgefunden' },
  { infinitive: 'teilnehmen', prefix: 'teil', translationEn: 'to participate, take part', translationRu: 'участвовать', presentThirdPerson: 'nimmt teil', simplePast: 'nahm teil', pastParticiple: 'teilgenommen' },
  { infinitive: 'weitergehen', prefix: 'weiter', translationEn: 'to continue, go on', translationRu: 'продолжаться', presentThirdPerson: 'geht weiter', simplePast: 'ging weiter', pastParticiple: 'weitergegangen' },
  { infinitive: 'weitermachen', prefix: 'weiter', translationEn: 'to continue, keep going', translationRu: 'продолжать', presentThirdPerson: 'macht weiter', simplePast: 'machte weiter', pastParticiple: 'weitergemacht' },
  { infinitive: 'widersprechen', prefix: 'wider', translationEn: 'to contradict', translationRu: 'противоречить', presentThirdPerson: 'widerspricht', simplePast: 'widersprach', pastParticiple: 'widersprochen' },
  { infinitive: 'wiederholen', prefix: 'wieder', translationEn: 'to repeat', translationRu: 'повторять', presentThirdPerson: 'wiederholt', simplePast: 'wiederholte', pastParticiple: 'wiederholt' },
  { infinitive: 'wiedergeben', prefix: 'wieder', translationEn: 'to reproduce, render', translationRu: 'воспроизводить', presentThirdPerson: 'gibt wieder', simplePast: 'gab wieder', pastParticiple: 'wiedergegeben' },
  { infinitive: 'losgehen', prefix: 'los', translationEn: 'to start, set off', translationRu: 'начинаться, отправляться', presentThirdPerson: 'geht los', simplePast: 'ging los', pastParticiple: 'losgegangen' },
  { infinitive: 'loslassen', prefix: 'los', translationEn: 'to let go, release', translationRu: 'отпускать', presentThirdPerson: 'lässt los', simplePast: 'ließ los', pastParticiple: 'losgelassen' },
  { infinitive: 'umziehen', prefix: 'um', translationEn: 'to move (house)', translationRu: 'переезжать', presentThirdPerson: 'zieht um', simplePast: 'zog um', pastParticiple: 'umgezogen' },
  { infinitive: 'umsteigen', prefix: 'um', translationEn: 'to transfer, change (train)', translationRu: 'пересаживаться (на транспорт)', presentThirdPerson: 'steigt um', simplePast: 'stieg um', pastParticiple: 'umgestiegen' },
  { infinitive: 'umgehen', prefix: 'um', translationEn: 'to deal with, handle', translationRu: 'обходиться, обращаться', presentThirdPerson: 'geht um', simplePast: 'ging um', pastParticiple: 'umgegangen' },
  { infinitive: 'übrigbleiben', prefix: 'übrig', translationEn: 'to remain, be left over', translationRu: 'оставаться', presentThirdPerson: 'bleibt übrig', simplePast: 'blieb übrig', pastParticiple: 'übriggeblieben' },
  { infinitive: 'übernehmen', prefix: 'über', translationEn: 'to take over, assume', translationRu: 'брать на себя', presentThirdPerson: 'übernimmt', simplePast: 'übernahm', pastParticiple: 'übernommen' },
  { infinitive: 'unternehmen', prefix: 'unter', translationEn: 'to undertake, do', translationRu: 'предпринимать', presentThirdPerson: 'unternimmt', simplePast: 'unternahm', pastParticiple: 'unternommen' },
];