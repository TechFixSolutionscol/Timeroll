document.addEventListener('DOMContentLoaded', () => {

    // Global state object
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

    // DOM element cache
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const elements = {
        appContainer: $('#app-container'),
        loginModal: $('#login-modal'),
        loginForm: $('#login-form'),
        loginFeedback: $('#login-feedback'),
        setupButton: $('#setup-button'),
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
        darkModeToggle: $('#dark-mode-toggle'),
        sendWhatsappButton: $('#send-whatsapp-button'),
    };

    // --- UTILITY FUNCTIONS ---

    function showToast(message) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            elements.toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    // --- UI RENDERING & VIEW MANAGEMENT ---

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

    function toggleModal(modalElement, show = false) {
        const modalContent = modalElement.querySelector('.modal-content');
        if (show) {
            modalElement.classList.remove('hidden');
            setTimeout(() => {
                modalContent.classList.remove('scale-95');
                modalElement.classList.remove('opacity-0');
            }, 10);
        } else {
            modalContent.classList.add('scale-95');
            modalElement.classList.add('opacity-0');
            setTimeout(() => modalElement.classList.add('hidden'), 300);
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
        }
        toggleModal(elements.clientModal, show);
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
                <div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t"><span class="font-semibold">TOTAL:</span><span class="dark:text-zinc-200">$${total.toFixed(2)}</span></div>
            `;
        }
        toggleModal(elements.invoiceModal, show);
    }

    // --- TIMER LOGIC ---

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
            showToast('Por favor, selecciona un cliente.');
            return;
        }
        if (!elements.hourlyRate.value || parseFloat(elements.hourlyRate.value) <= 0) {
            showToast('Por favor, introduce un valor por hora válido.');
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

    // --- BACKEND COMMUNICATION ---

    function fetchClients() {
        google.script.run
            .withSuccessHandler(clients => {
                appState.clients = clients;
                renderClients();
            })
            .withFailureHandler(err => showToast(`Error fetching clients: ${err.message}`))
            .getClients();
    }

    // --- EVENT HANDLERS ---

    function handleLoginFormSubmit(e) {
        e.preventDefault();
        const username = $('#username').value;
        const password = $('#password').value;
        elements.loginFeedback.textContent = '';

        google.script.run
            .withSuccessHandler(response => {
                if (response.success) {
                    toggleModal(elements.loginModal, false);
                    setTimeout(() => {
                         elements.appContainer.classList.remove('hidden');
                         fetchClients(); // Fetch initial data
                    }, 300);
                } else {
                    elements.loginFeedback.textContent = response.message;
                }
            })
            .withFailureHandler(err => {
                elements.loginFeedback.textContent = `Login error: ${err.message}`;
            })
            .checkLogin(username, password);
    }

    function handleSetupButtonClick() {
        this.disabled = true;
        this.textContent = 'Configurando...';
        google.script.run
            .withSuccessHandler(message => {
                showToast(message);
                this.textContent = 'Configuración Completa';
            })
            .withFailureHandler(err => {
                showToast(`Setup failed: ${err.message}`);
                this.disabled = false;
                this.textContent = 'Configurar Base de Datos (Primera vez)';
            })
            .setup();
    }

    function handleClientFormSubmit(e) {
        e.preventDefault();
        const id = parseInt(elements.clientIdInput.value);
        const clientData = {
            id: id || null,
            name: $('#client-name').value,
            email: $('#client-email').value,
            phone: $('#client-phone').value,
            address: $('#client-address').value,
        };

        if (id) {
            // Handle update
            google.script.run
                .withSuccessHandler(() => {
                    const index = appState.clients.findIndex(c => c.id === id);
                    if (index !== -1) {
                        appState.clients[index] = clientData; // Use the form data to update the state
                    }
                    renderClients();
                    toggleClientModal(false);
                    showToast('Cliente actualizado con éxito.');
                })
                .withFailureHandler(err => showToast(`Error actualizando cliente: ${err.message}`))
                .updateClient(clientData);
        } else {
            // Handle add
            google.script.run
                .withSuccessHandler(newClient => {
                    appState.clients.push(newClient); // The backend returns the new client with ID
                    renderClients();
                    toggleClientModal(false);
                    showToast('Cliente añadido con éxito.');
                })
                .withFailureHandler(err => showToast(`Error añadiendo cliente: ${err.message}`))
                .addClient(clientData);
        }
    }

    function handleClientsTableClick(e) {
        const target = e.target;
        if (target.classList.contains('edit-client-btn')) {
            const id = parseInt(target.dataset.id);
            const client = appState.clients.find(c => c.id === id);
            toggleClientModal(true, client);
        }
        if (target.classList.contains('delete-client-btn')) {
            const id = parseInt(target.dataset.id);
            if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
                google.script.run
                    .withSuccessHandler(() => {
                        appState.clients = appState.clients.filter(c => c.id !== id);
                        renderClients();
                        showToast('Cliente eliminado.');
                    })
                    .withFailureHandler(err => showToast(`Error eliminando: ${err.message}`))
                    .deleteClient(id);
            }
        }
    }

    function handleSendInvoiceClick() {
        google.script.run
            .withSuccessHandler(response => {
                 showToast('Factura guardada y enviada (simulación).');
            })
            .withFailureHandler(err => showToast(`Error al guardar factura: ${err.message}`))
            .saveInvoice(appState.currentInvoiceData);
        toggleInvoiceModal(false);
    }

    // --- DARK MODE ---
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

    // --- INITIALIZATION ---
    function init() {
        // Theme initialization
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }

        // Show login modal on load
        toggleModal(elements.loginModal, true);

        // Event Listeners
        elements.loginForm.addEventListener('submit', handleLoginFormSubmit);
        elements.setupButton.addEventListener('click', handleSetupButtonClick);
        elements.logoutButton.addEventListener('click', () => location.reload()); // Simple reload for logout

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
        elements.clientsTableBody.addEventListener('click', handleClientsTableClick);

        elements.startPauseButton.addEventListener('click', () => {
            if (appState.timer.isRunning) pauseTimer();
            else if (appState.timer.isPaused) resumeTimer();
            else startTimer();
        });

        elements.stopButton.addEventListener('click', stopTimer);
        elements.sendInvoiceButton.addEventListener('click', handleSendInvoiceClick);
        elements.darkModeToggle.addEventListener('click', toggleDarkMode);
        elements.sendWhatsappButton.addEventListener('click', () => {
            const { client, hours, rate, total } = appState.currentInvoiceData;
            const mensaje = `Hola ${client.name},\n\nTe envío la cuenta de cobro por la sesión realizada.\n\nDuración: ${hours.toFixed(2)} horas\nTarifa: $${rate.toFixed(2)} / hora\nTOTAL: $${total.toFixed(2)}\n\n¡Gracias!`;
            let numero = client.phone ? client.phone.replace(/\D/g, '') : '';
            if (numero && !numero.startsWith('57')) {
                numero = '57' + numero;
            }
            const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
        });

        // Initial setup
        switchView('dashboard');
    }

    init();
});
