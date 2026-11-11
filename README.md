# Readiness

Score di readiness personale (0–100) calcolato ogni ora dai dati Garmin che arrivano su Intervals.icu.
I dati pubblicati sono cifrati: senza la frase segreta il file `data.enc` è illeggibile.

## Configurazione (una volta sola)

1. **Repository** – Su GitHub crea un repository chiamato `readiness`, **Public** (serve per GitHub Pages gratuito; i dati restano cifrati).
2. **File** – Carica tutti i file di questa cartella, compresa `.github/workflows/readiness.yml`.
3. **Segreti** – *Settings → Secrets and variables → Actions → New repository secret*:
   - `INTERVALS_API_KEY`: su Intervals.icu → *Settings → Developer Settings → API Key*
   - `INTERVALS_ATHLETE_ID`: nella stessa pagina (es. `i123456`)
   - `READINESS_PASSPHRASE`: una frase segreta a scelta (la userai nell'app)
4. **Pages** – *Settings → Pages → Source: GitHub Actions*.
5. **Primo avvio** – *Actions → Readiness → Run workflow*.
6. **App** – Apri `https://<utente>.github.io/readiness`, inserisci la frase segreta e aggiungila alla schermata Home
   (iPhone: Safari → Condividi → Aggiungi a Home; Android: Chrome → menu → Installa app).

### Facoltativo: salvare il questionario sul server
*Foto profilo → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate*:
accesso solo al repository `readiness`, permesso **Contents: Read and write**. Incollalo nell'app (icona ingranaggio).
Senza token le risposte restano solo sul telefono.

## Algoritmo
- **HRV** 40%: log rMSSD, 70% media 7 giorni + 30% notte, vs media e dev. std. dei 60 giorni precedenti
- **Carico** 25%: Form % del giorno prima; -10%…+ = ottimo, sotto -30% penalizza; il riposo non compensa HRV/FC peggiorate
- **Sonno** 20%: durata della notte + media 3 notti vs 7 h; scartati i valori < 4 h o > 11 h
- **FC a riposo** 15%: vs media e dev. std. dei 30 giorni precedenti
- **Taratura**: score = 70 + 12 × (valore − media) / dev. std. dei tuoi ultimi 180 giorni
- **Allarme**: HRV notturna < −1 dev. std. e FC a riposo > +1 dev. std. → massimo 49
- **Questionario** (facoltativo): come ti senti ±10, come hai dormito ±5, malattia −10 e massimo 49; totale ±15

## Sleep e Strain
- **Sleep** (0–100): durata della notte vs il tuo fabbisogno (ultime 30 notti), 40% Garmin sleep score se disponibile, meno il debito delle ultime 3 notti (8 punti/ora, max 20)
- **Strain** (0–100): carico del giorno vs la tua fitness (carico medio giornaliero): 100 × (1 − e^(−carico / 1,5·fitness))

## Sleep coach
Si apre dal riquadro "Tonight" o dalla scheda Sleep. Mostra le fasi della notte (barra riassuntiva; la sequenza fase per fase non è disponibile dall'API personale Garmin, verificato a novembre 2026), il debito di sonno delle ultime 7 notti (ore sotto il fabbisogno meno le ore in più), la regolarità degli ultimi 14 giorni (scarto medio di addormentamento e risveglio: ±10 min = 100, ±90 min = 0; spostamento del weekend) e consigli scelti in base ai dati, senza orari imposti.

## Hour by hour
Riquadro in Today (anche per i giorni passati, ultimi 7): frequenza cardiaca ogni 5 minuti, stress e riserva di energia, con fasce del sonno e degli allenamenti; toccando il grafico si legge l'orario.
- **Energy** (0–100, nostro modello): nel sonno si ricarica verso 100 (ogni ora riempie il 22% × Sleep score/100 dello spazio rimasto); da svegli scende di 2 punti/ora (non a riposo vero, FC entro l'8% della riserva); sopra il 30% della riserva cardiaca scende come il TRIMP di Banister (0,3 punti per unità).
- **Stress** (stima nostra): l'API personale Garmin non dà la serie dello stress, quindi da svegli e fuori dall'allenamento è quanto la FC sta sopra quella a riposo (+5 bpm = calmo, 30% della riserva = massimo), media su 15 minuti. Lo sforzo fisico è mostrato come "Activity".

## Verifica dello score
Dall'app ("Score doesn't feel right?") si salvano note cifrate in `notes/`. In *Settings → Score check*, dal 1° novembre 2026, sei controlli indipendenti:
- **Feel delle sedute**: Spearman tra score del mattino e feel di Intervals (1 forte … 5 debole)
- **Come ti senti al risveglio**: Spearman tra lo score *prima* del questionario e la risposta (così la risposta non falsa il confronto)
- **Malattia**: giorni segnalati come malato vs allarmi nello stesso giorno o nei 2 precedenti, più gli allarmi senza malattia
- **Note**: "troppo alto" vs "troppo basso"; se sono sbilanciate lo score è spostato
- **Stabilità**: variazione media giorno su giorno (≤10 punti = stabile)
- **Distribuzione**: quota di giorni per fascia
Il verdetto arriva con 30 sedute valutate e 4 settimane di score; prima di allora c'è anche un back-test dell'algoritmo attuale sulle sedute precedenti.

## Report mensili
In *Training → This month*: per ognuno degli ultimi 12 mesi recupero, sonno, HRV e FC notturne, volume e carico, CTL, peso e marker, confrontati col mese prima e con la media dei 3 mesi prima, più alcune frasi che leggono i segnali insieme (es. più allenamento con HRV stabile = carico assorbito). I trend lunghi usano la pendenza sugli ultimi 6 mesi completi.

## Fuelling: quanto consumi, quanto prendere, quanto reintegrare
Modello in `fuel.py` (riferimenti nel file), specchiato in `site/js/food.js`; il calcolo gira sul server per ogni seduta fatta e pianificata.
- **Consumo.** Energia = lavoro del misuratore di potenza (kJ) / efficienza lorda 22%; senza potenza, le calorie di Garmin. La quota da carboidrati viene dal tempo in ogni zona di potenza (curva per % di FTP: ~44% al 55%, ~58% al 75%, ~84% al 95%, 100% oltre il 120%), cala di circa 8 punti l'ora con la durata e sale di circa 1,7 punti ogni 10 g/h presi in sella (meta-regressione di Rothschild et al., Sports Med 2022). Controllo: 2 ore di fondo facile a digiuno danno il 40–50% dell'energia da carboidrati, come negli studi di laboratorio su ciclisti allenati. La stima di Intervals (`carbs_used`) è più alta, in mediana di circa il 60%.
- **In sella (la priorità).** Tarato sul motore, non su una tabella per durata: il 70% di quello che la seduta brucia ogni ora (energia dalla potenza, quota carboidrati dall'intensità, prima del calo dovuto alla durata), +10% per ogni ora oltre la seconda, mai sotto 40 g/h e mai oltre il massimo che tolleri (*Settings → Fuelling*, 90 g/h di base). Serve alla seduta, anticipa il reintegro per quella dopo e tiene allenato l'intestino. Sotto i 40 minuti niente. Gare (eventi RACE di Intervals) comprese. Gli altri sport restano sulle fasce classiche per durata.
- **Riga "Ride fuel" nel diario** (dal 10 novembre 2026): i grammi registrati su Intervals (`carbs_ingested`); se mancano, la quantità prevista dal piano della seduta, finché non la correggi.
- **Dopo.** Consumati − presi = buco di glicogeno. Con un'altra seduta impegnativa entro un giorno, o se il buco supera quello previsto dal piano di almeno 0,3 g/kg (seduta più lunga o più dura, o hai mangiato meno): fino a 1,2 g/kg entro un'ora e fino a 1 g/kg nelle due ore dopo. Altrimenti fino a 0,8 g/kg al pasto successivo. Sempre 0,3 g/kg di proteine (Burke, van Loon & Hawley 2017; Alghannam, Gonzalez & Betts 2018). Il resto rientra con i pasti: è già nel target del giorno.
- È una stima: senza test in laboratorio la quota grassi/carboidrati può sbagliare di un quarto in più o in meno.

## Insight del mattino e seduta in due versioni
- **Insight** (`site/js/insight.js`): con la chiave Gemini inserita, alla prima apertura del giorno con lo score pronto l'app manda all'AI i fatti del mattino (score e variazione, segnali rispetto al tuo normale, sonno, check-in, allenamento e journal di ieri, piano di oggi e domani) e mostra una o due frasi sotto il verdetto. Una richiesta al giorno; il testo è un valore sincronizzato (`rd_insight`), quindi gli altri dispositivi non ne fanno un'altra. Senza chiave il riquadro non compare.
- **Ricerca cibi** (`site/js/food.js`): tre fonti nell'ordine tabella interna (*Basics*), cibi generici trovati dall'AI (*More foods*, per 100 g con la loro unità naturale: partono dopo una pausa nella digitazione, vengono scartati se le calorie non tornano con i macro e restano salvati sul telefono in `rd_fdb`, così la volta dopo si trovano subito, anche offline e in Speak / Paste list) e prodotti confezionati di Open Food Facts (solo etichette complete e coerenti, senza doppioni).
- **Due versioni** (`adaptPlan`): sotto ogni seduta pianificata di oggi, "Full" e "Short". Le ripetute (blocchi uguali all'88% di FTP o più) perdono circa un quarto delle ripetizioni, almeno una; le sedute continue un quarto del tempo; con score molto basso o allarme la versione corta diventa fondo facile (60% del tempo, massimo un'ora). Super/Normal: indicata la piena; Low: nessuna delle due, decide il riscaldamento; Very low: indicata la corta. Le gare non hanno versione corta. È sempre una proposta.

## Diario alimentare: range fisso, giornata tipo, bilancia (dall'11 novembre 2026)
- **Range del giorno, non un numero** (`targetOf` in `site/js/food.js`). Prima il target era la proiezione di Garmin meno il deficit e si muoveva a ogni sincronizzazione. Ora è: *consumo di tutti i giorni senza allenamento* (mediana degli ultimi 28 giorni, tolto il costo delle sedute) + *allenamento del giorno* (per le sedute pianificate, quanto costano di solito al minuto per quello sport; a seduta fatta, quanto è costata davvero) + deficit dell'obiettivo + correzione dal peso. È arrotondato a 50 kcal e mostrato come fascia di ±100 kcal: dentro la fascia la giornata è riuscita. Cambia una volta sola, quando la seduta è fatta. Servono almeno 7 giorni di dati Garmin; prima resta il calcolo vecchio. La pagina Balance continua a usare il consumo reale misurato.
- **Giornata tipo** (voci `kind:"day"` tra i pasti salvati). "Save this day as a usual day" in fondo al diario salva tutti i pasti del giorno (il rifornimento in bici no: entra da solo). Su un diario vuoto la giornata tipo compare in cima: un tocco la registra tutta, con Undo, poi si correggono solo le differenze. Si modifica o si elimina da *My days, meals & recipes*.
- **La bilancia corregge** (`trimCheck`, valore sincronizzato `rd_trim`). Una volta a settimana la pendenza delle pesate delle ultime tre settimane (almeno 4 pesate su 14 giorni) viene confrontata con il ritmo dell'obiettivo: se cali più in fretta del previsto di oltre 0,2 kg a settimana il range di ogni giorno sale di 100 kcal (150 se molto più in fretta), se il peso sale scende di 100, altrimenti resta. Limiti: da −300 a +400 kcal. Non richiede di registrare il cibo, quindi corregge anche gli errori dell'orologio e delle porzioni a occhio. Si azzera dal foglio *Daily range*.

## Promemoria
Notifiche inviate dal calcolo (`push.py`), ognuna al massimo una volta e solo se la cosa manca davvero: check-in del mattino (25 minuti dopo la notifica dello score, se non hai risposto, entro le 11), journal della sera (alle 21, se oggi è vuoto), peso settimanale (al mattino, se l'ultima pesata ha almeno 7 giorni; poi non prima di una settimana). Si spengono una per una in *Settings → Reminders*; toccandole l'app si apre già sul punto giusto. In Today compare anche un piccolo riquadro per peso e journal.

## Stessi dati su telefono e computer
Diario, journal, note sul cibo, profilo e obiettivo viaggiano già una voce alla volta. Il piano alimentare, le alternative scelte e le impostazioni di fuel e promemoria sono "valori sincronizzati" (`site/js/sync.js`, `mailbox.keep_value`): ogni modifica parte cifrata nella stessa casella di posta, il piano compresso e a pezzi perché è grande; vince la copia più recente.

## Velocità
- La chiave di cifratura si ricava una volta sola e resta sul dispositivo (i dati pubblicati usano sempre lo stesso sale; l'IV cambia ogni volta): l'app si apre senza rifare 200.000 giri a ogni avvio, e i messaggi al server riusano la stessa chiave.
- `site/stamp.json` dice quale versione dei dati è online: l'app scarica `data.enc` solo quando è cambiato, non a ogni apertura né a ogni controllo.
- Il service worker serve subito dalla copia sul telefono i file con versione (`?v=`) e i font; la pagina viene chiesta alla rete per al massimo 2 secondi, poi si apre quella salvata.
- L'elenco del cibo di ogni giorno è calcolato una volta e riusato (le pagine Balance e Diary leggevano la memoria del telefono per ogni giorno).

## Widget Android
`android/` è una piccola app nativa (Java, solo framework Android, nessuna libreria) che mette sulla Home lo score di oggi con sonno e strain. Legge `site/widget.enc`, un file piccolo cifrato come gli altri dati: al primo avvio si inserisce la passphrase una volta, da cui viene ricavata la chiave (la passphrase non viene salvata). Si aggiorna circa ogni 15 minuti e toccandolo apre Readiness. Il workflow *Android* la costruisce a ogni modifica di `android/` e pubblica il file su `releases/latest/download/readiness-widget.apk`; la chiave di firma sta nel repository cifrata con la passphrase (`android/keystore.enc`), così ogni versione si installa sopra la precedente. L'app vera resta quella web: si aggiorna da sola e non passa da qui.

## Struttura del codice e test
- `site/index.html` contiene solo la struttura della pagina; lo stile è in `site/app.css` e il codice dell'app in `site/js/`, un file per area (core, gauge, sleep, dayflow, coach, score, training, food, plan, assistant, journal, athlete, months, sync, insight, app). In basso ci sono tre schede (Today, Training, Athlete; Food sta dentro Athlete) e la lente accanto ad "Ask AI" apre *Find*, l'elenco cercabile di tutte le pagine. I file sono script normali caricati in ordine; quando si cambia uno di essi si aggiorna **sempre** il numero `?v=` in `index.html`: i telefoni tengono in memoria i file per versione e senza numero nuovo non scaricano la modifica.
- `tests/fixture.py` costruisce dati finti (nessun dato personale) con la stessa pipeline del calcolo vero.
- `tests/test_engine.py` (pytest) controlla motore, score, allarmi, energia e cifratura; `tests/smoke.js` apre l'app in Chrome headless con i dati finti, passa da tutte le schede e i fogli principali e fallisce a qualsiasi errore.
- Il workflow *Tests* li esegue a ogni modifica del codice (non sui commit orari dei dati).
