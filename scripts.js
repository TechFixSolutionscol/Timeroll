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
        activeView: 'dashboard',
        currentInvoiceData: null,
        // Almacenar URLs y estado de autenticación
        config: {
            scriptUrl: localStorage.getItem('scriptUrl') || '',
            spreadsheetUrl: localStorage.getItem('spreadsheetUrl') || '', // Opcional pero bueno tenerlo
        },
        auth: {
            isLoggedIn: false,
            username: '',
        }
    };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const elements = {
        setupContainer: $('#setup-container'),
        setupForm: $('#setup-form'),
        scriptUrlInput: $('#script-url'),
        spreadsheetUrlInput: $('#spreadsheet-url'),
        setupDatabaseButton: $('#setup-database-button'),
        showSetupButton: $('#show-setup-button'),

        appContainer: $('#app-container'),
        loginModal: $('#login-modal'),
        loginForm: $('#login-form'),
        usernameInput: $('#username'),
        passwordInput: $('#password'),
        usernameDisplay: $('#username-display'),

        logoutButton: $('#logout-button'),
        navItems: $$('.nav-item'),
        pages: $$('.page'),
        timerDisplay: $('#timer-display'),
        clientSelect: $('#client-select'),
        hourlyRate: $('#hourly-rate'),
        startPauseButton: $('#start-pause-button'),
        stopButton: $('#stop-button'),
        clientsTableBody: $('#clients-table-body'),
        addClientButton: $('#add-client-button'),
        clientModal: $('#client-modal'),
        clientForm: $('#client-form'),
        cancelClientModal: $('#cancel-client-modal'),
        clientIdInput: $('#client-id'),
        clientModalTitle: $('#client-modal-title'),
        invoiceModal: $('#invoice-modal'),
        invoiceContent: $('#invoice-content'),
        sendInvoiceButton: $('#send-invoice-button'),
        closeInvoiceModalButton: $('#close-invoice-modal-button'),
        noClientsMessage: $('#no-clients-message'),
        toast: $('#toast-notification'),
        toastMessage: $('#toast-message'),
        darkModeToggle: $('#dark-mode-toggle'),
    };

    // =================================================================================
    // API COMMUNICATION
    // =================================================================================

    /**
     * Función centralizada para realizar llamadas al backend de Google Apps Script.
     * @param {string} action - La acción a ejecutar en el backend (ej. 'getClients').
     * @param {Object} [payload={}] - Los datos a enviar con la solicitud.
     * @returns {Promise<any>} - La respuesta del backend.
     */
    async function apiCall(action, payload = {}) {
        if (!appState.config.scriptUrl) {
            showToast("Error: La URL del script no está configurada.", true);
            throw new Error("Script URL is not configured.");
        }

        try {
            const response = await fetch(appState.config.scriptUrl, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ action, payload }),
                redirect: 'follow'
            });

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(result.message);
            }
            return result.data;
        } catch (error) {
            showToast(`Error de red: ${error.message}`, true);
            console.error("API Call Error:", error);
            throw error;
        }
    }

    // =================================================================================
    // UTILITY FUNCTIONS
    // =================================================================================

    function showToast(message, isError = false) {
        elements.toastMessage.textContent = message;
        elements.toast.className = `fixed bottom-10 right-10 text-white py-3 px-6 rounded-lg shadow-xl text-lg transition-all duration-500 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        elements.toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            elements.toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    function switchView(viewId) {
        appState.activeView = viewId;
        elements.pages.forEach(page => page.classList.add('hidden'));
        $(`#page-${viewId}`).classList.remove('hidden');
        elements.navItems.forEach(item => item.classList.remove('active'));
        $(`a[href="#${viewId}"]`).classList.add('active');
    }

    // =================================================================================
    // SETUP AND CONFIGURATION
    // =================================================================================

    function showView(view) {
        $('#setup-container').classList.add('hidden');
        $('#app-container').classList.add('hidden');
        $('#login-modal').classList.add('hidden');

        if (view === 'setup') {
            $('#setup-container').classList.remove('hidden');
        } else if (view === 'login') {
            $('#login-modal').classList.remove('hidden');
             setTimeout(() => {
                $('#login-modal').querySelector('.modal-content').classList.remove('scale-95');
            }, 10);
        } else if (view === 'app') {
            $('#app-container').classList.remove('hidden');
        }
    }

    function saveConfig(scriptUrl, spreadsheetUrl) {
        localStorage.setItem('scriptUrl', scriptUrl);
        localStorage.setItem('spreadsheetUrl', spreadsheetUrl);
        appState.config.scriptUrl = scriptUrl;
        appState.config.spreadsheetUrl = spreadsheetUrl;
        elements.setupDatabaseButton.disabled = false;
        showToast("Configuración guardada.");
    }

    async function setupDatabase() {
        try {
            const result = await apiCall('setup');
            showToast(result.message || "Tablas creadas con éxito.");
            // Una vez configurado, podríamos llevar al login
            setTimeout(() => showView('login'), 1000);
        } catch (error) {
            showToast("Error al crear las tablas: " + error.message, true);
        }
    }

    // =================================================================================
    // AUTHENTICATION
    // =================================================================================

    async function handleLogin(e) {
        e.preventDefault();
        const username = elements.usernameInput.value;
        const password = elements.passwordInput.value;

        try {
            const result = await apiCall('login', { username, password });
            if (result.success) {
                appState.auth.isLoggedIn = true;
                appState.auth.username = username;
                elements.usernameDisplay.textContent = `Usuario: ${username}`;
                showToast(result.message);
                showView('app');
                loadInitialData();
            } else {
                showToast(result.message, true);
            }
        } catch (error) {
            showToast("Error de inicio de sesión: " + error.message, true);
        }
    }

    function handleLogout() {
        appState.auth.isLoggedIn = false;
        appState.auth.username = '';
        elements.usernameInput.value = '';
        elements.passwordInput.value = '';
        showView('login');
        showToast("Sesión cerrada.");
    }

    // =================================================================================
    // CLIENT MANAGEMENT
    // =================================================================================

    async function loadInitialData() {
        try {
            const clients = await apiCall('getClients');
            appState.clients = clients;
            renderClients();
        } catch (error) {
            showToast("No se pudieron cargar los clientes.", true);
        }
    }

    function renderClients() {
        elements.clientsTableBody.innerHTML = '';
        elements.clientSelect.innerHTML = '<option value="">Selecciona un cliente</option>';

        if (appState.clients.length === 0) {
            elements.noClientsMessage.classList.remove('hidden');
        } else {
            elements.noClientsMessage.classList.add('hidden');
            appState.clients.forEach(client => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-gray-50 dark:hover:bg-zinc-600';
                tr.innerHTML = `
                    <td class="p-4 font-medium">${client.name}</td>
                    <td class="p-4">${client.email}</td>
                    <td class="p-4">${client.phone || 'N/A'}</td>
                    <td class="p-4">
                        <button class="edit-client-btn text-blue-600 hover:text-blue-800 mr-4" data-id="${client.id}">Editar</button>
                        <button class="delete-client-btn text-red-600 hover:text-red-800" data-id="${client.id}">Eliminar</button>
                    </td>
                `;
                elements.clientsTableBody.appendChild(tr);

                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                elements.clientSelect.appendChild(option);
            });
        }
    }

    function toggleClientModal(show = false, client = null) {
        if (show) {
            elements.clientForm.reset();
            if (client) {
                elements.clientModalTitle.textContent = 'Editar Cliente';
                $('#client-id').value = client.id;
                $('#client-name').value = client.name;
                $('#client-email').value = client.email;
                $('#client-phone').value = client.phone;
                $('#client-address').value = client.address;
            } else {
                elements.clientModalTitle.textContent = 'Añadir Nuevo Cliente';
            }
            elements.clientModal.classList.remove('hidden');
        } else {
            elements.clientModal.classList.add('hidden');
        }
    }

    async function handleClientFormSubmit(e) {
        e.preventDefault();
        const id = $('#client-id').value;
        const clientData = {
            name: $('#client-name').value,
            email: $('#client-email').value,
            phone: $('#client-phone').value,
            address: $('#client-address').value,
        };

        try {
            if (id) {
                clientData.id = id;
                await apiCall('updateClient', clientData);
                showToast('Cliente actualizado con éxito.');
            } else {
                await apiCall('addClient', clientData);
                showToast('Cliente añadido con éxito.');
            }
            loadInitialData(); // Recargar clientes
            toggleClientModal(false);
        } catch (error) {
            showToast("Error al guardar cliente: " + error.message, true);
        }
    }

    async function handleDeleteClient(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            try {
                await apiCall('deleteClient', { id });
                showToast('Cliente eliminado.');
                loadInitialData();
            } catch (error) {
                 showToast("Error al eliminar cliente: " + error.message, true);
            }
        }
    }

    // =================================================================================
    // TIMER AND INVOICING
    // =================================================================================

    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateTimer() {
        const now = Date.now();
        const diff = now - appState.timer.startTime + appState.timer.elapsedTime;
        elements.timerDisplay.textContent = formatTime(diff);
    }

    function startTimer() {
        if (!elements.clientSelect.value) {
            showToast('Por favor, selecciona un cliente.', true);
            return;
        }
        if (!elements.hourlyRate.value || parseFloat(elements.hourlyRate.value) <= 0) {
            showToast('Por favor, introduce un valor por hora válido.', true);
            return;
        }
        appState.timer.isRunning = true;
        appState.timer.isPaused = false;
        appState.timer.startTime = Date.now();
        appState.timer.interval = setInterval(updateTimer, 1000);
        elements.startPauseButton.textContent = 'Pausar';
        elements.stopButton.classList.remove('hidden');
    }

    function pauseTimer() {
        appState.timer.isPaused = true;
        appState.timer.isRunning = false;
        appState.timer.elapsedTime += Date.now() - appState.timer.startTime;
        clearInterval(appState.timer.interval);
        elements.startPauseButton.textContent = 'Reanudar';
    }

    function resumeTimer() {
        appState.timer.isPaused = false;
        appState.timer.isRunning = true;
        appState.timer.startTime = Date.now();
        appState.timer.interval = setInterval(updateTimer, 1000);
        elements.startPauseButton.textContent = 'Pausar';
    }

    function stopTimer() {
        const finalElapsedTime = appState.timer.elapsedTime + (appState.timer.isRunning ? (Date.now() - appState.timer.startTime) : 0);
        clearInterval(appState.timer.interval);

        const hours = finalElapsedTime / (1000 * 60 * 60);
        const rate = parseFloat(elements.hourlyRate.value);
        const total = hours * rate;
        const client = appState.clients.find(c => c.id == elements.clientSelect.value);

        appState.currentInvoiceData = { client, hours, rate, total };
        toggleInvoiceModal(true, appState.currentInvoiceData);

        // Reset state
        appState.timer = { interval: null, startTime: 0, elapsedTime: 0, isRunning: false, isPaused: false };
        elements.timerDisplay.textContent = '00:00:00';
        elements.startPauseButton.textContent = 'Iniciar';
        elements.stopButton.classList.add('hidden');
    }

    function toggleInvoiceModal(show = false, data = null) {
        if (show && data) {
            const { client, hours, rate, total } = data;
            elements.invoiceContent.innerHTML = `
                <div class="flex justify-between"><span>Cliente:</span><span>${client.name}</span></div>
                <div class="flex justify-between"><span>Duración:</span><span>${hours.toFixed(4)} horas</span></div>
                <div class="flex justify-between"><span>Tarifa:</span><span>$${rate.toFixed(2)} / hora</span></div>
                <div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t"><span>TOTAL:</span><span>$${total.toFixed(2)}</span></div>
            `;
            elements.invoiceModal.classList.remove('hidden');
        } else {
            elements.invoiceModal.classList.add('hidden');
        }
    }

    async function handleSendInvoice() {
        if (!appState.currentInvoiceData) return;
        try {
            await apiCall('addInvoice', appState.currentInvoiceData);
            showToast("Factura guardada con éxito.");
            toggleInvoiceModal(false);
        } catch (error) {
            showToast("Error al guardar la factura: " + error.message, true);
        }
    }

    // =================================================================================
    // DARK MODE
    // =================================================================================
    function toggleDarkMode() {
        document.documentElement.classList.toggle('dark');
        const isDarkMode = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        elements.darkModeToggle.textContent = isDarkMode ? 'Modo Claro ☀️' : 'Modo Oscuro 🌙';
    }


    // =================================================================================
    // INITIALIZATION AND EVENT LISTENERS
    // =================================================================================

    function addEventListeners() {
        elements.setupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveConfig(elements.scriptUrlInput.value, elements.spreadsheetUrlInput.value);
        });

        elements.setupDatabaseButton.addEventListener('click', setupDatabase);
        elements.showSetupButton.addEventListener('click', () => showView('setup'));
        elements.loginForm.addEventListener('submit', handleLogin);
        elements.logoutButton.addEventListener('click', handleLogout);

        elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(e.currentTarget.getAttribute('href').substring(1));
            });
        });

        elements.addClientButton.addEventListener('click', () => toggleClientModal(true));
        elements.cancelClientModal.addEventListener('click', () => toggleClientModal(false));
        elements.clientForm.addEventListener('submit', handleClientFormSubmit);

        elements.clientsTableBody.addEventListener('click', e => {
            if (e.target.classList.contains('edit-client-btn')) {
                const id = e.target.dataset.id;
                const client = appState.clients.find(c => c.id == id);
                toggleClientModal(true, client);
            }
            if (e.target.classList.contains('delete-client-btn')) {
                handleDeleteClient(e.target.dataset.id);
            }
        });

        elements.startPauseButton.addEventListener('click', () => {
            if (appState.timer.isRunning) pauseTimer();
            else if (appState.timer.isPaused) resumeTimer();
            else startTimer();
        });

        elements.stopButton.addEventListener('click', stopTimer);
        elements.sendInvoiceButton.addEventListener('click', handleSendInvoice);
        elements.closeInvoiceModalButton.addEventListener('click', () => toggleInvoiceModal(false));
        elements.darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    function init() {
        // Cargar URLs desde localStorage
        elements.scriptUrlInput.value = appState.config.scriptUrl;
        elements.spreadsheetUrlInput.value = appState.config.spreadsheetUrl;
        if (appState.config.scriptUrl) {
            elements.setupDatabaseButton.disabled = false;
        }

        // Determinar vista inicial
        if (!appState.config.scriptUrl) {
            showView('setup');
        } else {
            showView('login');
        }

        // Configurar modo oscuro
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            elements.darkModeToggle.textContent = 'Modo Claro ☀️';
        } else {
             elements.darkModeToggle.textContent = 'Modo Oscuro 🌙';
        }

        switchView('dashboard');
        addEventListeners();
    }

    init();
});
