# Readiness – roadmap

Obiettivo di lungo periodo: un'app completa per l'atleta endurance, alternativa a Bevel / Whoop / Fitbit su Android.
Si procede un punto alla volta; quando uno è fatto si spunta.

## Funzioni che mancano rispetto a Bevel, Whoop e Fitbit
- [x] 1. Diario delle abitudini con correlazioni (alcol, caffè tardi, cena pesante, schermi a letto, stress…): dopo qualche settimana l'app mostra quanto ciascuna pesa su recupero e sonno
- [x] 2. Coach del sonno: debito di sonno nel tempo, regolarità degli orari, grafico delle fasi lungo la notte
- [x] 3. Grafici della giornata: frequenza cardiaca, stress e "riserva di energia" ora per ora
- [x] 4. Report mensili e trend lunghi, spiegati a parole
- [x] 5. Riquadro Calories di Today che apre direttamente il diario alimentare
- [ ] 6. Validazione dello score (periodo di test in corso da novembre 2026) — strumenti pronti in Settings → Score check; si spunta quando arriva il verdetto (30 sedute con feel e 4 settimane)

## Verso un prodotto condivisibile
- [x] 7. Codice più ordinato: dividere il file unico dell'app in moduli, test automatici
- [ ] 8. Server vero e account (multiutente), senza dipendere da GitHub Actions / ntfy
- [ ] 9. App nativa Android e widget per la schermata Home — widget fatto (app "Readiness Widget", cartella android/, costruita dal workflow Android e scaricabile dalla release "widget"); resta da decidere se portare tutta l'app dentro un contenitore nativo (serve un file di verifica sul dominio fulviot20.github.io)

## Miglioramenti proposti (novembre 2026)
- [x] 10. Insight del mattino: una o due frasi AI su Today che collegano score, segnali, journal di ieri e seduta di oggi (una richiesta al giorno con la tua chiave, condivisa tra i dispositivi)
- [x] 11. Seduta del giorno in due versioni, come proposta (mai obbligo): "Full" com'è pianificata e "Short" ricavata dalla sua struttura (una ripetuta in meno, o un quarto di tempo in meno; fondo facile nei giorni molto bassi), con quale delle due si adatta allo score
- [x] 12. Fueling in bici e post-allenamento collegati al diario: modello fisiologico (fuel.py) che stima i carboidrati consumati dalle zone di potenza, dice quanto prendere in sella e quanto reintegrare dopo; se la seduta esce diversa dal piano, la differenza va nel recupero
- [x] 13. Promemoria intelligenti: notifica serale se il journal è vuoto, peso settimanale, check-in del mattino (ognuno solo se manca davvero, una volta sola, disattivabile in Settings)
- [x] 14. Sincronizzare anche piano alimentare e note tra telefono e computer: piano, alternative scelte e impostazioni (fuel, promemoria) seguono tutti i dispositivi
- [x] 15. Diario alimentare meno faticoso e più affidabile: range fisso per tipo di giornata al posto del target mobile, giornata tipo registrata in un tocco, correzione settimanale dalla bilancia

## Semplificazione (12/11/2026)
- [x] 16. Today a due pagine (Overview · Day): segnali, check-in, carburante e "score non torna?" stanno in un blocco "Signals, check-in & more" che si apre con un tocco; il journal è in fondo a Day
- [x] 17. Training a tre pagine (Week · Month · Fitness; le ore per sport sono dentro Month); Athlete a tre (Profile · Diary · Plan; bilancio e obiettivo peso sono in un blocco dentro Profile)
- [x] 18. Notifiche: icona piccola trasparente al posto del quadrato bianco; in Settings si vede quando è partita l'ultima notifica

## Cibo: il piano è il diario (12/11/2026)
- [x] 19. Spunta dei pasti dal piano nel Diary: per ogni pasto un tocco su As planned / Less / More / Other; le porzioni del piano vanno nel diario da sole (×1, ×0,75, ×1,3), "Other" apre l'aggiunta normale. Le spunte dicono anche quanto è stato seguito il piano, quindi alla pesata non serve più chiederlo
- [x] 20. Quando la bilancia sposta il range, la scheda del peso dice cosa cambia nel piatto (es. "Rice 80 → 70 g") invece di un numero di kcal
- [x] 21. AI: calorie prese dalle tabelle quando il cibo c'è (l'AI legge cibo, grammi e pasto; nella conferma compare "table"), contesto ridotto a ciò che serve alla domanda, niente micronutrienti nella registrazione (più veloce), modalità coach per le domande (ragiona un po', risponde con i tuoi numeri e i tuoi valori abituali), modelli stabili prima delle anteprime

## Cibo all'essenziale e Training potenziato (12/11/2026)
- [x] 22. Cibo sfoltito: tolti micronutrienti (e le richieste AI automatiche per calcolarli), bilancio settimanale e grafico del bilancio energetico; restano piano con spunte, diario, range, fueling, andamento del peso e obiettivo
- [x] 23. Power (Training → Fitness): CP e W′ stimati dalle uscite (best 3–20′ degli ultimi 90 giorni), andamento della CP, curva potenza-durata contro i 90 giorni prima, W/kg
- [x] 24. Durability (Training → Fitness): miglior 5′ e 20′ dopo 1000–4000 kJ, in % della potenza fresca
- [x] 25. Intensity (Training → Month): ore settimanali per fascia in % della CP, con l'intensive endurance (70–80%) in evidenza, 12 settimane
