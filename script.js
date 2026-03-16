// Riferimenti DOM
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
const SUPABASE_ANON_KEY = 'INCOLLA_QUI_LA_TUA_CHIAVE_eyJ'; // RICORDATI LA CHIAVE!

/**
 * Avvia la riproduzione dello stream.
 */
function playStream() {
    const streamUrl = streamUrlInput.value.trim();

    if (streamUrl === "") {
        updateStatus("ERR: NO_DATA_STREAM", "var(--accent-red)");
        return;
    }

    audioElement.pause();
    audioElement.removeAttribute('src');
    audioElement.load();

    audioElement.src = streamUrl;
    updateStatus("ESTABLISHING CONNECTION...", "var(--text-muted)");

    audioElement.play().then(() => {
        updateStatus("STREAM ACTIVE // AUDIO ENGAGED", "var(--accent-cyan)");
    }).catch((error) => {
        console.error("DUMP:", error);
        updateStatus(`CONNECTION_REJECTED: ${error.message || "BLOCKED"}`, "var(--accent-red)");
        audioElement.src = ""; 
    });
}

/**
 * Ferma completamente la riproduzione.
 */
function stopStream() {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.removeAttribute('src'); 
    audioElement.load();
    updateStatus("STREAM ABORTED.", "var(--text-muted)");
}

/**
 * Aggiorna il volume.
 */
function updateVolume() {
    audioElement.volume = volumeCtrl.value;
}

/**
 * Funzione di utilità per il terminale.
 */
function updateStatus(message, color) {
    statusDisplay.textContent = message;
    statusDisplay.style.color = color;
    statusDisplay.style.borderLeftColor = color;
}

/**
 * METODO COMPLETO: POST
 * Salva nel database Supabase.
 */
async function saveLinkToDatabase() {
    const streamUrl = streamUrlInput.value.trim();
    const stationName = stationNameInput.value.trim();

    if (streamUrl === "" || stationName === "") {
        updateStatus("ERR: MISSING_PARAMETERS", "var(--accent-red)");
        return;
    }

    const dataPayload = { name: stationName, url: streamUrl };

    try {
        updateStatus("UPLOADING TO MAINFRAME...", "var(--text-muted)");
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

        if (!response.ok) throw new Error(`SERVER_ERR: ${response.status}`);

        updateStatus(`FILE "${stationName}" UPLOADED SECURELY.`, "var(--accent-cyan)");
        stationNameInput.value = ""; 
        loadSavedRadios();

    } catch (error) {
        console.error("DB_ERR:", error);
        updateStatus("UPLOAD FAILED.", "var(--accent-red)");
    } finally {
        saveDbBtn.disabled = false;
    }
}

/**
 * METODO COMPLETO: DELETE
 * Elimina un record specifico dal database Supabase in base all'ID.
 */
async function deleteRadioFromDatabase(id, nomeRadio) {
    if (!confirm(`ATTENZIONE: Procedere al PURGE del file [${nomeRadio}]? L'azione è irreversibile.`)) {
        return; // L'utente ha annullato
    }

    try {
        updateStatus(`PURGING FILE ID:${id}...`, "var(--text-muted)");
        
        // Chiamata REST per il DELETE in Supabase richiede il parametro id nell'URL (es: ?id=eq.123)
        const response = await fetch(`${SUPABASE_API_ENDPOINT}?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error(`SERVER_ERR: ${response.status}`);

        updateStatus(`FILE [${nomeRadio}] PURGED SUCCESSFULLY.`, "var(--accent-red)");
        
        // Ricarica la lista per aggiornare la UI
        loadSavedRadios();

    } catch (error) {
        console.error("DELETE_ERR:", error);
        updateStatus("PURGE FAILED.", "var(--accent-red)");
    }
}

/**
 * METODO COMPLETO: GET & RENDER UI
 * Recupera i dati e costruisce l'interfaccia a "cassetto" scorrevole.
 */
async function loadSavedRadios() {
    try {
        // Ordiniamo i risultati per ID decrescente per avere i più nuovi in alto
        const response = await fetch(`${SUPABASE_API_ENDPOINT}?select=*&order=id.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`SERVER_ERR: ${response.status}`);

        const data = await response.json();
        savedRadiosContainer.innerHTML = "";

        if (data.length === 0) {
            savedRadiosContainer.innerHTML = "<p style='color: var(--text-muted); font-size: 12px;'>// DRAWER EMPTY.</p>";
            return;
        }

        // Crea i fascicoli
        data.forEach((radio, index) => {
            const card = document.createElement('div');
            card.className = 'file-card';
            // Staggering animation: aumenta il ritardo per ogni elemento successivo (0s, 0.1s, 0.2s...)
            card.style.animationDelay = `${index * 0.08}s`;

            const radioName = radio.name || radio.Nome || "UNKNOWN_FILE";
            const radioUrl = radio.url || radio.Url || "";
            const radioId = radio.id;

            // Info text
            const infoDiv = document.createElement('div');
            infoDiv.className = 'file-info';
            infoDiv.innerHTML = `
                <span class="file-name">> ${radioName}</span>
                <span class="file-id">SYS_ID: ${radioId}</span>
            `;

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.textContent = "PURGE";
            
            // Event Listener per l'eliminazione (usiamo stopPropagation per non far partire il Play quando si clicca Delete)
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                deleteRadioFromDatabase(radioId, radioName);
            });

            // Event Listener per riprodurre lo stream cliccando sulla card
            card.addEventListener('click', () => {
                streamUrlInput.value = radioUrl;
                playStream();
            });

            card.appendChild(infoDiv);
            card.appendChild(delBtn);
            savedRadiosContainer.appendChild(card);
        });

    } catch (error) {
        console.error("LOAD_ERR:", error);
        savedRadiosContainer.innerHTML = "<p style='color: var(--accent-red); font-size: 12px;'>// CONNECTION LOST TO MAINFRAME.</p>";
    }
}

// ==========================================
// INIZIALIZZAZIONE
// ==========================================
playBtn.addEventListener('click', playStream);
stopBtn.addEventListener('click', stopStream);
volumeCtrl.addEventListener('input', updateVolume);
saveDbBtn.addEventListener('click', saveLinkToDatabase);

updateVolume();
loadSavedRadios();
