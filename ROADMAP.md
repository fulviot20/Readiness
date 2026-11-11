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
