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
Si apre dal riquadro "Tonight" o dalla scheda Sleep. Mostra le fasi della notte (ipnogramma dai dati grezzi Garmin, ultime 14 notti), il debito di sonno delle ultime 7 notti (ore sotto il fabbisogno meno le ore in più), la regolarità degli ultimi 14 giorni (scarto medio di addormentamento e risveglio: ±10 min = 100, ±90 min = 0; spostamento del weekend) e consigli scelti in base ai dati, senza orari imposti.

## Verifica dello score
Dall'app ("Score doesn't feel right?") si salvano note cifrate in `notes/`. In *Settings → Score check*: correlazione di Spearman tra lo score del mattino e il feel delle sedute (da novembre 2026), feel medio per fascia e note.
