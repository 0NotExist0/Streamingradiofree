// Riferimenti agli elementi del DOM
const audioElement = document.getElementById('audioElement');
const streamUrlInput = document.getElementById('streamUrl');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const volumeCtrl = document.getElementById('volumeCtrl');
const statusDisplay = document.getElementById('statusDisplay');

// Nuovi riferimenti per il database
const stationNameInput = document.getElementById('stationName');
const saveDbBtn = document.getElementById('saveDbBtn');

/**
 * Avvia la riproduzione dello stream recuperando l'URL dall'input.
 */
function playStream() {
    const streamUrl = streamUrlInput.value.trim();

    if (streamUrl === "") {
        updateStatus("Errore: Nessun URL inserito.", "#e22134");
        return;
    }

    audioElement.src = streamUrl;
    updateStatus("Connessione in corso...", "#b3b3b3");

    audioElement.play().then(() => {
        updateStatus("In riproduzione 🎵", "#1db954");
    }).catch((error) => {
        console.error("Errore di riproduzione:", error);
        updateStatus("Errore: Impossibile riprodurre lo stream. Controlla il link o le policy CORS.", "#e22134");
        audioElement.src = ""; 
    });
}

/**
 * Ferma completamente la riproduzione audio e scarica il buffer.
 */
function stopStream() {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.removeAttribute('src'); 
    audioElement.load();
    
    updateStatus("Riproduzione fermata.", "#b3b3b3");
}

/**
 * Aggiorna il volume dell'elemento audio.
 */
function updateVolume() {
    audioElement.volume = volumeCtrl.value;
}

/**
 * Funzione di utilità per aggiornare l'interfaccia utente.
 * @param {string} message - Il messaggio da mostrare.
 * @param {string} color - Il colore del testo.
 */
function updateStatus(message, color) {
    statusDisplay.textContent = message;
    statusDisplay.style.color = color;
}

/**
 * METODO COMPLETO PER API INFERENCE VERSO DATABASE OPEN-SOURCE (Supabase)
 * Prepara un JSON e lo invia tramite metodo POST.
 */
async function saveLinkToDatabase() {
    const streamUrl = streamUrlInput.value.trim();
    const stationName = stationNameInput.value.trim();

    // Validazione input
    if (streamUrl === "" || stationName === "") {
        updateStatus("Errore: Inserisci URL e Nome della radio prima di salvare.", "#e22134");
        return;
    }

    /* * CONFIGURAZIONE API SUPABASE
     * Sostituisci questi valori con quelli del tuo progetto Supabase reale.
     * 'radio_links' è il nome della tabella che devi creare nel database.
     */
    const SUPABASE_PROJECT_URL = 'https://TUO-PROGETTO.supabase.co';
    const SUPABASE_API_ENDPOINT = `${SUPABASE_PROJECT_URL}/rest/v1/radio_links`;
    const SUPABASE_ANON_KEY = 'LA-TUA-CHIAVE-ANONIMA-PUBBLICA';

    // Struttura del dato JSON da inviare al DB
    const dataPayload = {
        name: stationName,
        url: streamUrl,
        created_at: new Date().toISOString()
    };

    try {
        updateStatus("Salvataggio in corso...", "#b3b3b3");
        saveDbBtn.disabled = true;

        // Chiamata REST via Fetch API
        const response = await fetch(SUPABASE_API_ENDPOINT, {
            method: 'POST', // Usiamo POST per creare un nuovo record
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal' // Richiede al server di non restituire l'intero oggetto creato per risparmiare banda
            },
            body: JSON.stringify(dataPayload)
        });

        if (!response.ok) {
            // Se la risposta non è nel range 200-299, lanciamo un'eccezione
            throw new Error(`Errore Server: ${response.status} - ${response.statusText}`);
        }

        updateStatus(`"${stationName}" salvata nel Database!`, "#1db954");
        stationNameInput.value = ""; // Pulisce l'input del nome

    } catch (error) {
        console.error("Errore API Database:", error);
        updateStatus("Errore nel salvataggio. Controlla la console per i dettagli.", "#e22134");
    } finally {
        saveDbBtn.disabled = false;
    }
}

// Assegnazione degli Event Listener
playBtn.addEventListener('click', playStream);
stopBtn.addEventListener('click', stopStream);
volumeCtrl.addEventListener('input', updateVolume);
saveDbBtn.addEventListener('click', saveLinkToDatabase);

// Inizializza il volume corrente all'avvio
updateVolume();
