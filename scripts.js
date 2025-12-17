document.addEventListener('DOMContentLoaded', () => {

    const appState = {
        clients: [],
        timer: {
            interval: null,
            startTime: 0,
            elapsedTime: 0,
            isRunning: false,
            isPaused: false,
        },
        activeView: 'login',
        loggedInUser: null,
        currentInvoiceData: null,
    };

    const $ = (selector) => document.querySelector(selector);

    // --- API Communication ---
    async function callAppsScript(action, payload = {}, method = 'POST') {
        const SCRIPT_URL = localStorage.getItem('SCRIPT_URL');
        if (!SCRIPT_URL) {
            showToast('Error: La URL de Google Apps Script no está configurada.', true);
            switchView('setup');
            return;
        }

        document.body.style.cursor = 'wait';
        try {
            let response;
            if (method === 'POST') {
                response = await fetch(`${SCRIPT_URL}?action=${action}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify(payload)
                });
            } else { // GET
                response = await fetch(`${SCRIPT_URL}?action=${action}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(result.message);
            }
            return result;
        } catch (error) {
            showToast(`Error de red o del servidor: ${error.message}`, true);
            console.error('API Call Error:', error);
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    // --- UI Update Functions ---
    function showToast(message, isError = false) {
        const toast = $('#toast-notification');
        const toastMessage = $('#toast-message');
        toastMessage.textContent = message;
        toast.className = `fixed bottom-10 right-10 text-white py-3 px-6 rounded-lg shadow-xl text-lg transition-all duration-500 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    async function renderClients() {
        const result = await callAppsScript('getClients', {}, 'GET');
        if (result && result.data) {
            appState.clients = result.data;
            const tableBody = $('#clients-table-body');
            const clientSelect = $('#client-select');
            const noClientsMsg = $('#no-clients-message');

            tableBody.innerHTML = '';
            clientSelect.innerHTML = '<option value="">Seleccione un cliente</option>';

            if (appState.clients.length === 0) {
                noClientsMsg.classList.remove('hidden');
            } else {
                noClientsMsg.classList.add('hidden');
                appState.clients.forEach(client => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-gray-50 dark:hover:bg-zinc-600';
                    tr.innerHTML = `
                        <td class="p-4 font-medium">${client.name}</td>
                        <td class="p-4">${client.email}</td>
                        <td class="p-4">${client.phone || 'N/A'}</td>
                        <td class="p-4">
                            <button class="edit-client-btn text-blue-600" data-id="${client.id}">Editar</button>
                            <button class="delete-client-btn text-red-600 ml-4" data-id="${client.id}">Eliminar</button>
                        </td>
                    `;
                    tableBody.appendChild(tr);

                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = client.name;
                    clientSelect.appendChild(option);
                });
            }
        }
    }

    function switchView(viewId) {
        appState.activeView = viewId;
        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
        $(`#page-${viewId}`)?.classList.remove('hidden');

        if (viewId === 'login') {
            $('#app-container').classList.add('hidden');
            $('#login-modal').classList.remove('hidden');
        } else {
             $('#login-modal').classList.add('hidden');
            $('#app-container').classList.remove('hidden');
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            $(`a[href="#${viewId}"]`)?.classList.add('active');
        }
    }

    function toggleClientModal(show = false, client = null) {
        const modal = $('#client-modal');
        if (show) {
            $('#client-form').reset();
            if (client) {
                $('#client-modal-title').textContent = 'Editar Cliente';
                $('#client-id').value = client.id;
                $('#client-name').value = client.name;
                $('#client-email').value = client.email;
                $('#client-phone').value = client.phone;
                $('#client-address').value = client.address;
            } else {
                $('#client-modal-title').textContent = 'Añadir Nuevo Cliente';
            }
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    function toggleInvoiceModal(show = false, data = null) {
        const modal = $('#invoice-modal');
        if (show && data) {
            appState.currentInvoiceData = data;
            const { client, hours, rate, total } = data;
            $('#invoice-content').innerHTML = `
                <div class="flex justify-between"><span>Cliente:</span><span>${client.name}</span></div>
                <div class="flex justify-between"><span>Duración:</span><span>${hours.toFixed(4)} horas</span></div>
                <div class="flex justify-between"><span>Tarifa:</span><span>$${rate.toFixed(2)} / hora</span></div>
                <div class="flex justify-between font-bold text-2xl mt-4"><span>TOTAL:</span><span>$${total.toFixed(2)}</span></div>
            `;
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    // --- Timer Logic ---
    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function updateTimer() {
        const now = Date.now();
        const diff = now - appState.timer.startTime + appState.timer.elapsedTime;
        $('#timer-display').textContent = formatTime(diff);
    }

    function startTimer() {
        if (!$('#client-select').value || !$('#hourly-rate').value) {
            showToast('Selecciona un cliente y una tarifa.', true);
            return;
        }
        appState.timer.isRunning = true;
        appState.timer.isPaused = false;
        appState.timer.startTime = Date.now();
        appState.timer.interval = setInterval(updateTimer, 1000);
        $('#start-pause-button').textContent = 'Pausar';
        $('#stop-button').classList.remove('hidden');
    }

    function pauseTimer() {
        appState.timer.isPaused = true;
        appState.timer.isRunning = false;
        appState.timer.elapsedTime += Date.now() - appState.timer.startTime;
        clearInterval(appState.timer.interval);
        $('#start-pause-button').textContent = 'Reanudar';
    }

    function resumeTimer() {
        appState.timer.isPaused = false;
        appState.timer.isRunning = true;
        appState.timer.startTime = Date.now();
        appState.timer.interval = setInterval(updateTimer, 1000);
        $('#start-pause-button').textContent = 'Pausar';
    }

    function stopTimer() {
        const finalElapsedTime = appState.timer.elapsedTime + (appState.timer.isRunning ? (Date.now() - appState.timer.startTime) : 0);
        clearInterval(appState.timer.interval);

        const hours = finalElapsedTime / 3600000;
        const rate = parseFloat($('#hourly-rate').value);
        const total = hours * rate;
        const client = appState.clients.find(c => c.id == $('#client-select').value);

        toggleInvoiceModal(true, { client, hours, rate, total, clientId: client.id, date: new Date().toISOString() });

        // Reset timer state
        Object.assign(appState.timer, { interval: null, startTime: 0, elapsedTime: 0, isRunning: false, isPaused: false });
        $('#timer-display').textContent = '00:00:00';
        $('#start-pause-button').textContent = 'Iniciar';
        $('#stop-button').classList.add('hidden');
    }

    // --- Event Handlers ---
    $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('#username').value;
        const password = $('#password').value;

        const result = await callAppsScript('checkLogin', { username, password }, 'POST');
        if (result && result.status === 'success') {
            appState.loggedInUser = username;
            localStorage.setItem('loggedInUser', username);
            $('#user-display').textContent = `Usuario: ${username}`;
            showToast('Inicio de sesión exitoso!');
            switchView('dashboard');
            renderClients();
        } else {
            showToast('Usuario o contraseña incorrectos.', true);
        }
    });

    $('#logout-button').addEventListener('click', () => {
        appState.loggedInUser = null;
        localStorage.removeItem('loggedInUser');
        switchView('login');
    });

    $('#go-to-setup-button').addEventListener('click', () => switchView('setup'));

    $('#save-script-url').addEventListener('click', () => {
        const url = $('#script-url-input').value;
        if (url) {
            localStorage.setItem('SCRIPT_URL', url);
            showToast('URL de Google Apps Script guardada.');
        } else {
            showToast('Por favor, introduce una URL válida.', true);
        }
    });

    $('#setup-tables-button').addEventListener('click', async () => {
        const spreadsheetUrl = $('#spreadsheet-url-input').value;
        if (!spreadsheetUrl) {
            showToast('Por favor, introduce la URL de tu Google Sheet.', true);
            return;
        }
        const result = await callAppsScript('setup', { spreadsheetUrl }, 'POST');
        if (result && result.status === 'success') {
            showToast('Las tablas se han configurado correctamente en tu Google Sheet!');
        }
    });

    $('#add-client-button').addEventListener('click', () => toggleClientModal(true));
    $('#cancel-client-modal').addEventListener('click', () => toggleClientModal(false));
    $('#close-invoice-modal').addEventListener('click', () => toggleInvoiceModal(false));

    $('#start-pause-button').addEventListener('click', () => {
        if (appState.timer.isRunning) pauseTimer();
        else if (appState.timer.isPaused) resumeTimer();
        else startTimer();
    });

    $('#stop-button').addEventListener('click', stopTimer);

    $('#client-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientData = {
            id: $('#client-id').value,
            name: $('#client-name').value,
            email: $('#client-email').value,
            phone: $('#client-phone').value,
            address: $('#client-address').value,
        };
        const action = clientData.id ? 'updateClient' : 'addClient';
        const result = await callAppsScript(action, clientData);

        if (result && result.status === 'success') {
            showToast(`Cliente ${clientData.id ? 'actualizado' : 'añadido'} con éxito.`);
            toggleClientModal(false);
            renderClients();
        }
    });

    $('#clients-table-body').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;

        if (target.classList.contains('edit-client-btn')) {
            const client = appState.clients.find(c => c.id == id);
            if(client) toggleClientModal(true, client);
        }

        if (target.classList.contains('delete-client-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
                const result = await callAppsScript('deleteClient', { id });
                if (result && result.status === 'success') {
                    showToast('Cliente eliminado.');
                    renderClients();
                }
            }
        }
    });

    $('#save-invoice-button').addEventListener('click', async () => {
        if (appState.currentInvoiceData) {
            const result = await callAppsScript('saveInvoice', appState.currentInvoiceData);
            if(result && result.status === 'success') {
                showToast('Factura guardada.');
                toggleInvoiceModal(false);
            }
        }
    });

    // --- Initialization ---
    function init() {
        const savedUser = localStorage.getItem('loggedInUser');
        const scriptUrl = localStorage.getItem('SCRIPT_URL');

        if (!scriptUrl) {
            switchView('setup');
        } else if (savedUser) {
            appState.loggedInUser = savedUser;
            $('#user-display').textContent = `Usuario: ${savedUser}`;
            switchView('dashboard');
            renderClients();
        } else {
            switchView('login');
        }

        $('#script-url-input').value = scriptUrl || '';

        // Dark Mode
        const darkModeToggle = $('#dark-mode-toggle');
        const enableDarkMode = () => {
            document.documentElement.classList.add('dark');
            darkModeToggle.textContent = 'Modo Claro ☀️';
            localStorage.setItem('theme', 'dark');
        };
        const disableDarkMode = () => {
            document.documentElement.classList.remove('dark');
            darkModeToggle.textContent = 'Modo Oscuro 🌙';
            localStorage.setItem('theme', 'light');
        };
        darkModeToggle.addEventListener('click', () => {
            if (document.documentElement.classList.contains('dark')) disableDarkMode();
            else enableDarkMode();
        });
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            enableDarkMode();
        }
    }

    init();
});
