// Riferimenti agli elementi del DOM
const audioElement = document.getElementById('audioElement');
const streamUrlInput = document.getElementById('streamUrl');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const volumeCtrl = document.getElementById('volumeCtrl');
const statusDisplay = document.getElementById('statusDisplay');

/**
 * Avvia la riproduzione dello stream recuperando l'URL dall'input.
 * Gestisce la Promise restituita dal metodo play() per intercettare eventuali errori.
 */
function playStream() {
    const streamUrl = streamUrlInput.value.trim();

    if (streamUrl === "") {
        updateStatus("Errore: Nessun URL inserito.", "#e22134");
        return;
    }

    // Imposta la sorgente dell'audio e avvia
    audioElement.src = streamUrl;
    updateStatus("Connessione in corso...", "#b3b3b3");

    audioElement.play().then(() => {
        updateStatus("In riproduzione 🎵", "#1db954");
    }).catch((error) => {
        console.error("Errore di riproduzione:", error);
        updateStatus("Errore: Impossibile riprodurre lo stream. Controlla il link o le policy CORS.", "#e22134");
        
        // Resetta la sorgente in caso di errore
        audioElement.src = ""; 
    });
}

/**
 * Ferma completamente la riproduzione audio e scarica il buffer
 * rimuovendo l'attributo src.
 */
function stopStream() {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.removeAttribute('src'); // Fondamentale per fermare il download dei dati in background
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
 * Funzione di utilità per aggiornare l'interfaccia utente con messaggi di stato.
 * @param {string} message - Il messaggio da mostrare.
 * @param {string} color - Il colore del testo.
 */
function updateStatus(message, color) {
    statusDisplay.textContent = message;
    statusDisplay.style.color = color;
}

// Assegnazione degli Event Listener
playBtn.addEventListener('click', playStream);
stopBtn.addEventListener('click', stopStream);
volumeCtrl.addEventListener('input', updateVolume);

// Inizializza il volume corrente all'avvio
updateVolume();
