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
- [ ] 9. App nativa Android e widget per la schermata Home

## Miglioramenti proposti (novembre 2026)
- [ ] 10. Insight del mattino proattivo: una frase AI su Today che collega score, sonno, journal e allenamento del giorno (una richiesta al giorno)
- [ ] 11. Allenamento del giorno adattato allo score, come proposta (mai obbligo): versione "piena" e "corta" della seduta, con link a Intervals
- [x] 12. Fueling in bici e post-allenamento collegati al diario: ogni uscita in bici abbastanza lunga aggiunge da sola la riga "Ride fuel" (g/h abituali × durata, o i grammi registrati su Intervals), più il promemoria di recupero dopo la seduta
- [x] 13. Promemoria intelligenti: notifica serale se il journal è vuoto, peso settimanale, check-in del mattino (ognuno solo se manca davvero, una volta sola, disattivabile in Settings)
- [x] 14. Sincronizzare anche piano alimentare e note tra telefono e computer: piano, alternative scelte e impostazioni (fuel, promemoria) seguono tutti i dispositivi
