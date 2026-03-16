// Riferimenti agli elementi del DOM
const audioElement = document.getElementById('audioElement');
const streamUrlInput = document.getElementById('streamUrl');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const volumeCtrl = document.getElementById('volumeCtrl');
const statusDisplay = document.getElementById('statusDisplay');

const stationNameInput = document.getElementById('stationName');
const saveDbBtn = document.getElementById('saveDbBtn');
const savedRadiosContainer = document.getElementById('savedRadiosContainer');

// ==========================================
// CONFIGURAZIONE DATABASE SUPABASE
// ==========================================
const SUPABASE_PROJECT_URL = 'https://wwlqjdkgkkguqetzvyss.supabase.co';
const SUPABASE_API_ENDPOINT = `${SUPABASE_PROJECT_URL}/rest/v1/Rsf`;

// La tua chiave corretta con la "e" minuscola iniziale
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bHFqZGtna2tndXFldHp2eXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDc4MDUsImV4cCI6MjA4OTIyMzgwNX0.WTNvKyYRSdcAO8m_GklxSoLq8l8uwbvxk3YtBDxHhWM';

/**
 * Avvia la riproduzione dello stream recuperando l'URL dall'input.
 */
function playStream() {
    const streamUrl = streamUrlInput.value.trim();

    if (streamUrl === "") {
        updateStatus("Errore: Nessun URL inserito.", "#e22134");
        return;
    }

    // Forza la ricarica per svuotare buffer precedenti
    audioElement.pause();
    audioElement.removeAttribute('src');
    audioElement.load();

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
 * METODO COMPLETO: POST
 * Salva il link e il nome nel database Supabase.
 */
async function saveLinkToDatabase() {
    const streamUrl = streamUrlInput.value.trim();
    const stationName = stationNameInput.value.trim();

    if (streamUrl === "" || stationName === "") {
        updateStatus("Errore: Inserisci URL e Nome della radio prima di salvare.", "#e22134");
        return;
    }

    const dataPayload = {
        name: stationName,
        url: streamUrl
    };

    try {
        updateStatus("Salvataggio in corso...", "#b3b3b3");
        saveDbBtn.disabled = true;

        const response = await fetch(SUPABASE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(dataPayload)
        });

        if (!response.ok) {
            throw new Error(`Errore Server: ${response.status}`);
        }

        updateStatus(`"${stationName}" salvata nel Database!`, "#1db954");
        stationNameInput.value = ""; 
        
        // Ricarica la lista per mostrare subito il nuovo bottone
        loadSavedRadios();

    } catch (error) {
        console.error("Errore API Database:", error);
        updateStatus("Errore nel salvataggio. Controlla la console.", "#e22134");
    } finally {
        saveDbBtn.disabled = false;
    }
}

/**
 * METODO COMPLETO: DELETE
 * Elimina una radio dal database.
 */
async function deleteRadioFromDatabase(id, nomeRadio) {
    // Chiede conferma prima di eliminare
    if (!confirm(`Vuoi davvero eliminare la radio "${nomeRadio}"?`)) {
        return; 
    }

    try {
        updateStatus(`Eliminazione di "${nomeRadio}" in corso...`, "#b3b3b3");
        
        const response = await fetch(`${SUPABASE_API_ENDPOINT}?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Errore Server: ${response.status}`);
        }

        updateStatus(`"${nomeRadio}" eliminata con successo.`, "#e22134");
        
        // Aggiorna la lista
        loadSavedRadios();

    } catch (error) {
        console.error("Errore eliminazione:", error);
        updateStatus("Errore durante l'eliminazione.", "#e22134");
    }
}

/**
 * METODO COMPLETO: GET
 * Recupera tutte le radio salvate nel database Supabase e crea i bottoni.
 */
async function loadSavedRadios() {
    try {
        // Aggiunto l'ordinamento decrescente così le ultime salvate appaiono per prime
        const response = await fetch(`${SUPABASE_API_ENDPOINT}?select=*&order=id.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Errore Server: ${response.status}`);
        }

        const data = await response.json();
        
        // Svuota il contenitore prima di riempirlo di nuovo
        savedRadiosContainer.innerHTML = "";

        if (data.length === 0) {
            savedRadiosContainer.innerHTML = "<p style='color: #b3b3b3; font-size: 13px;'>Nessuna radio salvata al momento.</p>";
            return;
        }

        // Crea un bottone per ogni radio ricevuta dal DB
        data.forEach(radio => {
            // Contenitore per allineare bottone Play e bottone Elimina
            const wrapper = document.createElement('div');
            wrapper.style.display = "flex";
            wrapper.style.gap = "8px";
            wrapper.style.marginTop = "8px";

            const radioName = radio.name || radio.Nome || "Radio Sconosciuta";
            const radioUrl = radio.url || radio.Url || "";
            const radioId = radio.id;

            // --- Bottone per ASCOLTARE ---
            const btnPlay = document.createElement('button');
            btnPlay.textContent = `📻 Ascolta ${radioName}`;
            btnPlay.style.backgroundColor = "#282828";
            btnPlay.style.color = "white";
            btnPlay.style.flexGrow = "1"; // Fa prendere tutto lo spazio rimasto al bottone play
            btnPlay.style.textAlign = "left";
            btnPlay.style.border = "1px solid #333";
            btnPlay.style.padding = "10px";
            btnPlay.style.cursor = "pointer";
            btnPlay.style.borderRadius = "6px";
            btnPlay.style.transition = "background-color 0.2s";

            btnPlay.onmouseover = () => btnPlay.style.backgroundColor = "#3e3e3e";
            btnPlay.onmouseout = () => btnPlay.style.backgroundColor = "#282828";
            
            btnPlay.addEventListener('click', () => {
                streamUrlInput.value = radioUrl;
                playStream();
            });

            // --- Bottone per ELIMINARE ---
            const btnDelete = document.createElement('button');
            btnDelete.textContent = "❌";
            btnDelete.style.backgroundColor = "transparent";
            btnDelete.style.color = "#e22134";
            btnDelete.style.border = "1px solid #e22134";
            btnDelete.style.padding = "10px 15px";
            btnDelete.style.cursor = "pointer";
            btnDelete.style.borderRadius = "6px";
            btnDelete.style.transition = "all 0.2s";

            btnDelete.onmouseover = () => {
                btnDelete.style.backgroundColor = "#e22134";
                btnDelete.style.color = "white";
            };
            btnDelete.onmouseout = () => {
                btnDelete.style.backgroundColor = "transparent";
                btnDelete.style.color = "#e22134";
            };

            btnDelete.addEventListener('click', () => {
                deleteRadioFromDatabase(radioId, radioName);
            });

            // Aggiunge i bottoni al contenitore e il contenitore alla pagina
            wrapper.appendChild(btnPlay);
            wrapper.appendChild(btnDelete);
            savedRadiosContainer.appendChild(wrapper);
        });

    } catch (error) {
        console.error("Errore nel caricamento delle radio:", error);
        savedRadiosContainer.innerHTML = "<p style='color: #e22134; font-size: 13px;'>Errore di connessione al database.</p>";
    }
}

// ==========================================
// ASSEGNAZIONE EVENT LISTENER E INIZIALIZZAZIONE
// ==========================================
playBtn.addEventListener('click', playStream);
stopBtn.addEventListener('click', stopStream);
volumeCtrl.addEventListener('input', updateVolume);
saveDbBtn.addEventListener('click', saveLinkToDatabase);

// Imposta il volume all'avvio
updateVolume();
// Recupera le radio dal database non appena si apre la pagina
loadSavedRadios();
