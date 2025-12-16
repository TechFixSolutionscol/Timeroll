document.addEventListener('DOMContentLoaded', () => {

    const SCRIPT_URL = localStorage.getItem('SCRIPT_URL');

    const appState = {
        clients: [], // Will be fetched from backend
        timer: {
            interval: null,
            startTime: 0,
            elapsedTime: 0,
            isRunning: false,
            isPaused: false,
        },
        activeView: 'dashboard',
        currentInvoiceData: null,
    };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const elements = {
        appContainer: $('#app-container'),
        loginModal: $('#login-modal'),
        loginForm: $('#login-form'),
        loginButton: $('#login-button'),
        loginSpinner: $('#login-spinner'),
        loginErrorMessage: $('#login-error-message'),
        usernameInput: $('#username'),
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
        noClientsMessage: $('#no-clients-message'),
        toast: $('#toast-notification'),
        toastMessage: $('#toast-message'),
        generateEmailButton: $('#generate-email-button'),
        generateEmailSpinner: $('#generate-email-spinner'),
        emailDraftContainer: $('#email-draft-container'),
        emailDraftDisplay: $('#email-draft-display'),
        copyEmailDraftButton: $('#copy-email-draft-button'),
        darkModeToggle: $('#dark-mode-toggle'),
        sendWhatsappButton: $('#send-whatsapp-button'),

        // Setup page elements
        setupNavItem: $('#setup-nav-item'),
        scriptUrlInput: $('#script-url-input'),
        saveScriptUrlButton: $('#save-script-url'),
        urlSavedMessage: $('#url-saved-message'),
        setupTablesButton: $('#setup-tables-button'),
        setupSpinner: $('#setup-spinner'),
        setupStatusMessage: $('#setup-status-message'),
    };

    /**
     * Central function to communicate with the Google Apps Script backend.
     * @param {string} action - The action to be performed by the backend.
     * @param {object} payload - The data to send with the action.
     * @returns {Promise<any>} - The data from the backend response.
     */
    async function callAppsScript(action, payload = {}) {
        if (!SCRIPT_URL) {
            showToast('Error: La URL del script no está configurada.');
            throw new Error('Script URL is not set.');
        }

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ action, ...payload }),
                redirect: 'follow'
            });

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(result.message);
            }

            return result.data;
        } catch (error) {
            console.error(`Error calling action '${action}':`, error);
            showToast(`Error: ${error.message}`);
            throw error;
        }
    }


    function showToast(message) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            elements.toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    async function refreshClients() {
        try {
            const clients = await callAppsScript('getClients');
            appState.clients = clients;
            renderClients();
        } catch (error) {
            console.error("Could not refresh clients.", error);
        }
    }

    function renderClients() {
        elements.clientsTableBody.innerHTML = '';
        elements.clientSelect.innerHTML = '<option value="">Ningún cliente seleccionado</option>';

        if (!appState.clients || appState.clients.length === 0) {
            elements.noClientsMessage.classList.remove('hidden');
            elements.clientsTableBody.classList.add('hidden');
        } else {
            elements.noClientsMessage.classList.add('hidden');
            elements.clientsTableBody.classList.remove('hidden');

            appState.clients.forEach(client => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-gray-50 dark:hover:bg-zinc-600';
                tr.innerHTML = `
                    <td class="p-4 font-medium">${client.name}</td>
                    <td class="p-4 text-gray-600 dark:text-zinc-300">${client.email}</td>
                    <td class="p-4 text-gray-600 dark:text-zinc-300">${client.phone || 'N/A'}</td>
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

    function switchView(viewId) {
        appState.activeView = viewId;
        elements.pages.forEach(page => page.classList.add('hidden'));
        $(`#page-${viewId}`).classList.remove('hidden');
        elements.navItems.forEach(item => item.classList.remove('active'));
        const activeNavItem = $(`a[href="#${viewId}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
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
            setTimeout(() => {
                elements.clientModal.querySelector('.modal-content').classList.remove('scale-95');
                elements.clientModal.classList.remove('opacity-0');
            }, 10);
        } else {
            elements.clientModal.querySelector('.modal-content').classList.add('scale-95');
            elements.clientModal.classList.add('opacity-0');
            setTimeout(() => elements.clientModal.classList.add('hidden'), 300);
        }
    }

    function toggleInvoiceModal(show = false, data = null) {
        if (show && data) {
            const { client, hours, rate, total } = data;
            appState.currentInvoiceData = data;
            elements.invoiceContent.innerHTML = `
                <div class="flex justify-between"><span class="font-semibold">Cliente:</span><span class="dark:text-zinc-200">${client.name}</span></div>
                <div class="flex justify-between"><span class="font-semibold">Correo:</span><span class="dark:text-zinc-200">${client.email}</span></div>
                <div class="flex justify-between"><span class="font-semibold">Duración:</span><span class="dark:text-zinc-200">${hours.toFixed(4)} horas</span></div>
                <div class="flex justify-between"><span class="font-semibold">Tarifa:</span><span class="dark:text-zinc-200">$${rate.toFixed(2)} / hora</span></div>
                <div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600"><span class="font-semibold">TOTAL:</span><span class="dark:text-zinc-200">$${total.toFixed(2)}</span></div>
            `;
            elements.emailDraftContainer.classList.add('hidden');
            elements.emailDraftDisplay.textContent = '';
            elements.invoiceModal.classList.remove('hidden');
            setTimeout(() => elements.invoiceModal.querySelector('.modal-content').classList.remove('scale-95'), 10);
        } else {
            elements.invoiceModal.querySelector('.modal-content').classList.add('scale-95');
            setTimeout(() => elements.invoiceModal.classList.add('hidden'), 300);
        }
    }

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
            alert('Por favor, selecciona un cliente.');
            return;
        }
        if (!elements.hourlyRate.value || parseFloat(elements.hourlyRate.value) <= 0) {
            alert('Por favor, introduce un valor por hora válido.');
            return;
        }
        appState.timer.isRunning = true;
        appState.timer.isPaused = false;
        appState.timer.startTime = Date.now();
        appState.timer.interval = setInterval(updateTimer, 1000);
        elements.startPauseButton.textContent = 'Pausar';
        elements.stopButton.classList.remove('hidden');
        elements.clientSelect.disabled = true;
        elements.hourlyRate.disabled = true;
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

        toggleInvoiceModal(true, { client, hours, rate, total });

        appState.timer = { interval: null, startTime: 0, elapsedTime: 0, isRunning: false, isPaused: false };
        elements.timerDisplay.textContent = '00:00:00';
        elements.startPauseButton.textContent = 'Iniciar Sesión';
        elements.stopButton.classList.add('hidden');
        elements.clientSelect.disabled = false;
        elements.hourlyRate.disabled = false;
        elements.hourlyRate.value = '';
        elements.clientSelect.value = '';
    }

    async function handleLogin(e) {
        e.preventDefault();
        elements.loginSpinner.classList.remove('hidden');
        elements.loginButton.disabled = true;
        elements.loginErrorMessage.classList.add('hidden');

        const username = elements.usernameInput.value;
        const password = $('#password').value;

        try {
            const result = await callAppsScript('checkLogin', { username, password });
            if (result.loggedIn) {
                elements.usernameDisplay.textContent = username;
                elements.loginModal.querySelector('.modal-content').classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    elements.loginModal.classList.add('hidden');
                    elements.appContainer.classList.remove('hidden');
                }, 300);
                await refreshClients();
                switchView('dashboard');
            } else {
                elements.loginErrorMessage.textContent = result.message;
                elements.loginErrorMessage.classList.remove('hidden');
            }
        } catch (error) {
            elements.loginErrorMessage.textContent = error.message;
            elements.loginErrorMessage.classList.remove('hidden');
        } finally {
            elements.loginSpinner.classList.add('hidden');
            elements.loginButton.disabled = false;
        }
    }

    function handleLogout() {
        elements.appContainer.classList.add('hidden');
        elements.loginModal.classList.remove('hidden');
        elements.loginModal.querySelector('.modal-content').classList.remove('opacity-0');
        setTimeout(() => elements.loginModal.querySelector('.modal-content').classList.remove('scale-95'), 10);
        $('#password').value = '';
    }

    async function handleClientFormSubmit(e) {
        e.preventDefault();
        const id = parseInt(elements.clientIdInput.value);
        const clientData = {
            name: $('#client-name').value,
            email: $('#client-email').value,
            phone: $('#client-phone').value,
            address: $('#client-address').value,
        };

        try {
            if (id) {
                clientData.id = id;
                await callAppsScript('updateClient', { clientData });
                showToast('Cliente actualizado con éxito.');
            } else {
                await callAppsScript('addClient', { clientData });
                showToast('Cliente añadido con éxito.');
            }
            await refreshClients();
            toggleClientModal(false);
        } catch (error) {
            console.error('Failed to save client:', error);
        }
    }

    async function handleDeleteClient(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            try {
                await callAppsScript('deleteClient', { clientId: id });
                showToast('Cliente eliminado.');
                await refreshClients();
            } catch (error) {
                console.error('Failed to delete client:', error);
            }
        }
    }

    function enableDarkMode() {
        document.documentElement.classList.add('dark');
        if (elements.darkModeToggle) elements.darkModeToggle.textContent = 'Modo Claro ☀️';
        localStorage.setItem('theme', 'dark');
    }

    function disableDarkMode() {
        document.documentElement.classList.remove('dark');
        if (elements.darkModeToggle) elements.darkModeToggle.textContent = 'Modo Oscuro 🌙';
        localStorage.setItem('theme', 'light');
    }

    function toggleDarkMode() {
        if (document.documentElement.classList.contains('dark')) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    }

    function setupEventListeners() {
        elements.loginForm.addEventListener('submit', handleLogin);
        elements.logoutButton.addEventListener('click', handleLogout);
        elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const viewId = e.currentTarget.getAttribute('href').substring(1);
                switchView(viewId);
            });
        });
        elements.addClientButton.addEventListener('click', () => toggleClientModal(true));
        elements.cancelClientModal.addEventListener('click', () => toggleClientModal(false));
        elements.clientForm.addEventListener('submit', handleClientFormSubmit);
        elements.clientsTableBody.addEventListener('click', e => {
            const target = e.target;
            if (target.classList.contains('edit-client-btn')) {
                const id = parseInt(target.dataset.id);
                const client = appState.clients.find(c => c.id === id);
                toggleClientModal(true, client);
            }
            if (target.classList.contains('delete-client-btn')) {
                const id = parseInt(target.dataset.id);
                handleDeleteClient(id);
            }
        });
        elements.startPauseButton.addEventListener('click', () => {
            if (appState.timer.isRunning) pauseTimer();
            else if (appState.timer.isPaused) resumeTimer();
            else startTimer();
        });
        elements.stopButton.addEventListener('click', stopTimer);
        elements.sendInvoiceButton.addEventListener('click', () => {
            toggleInvoiceModal(false);
            showToast('Factura enviada por correo (simulación).');
        });
        elements.darkModeToggle.addEventListener('click', toggleDarkMode);
        elements.sendWhatsappButton.addEventListener('click', () => { /* ... existing code ... */ });

        // Setup page listeners
        elements.saveScriptUrlButton.addEventListener('click', () => {
            const url = elements.scriptUrlInput.value.trim();
            if (url) {
                localStorage.setItem('SCRIPT_URL', url);
                elements.urlSavedMessage.classList.remove('hidden');
                setTimeout(() => location.reload(), 1500);
            } else {
                showToast("Por favor, introduce una URL válida.");
            }
        });

        elements.setupTablesButton.addEventListener('click', async () => {
            elements.setupSpinner.classList.remove('hidden');
            elements.setupTablesButton.disabled = true;
            elements.setupStatusMessage.textContent = 'Configurando tablas...';
            try {
                const message = await callAppsScript('setup');
                elements.setupStatusMessage.textContent = `Éxito: ${message}`;
                showToast("¡Tablas configuradas! Ahora puedes iniciar sesión con admin/admin.");
            } catch (error) {
                elements.setupStatusMessage.textContent = `Error: ${error.message}`;
            } finally {
                elements.setupSpinner.classList.add('hidden');
                elements.setupTablesButton.disabled = false;
            }
        });
    }

    function init() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }

        setupEventListeners();

        if (SCRIPT_URL) {
            elements.appContainer.classList.add('hidden');
            elements.loginModal.classList.remove('hidden');
            elements.setupTablesButton.disabled = false;
        } else {
            elements.appContainer.classList.add('hidden');
            elements.loginModal.classList.add('hidden');
            switchView('setup');
            // Ensure setup nav item is active and visible
            elements.setupNavItem.classList.add('active');
        }
    }

    init();
});