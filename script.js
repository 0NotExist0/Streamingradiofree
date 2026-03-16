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

// INCOLLA QUI LA TUA CHIAVE CHE INIZIA PER "eyJ" AL POSTO DI QUESTA SCRITTA:
const SUPABASE_ANON_KEY = 'INCOLLA_QUI_LA_TUA_CHIAVE_eyJ'; 

/**
 * Avvia la riproduzione dello stream.
 */
function playStream() {
    const streamUrl = streamUrlInput.value.trim();

    if (streamUrl === "") {
        updateStatus("WARNING: GALAXY COORDINATES MISSING", "var(--void-red)");
        return;
    }

    audioElement.pause();
    audioElement.removeAttribute('src');
    audioElement.load();

    audioElement.src = streamUrl;
    updateStatus("TUNING INTO FREQUENCY...", "var(--milano-orange)");

    audioElement.play().then(() => {
        updateStatus("TRANSMISSION LOCKED ✧", "var(--holo-cyan)");
    }).catch((error) => {
        console.error("DUMP:", error);
        updateStatus(`INTERFERENCE DETECTED: ${error.message || "BLOCKED BY LOCAL AUTHORITIES"}`, "var(--void-red)");
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
    updateStatus("COMMUNICATIONS SEVERED.", "var(--void-red)");
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
        updateStatus("WARNING: INPUT REQUIRED FOR UPLOAD", "var(--void-red)");
        return;
    }

    const dataPayload = { name: stationName, url: streamUrl };

    try {
        updateStatus("BEAMING TO GALAXY DRIVE...", "var(--milano-orange)");
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

        if (!response.ok) throw new Error(`CORE_ERR: ${response.status}`);

        updateStatus(`"${stationName}" SECURED IN ARCHIVE.`, "var(--holo-cyan)");
        stationNameInput.value = ""; 
        loadSavedRadios();

    } catch (error) {
        console.error("DB_ERR:", error);
        updateStatus("UPLOAD INTERCEPTED.", "var(--void-red)");
    } finally {
        saveDbBtn.disabled = false;
    }
}

/**
 * METODO COMPLETO: DELETE
 * Elimina un record specifico dal database Supabase in base all'ID.
 */
async function deleteRadioFromDatabase(id, nomeRadio) {
    if (!confirm(`CANCELLARE "${nomeRadio}" DALL'ARCHIVIO? Questa mossa non si può annullare.`)) {
        return; 
    }

    try {
        updateStatus(`ERASING FREQUENCY ID:${id}...`, "var(--milano-orange)");
        
        const response = await fetch(`${SUPABASE_API_ENDPOINT}?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error(`CORE_ERR: ${response.status}`);

        updateStatus(`"${nomeRadio}" VAPORIZED.`, "var(--void-red)");
        
        loadSavedRadios();

    } catch (error) {
        console.error("DELETE_ERR:", error);
        updateStatus("VAPORIZATION FAILED.", "var(--void-red)");
    }
}

/**
 * METODO COMPLETO: GET & RENDER UI
 * Recupera i dati e costruisce l'interfaccia.
 */
async function loadSavedRadios() {
    try {
        const response = await fetch(`${SUPABASE_API_ENDPOINT}?select=*&order=id.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`CORE_ERR: ${response.status}`);

        const data = await response.json();
        savedRadiosContainer.innerHTML = "";

        if (data.length === 0) {
            savedRadiosContainer.innerHTML = "<p style='color: var(--holo-cyan); font-size: 11px;'>✧ NO FREQUENCIES DETECTED ✧</p>";
            return;
        }

        data.forEach((radio, index) => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.animationDelay = `${index * 0.08}s`;

            const radioName = radio.name || radio.Nome || "UNKNOWN_FREQ";
            const radioUrl = radio.url || radio.Url || "";
            const radioId = radio.id;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'file-info';
            infoDiv.innerHTML = `
                <span class="file-name">✧ ${radioName}</span>
                <span class="file-id">SYS_ID: ${radioId}</span>
            `;

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.textContent = "VAPORIZE";
            
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                deleteRadioFromDatabase(radioId, radioName);
            });

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
        savedRadiosContainer.innerHTML = "<p style='color: var(--void-red); font-size: 11px;'>✧ CONNECTION LOST TO GALAXY DRIVE ✧</p>";
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
