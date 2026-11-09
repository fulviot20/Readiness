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

## Struttura del codice e test
- `site/index.html` contiene solo la struttura della pagina; lo stile è in `site/app.css` e il codice dell'app in `site/js/`, un file per area (core, gauge, sleep, dayflow, coach, score, training, food, assistant, journal, athlete, months, app). I file sono script normali caricati in ordine; quando si cambia uno di essi si aggiorna il numero `?v=` in `index.html`, così i telefoni scaricano la versione nuova.
- `tests/fixture.py` costruisce dati finti (nessun dato personale) con la stessa pipeline del calcolo vero.
- `tests/test_engine.py` (pytest) controlla motore, score, allarmi, energia e cifratura; `tests/smoke.js` apre l'app in Chrome headless con i dati finti, passa da tutte le schede e i fogli principali e fallisce a qualsiasi errore.
- Il workflow *Tests* li esegue a ogni modifica del codice (non sui commit orari dei dati).
