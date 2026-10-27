{
  "version": 1,
  "type": "plan",
  "title": "Timeline live a 16 blocchi stile FL Studio con cancellazione automatica",
  "steps": [
    "Sostituire pattern piatti (seqPattern, drumPatterns) con struttura per barre: array di 16 barre, ognuna con seqPattern (frequenze invece di 0/1) e drumPatterns kick/hats/bass; aggiungere currentBarIndex",
    "Modificare seqTick(): al passaggio da step 15 a 0, azzerare la barra conclusa, incrementare currentBarIndex (ciclico 0-15), spawnare nuova barra vuota modificabile",
    "Collegare tastiera 2 ottave alla registrazione live: al mousedown/touchstart scrivere la nota premuta nello step corrente della barra corrente (quando sequencer in play)",
    "Modificare buildSeqSteps() per creare 16 blocchi da 16 step ciascuno; attivare visivamente solo il blocco corrente con playhead e indicatore di barra",
    "Aggiungere stili CSS per barra attiva, playhead, passo in registrazione e layer drum colorati per barra",
    "Collegare pulsanti Loop kick/hats/bass alla scrittura nei drumPatterns della barra corrente",
    "Eseguire verifica visiva e funzionale nel browser reale"
  ]
}