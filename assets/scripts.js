document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================================
    // CONFIGURACIÓN INICIAL Y ESTADO DE LA APLICACIÓN
    // ===================================================================================================

    // URL de la aplicación web de Google Apps Script.
    // IMPORTANTE: Reemplaza esta URL con la URL de tu script desplegado.
    const SCRIPT_URL = '';

    const appState = {
        clients: [], // Ahora se cargará desde el backend.
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
        loginButton: $('#login-button'),
        logoutButton: $('#logout-button'),
        navItems: $$('.nav-item'),
        loadingOverlay: $('#loading-overlay'),
        pages: $$('.page'),
        timerDisplay: $('#timer-display'),
        clientSelect: $('#client-select'),
        hourlyRate: $('#hourly-rate'),
        startPauseButton: $('#start-pause-button'),
        stopButton: $('#stop-button'),
        clientsTableBody: $('#clients-table-body'),
        addClientButton: $('#add-client-button'),
        setupButton: $('#setup-button'),
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
    };

    // ===================================================================================================
    // FUNCIONES DE UTILIDAD (Notificaciones, Carga, Backend)
    // ===================================================================================================

    function toggleLoading(isLoading) {
        if (isLoading) {
            elements.loadingOverlay.classList.remove('hidden');
        } else {
            elements.loadingOverlay.classList.add('hidden');
        }
    }

    async function callBackend(action, payload = {}) {
        toggleLoading(true);
        try {
            if (!SCRIPT_URL) {
                showToast("Error: La URL del script no está configurada en scripts.js.");
                console.error("SCRIPT_URL no está configurada.");
                // Return a rejected promise to be caught by the caller
                return Promise.reject("SCRIPT_URL not configured");
            }

            // Redirecting fetch through a CORS proxy is a common workaround for local development,
            // but the proper solution is to handle CORS in the deployed script.
            // Google Apps Script deployed as a web app should handle this correctly if deployed to allow anonymous access.
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    // While it seems counterintuitive, sending as text/plain can avoid CORS preflight issues with Apps Script
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                // The body is a stringified JSON object
                body: JSON.stringify({ action, payload })
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(result.message || 'An unknown backend error occurred.');
            }

            return result; // The backend response contains { status, payload }

        } catch (error) {
            console.error('Backend call failed:', error);
            showToast(`Error: ${error.message}`);
            throw error; // Re-throw the error to be handled by the calling function
        } finally {
            toggleLoading(false);
        }
    }


    function showToast(message) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            elements.toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    function renderClients() {
        elements.clientsTableBody.innerHTML = '';
        elements.clientSelect.innerHTML = '<option value="">Ningún cliente seleccionado</option>';

        if (appState.clients.length === 0) {
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
        $(`a[href="#${viewId}"]`).classList.add('active');
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
            appState.currentInvoiceData = data; // Store current invoice data
            elements.invoiceContent.innerHTML = `
                <div class="flex justify-between"><span class="font-semibold">Cliente:</span><span class="dark:text-zinc-200">${client.name}</span></div>
                <div class="flex justify-between"><span class="font-semibold">Correo:</span><span class="dark:text-zinc-200">${client.email}</span></div>
                <div class="flex justify-between"><span class="font-semibold">Duración:</span><span class="dark:text-zinc-200">${hours.toFixed(4)} horas</span></div>
                <div class="flex justify-between"><span class="font-semibold">Tarifa:</span><span class="dark:text-zinc-200">$${rate.toFixed(2)} / hora</span></div>
                <div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600"><span class="font-semibold">TOTAL:</span><span class="dark:text-zinc-200">$${total.toFixed(2)}</span></div>
            `;
            // Reset email draft display
            elements.emailDraftContainer.classList.add('hidden');
            elements.emailDraftDisplay.textContent = '';
            elements.invoiceModal.classList.remove('hidden');
            setTimeout(() => {
                elements.invoiceModal.querySelector('.modal-content').classList.remove('scale-95');
            }, 10);
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

        // Reset state
        appState.timer = { interval: null, startTime: 0, elapsedTime: 0, isRunning: false, isPaused: false };
        elements.timerDisplay.textContent = '00:00:00';
        elements.startPauseButton.textContent = 'Iniciar Sesión';
        elements.stopButton.classList.add('hidden');
        elements.clientSelect.disabled = false;
        elements.hourlyRate.disabled = false;
        elements.hourlyRate.value = '';
        elements.clientSelect.value = '';
    }

   async function generateEmailDraft() {
        if (!appState.currentInvoiceData) return;

        elements.generateEmailButton.disabled = true;
        elements.generateEmailSpinner.classList.remove('hidden');
        elements.emailDraftDisplay.textContent = 'Generando borrador...';
        elements.emailDraftContainer.classList.remove('hidden');

        try {
            const result = await callBackend('generateEmailDraft', appState.currentInvoiceData);
            elements.emailDraftDisplay.textContent = result.payload.draft;
        } catch (error) {
            elements.emailDraftDisplay.textContent = 'Error al generar el borrador. Revisa la configuración del API Key de Gemini en el script.';
        } finally {
            elements.generateEmailButton.disabled = false;
            elements.generateEmailSpinner.classList.add('hidden');
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

    elements.loginButton.addEventListener('click', () => {
        elements.loginModal.querySelector('.modal-content').classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            elements.loginModal.classList.add('hidden');
            elements.appContainer.classList.remove('hidden');
        }, 300);
    });

    elements.logoutButton.addEventListener('click', () => {
        elements.appContainer.classList.add('hidden');
        elements.loginModal.classList.remove('hidden');
        elements.loginModal.querySelector('.modal-content').classList.remove('opacity-0');
        setTimeout(() => elements.loginModal.querySelector('.modal-content').classList.remove('scale-95'), 10);
    });

    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.getAttribute('href').substring(1);
            switchView(viewId);
        });
    });

    elements.addClientButton.addEventListener('click', () => toggleClientModal(true));
    elements.cancelClientModal.addEventListener('click', () => toggleClientModal(false));

    elements.clientForm.addEventListener('submit', async (e) => {
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
                const result = await callBackend('updateClient', clientData);
                const index = appState.clients.findIndex(c => c.id === id);
                appState.clients[index] = result.payload;
                showToast('Cliente actualizado con éxito.');
            } else {
                const result = await callBackend('addClient', clientData);
                appState.clients.push(result.payload);
                showToast('Cliente añadido con éxito.');
            }
            renderClients();
            toggleClientModal(false);
        } catch (error) {
            // Error is already logged by callBackend
        }
    });

    elements.clientsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('edit-client-btn')) {
            const id = parseInt(target.dataset.id);
            const client = appState.clients.find(c => c.id === id);
            toggleClientModal(true, client);
        }
        if (target.classList.contains('delete-client-btn')) {
            const id = parseInt(target.dataset.id);
            if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
                try {
                    await callBackend('deleteClient', { id });
                    appState.clients = appState.clients.filter(c => c.id !== id);
                    renderClients();
                    showToast('Cliente eliminado.');
                } catch (error) {
                    // Error is already logged by callBackend
                }
            }
        }
    });

    elements.startPauseButton.addEventListener('click', () => {
        if (appState.timer.isRunning) pauseTimer();
        else if (appState.timer.isPaused) resumeTimer();
        else startTimer();
    });

    elements.stopButton.addEventListener('click', stopTimer);

    elements.sendInvoiceButton.addEventListener('click', async () => {
        try {
            await callBackend('saveInvoice', appState.currentInvoiceData);
            toggleInvoiceModal(false);
            showToast('Factura guardada y enviada (simulación).');
        } catch (error) {
            showToast('Error al guardar la factura.');
        }
    });

    elements.generateEmailButton.addEventListener('click', generateEmailDraft);

    elements.copyEmailDraftButton.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.emailDraftDisplay.textContent).then(() => {
            showToast('Borrador de correo copiado al portapapeles.');
        }).catch(err => {
            console.error('Error al copiar texto: ', err);
            showToast('No se pudo copiar el texto.');
        });
    });

    elements.darkModeToggle.addEventListener('click', toggleDarkMode);

    elements.setupButton.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres configurar las tablas? Esto creará las hojas "Clients" y "Invoices" si no existen.')) {
            try {
                const result = await callBackend('setup');
                showToast(result.message);
            } catch (error) {
                // Error is handled in callBackend
            }
        }
    });

    elements.sendWhatsappButton.addEventListener('click', () => {
        if (!appState.currentInvoiceData) {
            showToast('Primero debes finalizar una sesión para generar la información de la factura.');
            return;
        }
        const { client, hours, rate, total } = appState.currentInvoiceData;
        const mensaje = `Hola ${client.name},\n\nTe envío la cuenta de cobro por la sesión realizada.\n\nDuración: ${hours.toFixed(2)} horas\nTarifa: $${rate.toFixed(2)} / hora\nTOTAL: $${total.toFixed(2)}\n\n¡Gracias por tu confianza!`;
        let numero = client.phone ? client.phone.replace(/\D/g, '') : '';
        if (numero && !numero.startsWith('57')) {
            numero = '57' + numero;
        }
        const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    });

    async function init() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }

        switchView('dashboard');

        try {
            const result = await callBackend('getClients');
            appState.clients = result.payload;
            renderClients();
        } catch (error) {
            if (error.message.includes("You do not have permission to call SpreadsheetApp.openByUrl")) {
                 showToast("Error de permisos: Revisa la configuración de tu Google Sheet.");
            }
        }
    }

    init();
});
