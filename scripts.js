// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

document.addEventListener('DOMContentLoaded', () => {

    // --- State Management ---
    const appState = {
        clients: [], // Will be populated from the backend
        timer: {
            interval: null,
            startTime: 0,
            elapsedTime: 0,
            isRunning: false,
            isPaused: false,
        },
        activeView: 'dashboard',
        currentInvoiceData: null,
        currentUser: null, // To store logged-in user info
    };

    // --- DOM Element Selection ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const elements = {
        appContainer: $('#app-container'),
        loginModal: $('#login-modal'),
        loginForm: $('#login-form'), // Updated to a form
        loginButton: $('#login-button'),
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
        usernameDisplay: $('#user-info'), // For displaying logged-in user
        loginSpinner: $('#login-spinner'),
    };

    // --- Utility Functions ---

    function showToast(message, isError = false) {
        elements.toastMessage.textContent = message;
        elements.toast.className = `fixed bottom-10 right-10 text-white py-3 px-6 rounded-lg shadow-xl text-lg transition-all duration-500 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        elements.toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            elements.toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    /**
     * Helper to run a Google Apps Script function and handle success/failure.
     * @param {string} functionName - The name of the backend function to call.
     * @param {Array} args - Arguments to pass to the backend function.
     * @returns {Promise<any>} - A promise that resolves with the result or rejects with an error.
     */
    function serverCall(functionName, args = []) {
        return new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                [functionName](...args);
        });
    }

    // --- UI Rendering & View Management ---

    function renderClients() {
        elements.clientsTableBody.innerHTML = '';
        elements.clientSelect.innerHTML = '<option value="">Ningún cliente seleccionado</option>';

        const clients = appState.clients || [];

        if (clients.length === 0) {
            elements.noClientsMessage.classList.remove('hidden');
            elements.clientsTableBody.classList.add('hidden');
        } else {
            elements.noClientsMessage.classList.add('hidden');
            elements.clientsTableBody.classList.remove('hidden');

            clients.forEach(client => {
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
        const activeLink = $(`a[href="#${viewId}"]`);
        if (activeLink) activeLink.classList.add('active');
    }

    // --- Modal Toggles ---

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

    // --- Authentication ---

    async function handleLogin(event) {
        event.preventDefault();
        const username = $('#username').value;
        const password = $('#password').value;
        if (!username || !password) {
            showToast('Por favor, ingresa usuario y contraseña.', true);
            return;
        }

        elements.loginSpinner.classList.remove('hidden');
        elements.loginButton.disabled = true;

        try {
            const result = await serverCall('loginUser', [username, password]);
            if (result.success) {
                appState.currentUser = { username: username, userId: result.userId };
                sessionStorage.setItem('timebillUser', JSON.stringify(appState.currentUser)); // Use sessionStorage
                initializeAppUI();
            } else {
                showToast(result.message, true);
            }
        } catch (error) {
            showToast('Error de conexión. Inténtalo de nuevo.', true);
            console.error('Login error:', error);
        } finally {
            elements.loginSpinner.classList.add('hidden');
            elements.loginButton.disabled = false;
        }
    }

    function handleLogout() {
        appState.currentUser = null;
        sessionStorage.removeItem('timebillUser');
        elements.appContainer.classList.add('hidden');
        elements.loginModal.classList.remove('hidden');
        $('#login-form').reset();
        setTimeout(() => {
            elements.loginModal.querySelector('.modal-content').classList.remove('scale-95', 'opacity-0');
        }, 10);
    }

    // --- Client Data Management (CRUD) ---

    async function loadUserClients() {
        try {
            const clients = await serverCall('getClients', [appState.currentUser.userId]);
            appState.clients = clients;
            renderClients();
        } catch (error) {
            showToast('No se pudieron cargar los clientes.', true);
            console.error('Error fetching clients:', error);
        }
    }

    async function handleClientFormSubmit(e) {
        e.preventDefault();
        const id = parseInt(elements.clientIdInput.value);
        const clientData = {
            id: id || null,
            name: $('#client-name').value,
            email: $('#client-email').value,
            phone: $('#client-phone').value,
            address: $('#client-address').value,
        };

        try {
            if (id) {
                await serverCall('updateClient', [clientData, appState.currentUser.userId]);
                showToast('Cliente actualizado con éxito.');
            } else {
                const newClient = await serverCall('addClient', [clientData, appState.currentUser.userId]);
                appState.clients.push(newClient); // Add the returned new client to state
                showToast('Cliente añadido con éxito.');
            }
            await loadUserClients(); // Reload all clients to ensure sync
            toggleClientModal(false);
        } catch (error) {
            showToast('Error al guardar el cliente.', true);
            console.error('Client save error:', error);
        }
    }

    async function handleClientDelete(clientId) {
        if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            try {
                await serverCall('deleteClient', [clientId, appState.currentUser.userId]);
                showToast('Cliente eliminado.');
                appState.clients = appState.clients.filter(c => c.id !== clientId);
                renderClients();
            } catch (error) {
                showToast('Error al eliminar el cliente.', true);
                console.error('Client delete error:', error);
            }
        }
    }

    // --- Timer Logic ---

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

        if (!client) {
            showToast('Error: Cliente no encontrado.', true);
            return;
        }

        const invoiceData = { client, hours, rate, total };
        toggleInvoiceModal(true, invoiceData);

        // Reset timer state
        appState.timer = { interval: null, startTime: 0, elapsedTime: 0, isRunning: false, isPaused: false };
        elements.timerDisplay.textContent = '00:00:00';
        elements.startPauseButton.textContent = 'Iniciar Sesión';
        elements.stopButton.classList.add('hidden');
        elements.clientSelect.disabled = false;
        elements.hourlyRate.disabled = false;
        elements.hourlyRate.value = '';
        elements.clientSelect.value = '';
    }

    // --- Invoice & Email ---

    async function handleSendInvoice() {
        try {
            await serverCall('addInvoice', [appState.currentInvoiceData, appState.currentUser.userId]);
            showToast('Factura enviada y registrada.');
            toggleInvoiceModal(false);
        } catch(error) {
            showToast('Error al registrar la factura.', true);
            console.error('Invoice recording error:', error);
        }
    }

    async function generateEmailDraft() {
        elements.generateEmailButton.disabled = true;
        elements.generateEmailSpinner.classList.remove('hidden');
        elements.emailDraftDisplay.textContent = 'Generando borrador...';
        elements.emailDraftContainer.classList.remove('hidden');

        try {
            // Securely call the backend function
            const draft = await serverCall('generateEmailDraft', [appState.currentInvoiceData]);
            elements.emailDraftDisplay.textContent = draft;
        } catch (error) {
            console.error('Error calling backend for email draft:', error);
            // Display a user-friendly error message, including the error from the backend
            elements.emailDraftDisplay.textContent = `Error: ${error.message || 'No se pudo generar el borrador.'}`;
            showToast(error.message || 'Error al generar el borrador.', true);
        } finally {
            elements.generateEmailButton.disabled = false;
            elements.generateEmailSpinner.classList.add('hidden');
        }
    }

    // --- Dark Mode ---
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


    // --- Event Listeners ---
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
                handleClientDelete(id);
            }
        });

        elements.startPauseButton.addEventListener('click', () => {
            if (appState.timer.isRunning) pauseTimer();
            else if (appState.timer.isPaused) resumeTimer();
            else startTimer();
        });

        elements.stopButton.addEventListener('click', stopTimer);
        elements.sendInvoiceButton.addEventListener('click', handleSendInvoice);
        elements.generateEmailButton.addEventListener('click', generateEmailDraft);

        elements.copyEmailDraftButton.addEventListener('click', () => {
            navigator.clipboard.writeText(elements.emailDraftDisplay.textContent)
                .then(() => showToast('Borrador copiado al portapapeles.'))
                .catch(() => showToast('No se pudo copiar el texto.', true));
        });

        elements.darkModeToggle.addEventListener('click', toggleDarkMode);

        elements.sendWhatsappButton.addEventListener('click', () => {
            if (!appState.currentInvoiceData) return;
            const { client, hours, total } = appState.currentInvoiceData;
            const mensaje = `Hola ${client.name},\n\nTe envío la cuenta de cobro por la sesión realizada.\n\nDuración: ${hours.toFixed(2)} horas\nTOTAL: $${total.toFixed(2)}\n\n¡Gracias!`;
            let numero = client.phone ? client.phone.replace(/\D/g, '') : '';
            if (numero && !numero.startsWith('57')) numero = '57' + numero;
            const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
        });
    }

    // --- Application Initialization ---

    async function initializeAppUI() {
        elements.loginModal.classList.add('hidden');
        elements.appContainer.classList.remove('hidden');

        if(elements.usernameDisplay) {
            elements.usernameDisplay.textContent = `Usuario: ${appState.currentUser.username}`;
        }

        switchView('dashboard');
        await loadUserClients();
    }

    function init() {
        // Theme setup
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }

        // Event listeners
        setupEventListeners();

        // Check for existing session
        const storedUser = sessionStorage.getItem('timebillUser');
        if (storedUser) {
            appState.currentUser = JSON.parse(storedUser);
            initializeAppUI();
        } else {
            // Show login modal if no session
            elements.loginModal.classList.remove('hidden');
        }
    }

    init();
});