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
        currentUser: null,
        currentInvoiceData: null,
    };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const elements = {
        loadingIndicator: $('#loading-indicator'),
        appContainer: $('#app-container'),
        loginModal: $('#login-modal'),
        loginForm: $('#login-form'),
        loginEmail: $('#login-email'),
        loginPassword: $('#login-password'),
        loginError: $('#login-error'),
        setupButton: $('#setup-button'),
        logoutButton: $('#logout-button'),
        userDisplay: $('#user-display'),
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
    };

    function showLoading(show) {
        elements.loadingIndicator.classList.toggle('hidden', !show);
    }

    function showToast(message, isError = false) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.toggle('bg-red-500', isError);
        elements.toast.classList.toggle('bg-green-500', !isError);
        elements.toast.classList.remove('opacity-0', 'translate-y-4');
        setTimeout(() => {
            elements.toast.classList.add('opacity-0', 'translate-y-4');
        }, 3000);
    }

    function renderClients(clients) {
        appState.clients = clients;
        elements.clientsTableBody.innerHTML = '';
        elements.clientSelect.innerHTML = '<option value="">Ningún cliente seleccionado</option>';

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

    function loadClients() {
        showLoading(true);
        google.script.run
            .withSuccessHandler(clients => {
                renderClients(clients);
                showLoading(false);
            })
            .withFailureHandler(error => {
                showToast(`Error loading clients: ${error.message}`, true);
                showLoading(false);
            })
            .getClients();
    }

    function switchView(viewId) {
        appState.activeView = viewId;
        elements.pages.forEach(page => page.classList.add('hidden'));
        $(`#page-${viewId}`).classList.remove('hidden');
        elements.navItems.forEach(item => item.classList.remove('active'));
        $(`a[href="#${viewId}"]`).classList.add('active');
        if (viewId === 'clients') {
            loadClients();
        }
    }

    function toggleModal(modal, show = false) {
        if (show) {
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.querySelector('.modal-content').classList.remove('scale-95');
                modal.classList.remove('opacity-0');
            }, 10);
        } else {
            modal.querySelector('.modal-content').classList.add('scale-95');
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
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
                <div class="flex justify-between"><span>Cliente:</span><span>${client.name}</span></div>
                <div class="flex justify-between"><span>Duración:</span><span>${hours.toFixed(4)} horas</span></div>
                <div class="flex justify-between"><span>Tarifa:</span><span>$${rate.toFixed(2)} / hora</span></div>
                <div class="flex justify-between font-bold text-xl mt-4"><span>TOTAL:</span><span>$${total.toFixed(2)}</span></div>
            `;
        }
        toggleModal(elements.invoiceModal, show);
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

        toggleInvoiceModal(true, { client, hours, rate, total });

        appState.timer = { interval: null, startTime: 0, elapsedTime: 0, isRunning: false, isPaused: false };
        elements.timerDisplay.textContent = '00:00:00';
        elements.startPauseButton.textContent = 'Iniciar Sesión';
        elements.stopButton.classList.add('hidden');
        elements.clientSelect.disabled = false;
        elements.hourlyRate.disabled = false;
    }

    function handleLoginSuccess(result) {
        if (result.success) {
            appState.currentUser = result.user;
            elements.userDisplay.textContent = `Usuario: ${result.user.name}`;
            toggleModal(elements.loginModal, false);
            elements.appContainer.classList.remove('hidden');
            loadClients(); // Load clients after successful login
        } else {
            elements.loginError.textContent = result.message;
            elements.loginError.classList.remove('hidden');
        }
        showLoading(false);
    }

    function handleLoginFailure(error) {
        elements.loginError.textContent = `Error: ${error.message}`;
        elements.loginError.classList.remove('hidden');
        showLoading(false);
    }

    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showLoading(true);
        elements.loginError.classList.add('hidden');
        google.script.run
            .withSuccessHandler(handleLoginSuccess)
            .withFailureHandler(handleLoginFailure)
            .login(elements.loginEmail.value, elements.loginPassword.value);
    });

    elements.setupButton.addEventListener('click', () => {
        showLoading(true);
        google.script.run
            .withSuccessHandler(result => {
                showToast(result.message, !result.success);
                showLoading(false);
            })
            .withFailureHandler(error => {
                showToast(`Setup failed: ${error.message}`, true);
                showLoading(false);
            })
            .setup();
    });

    elements.logoutButton.addEventListener('click', () => {
        // Simple reload to go back to login state
        location.reload();
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

    elements.clientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showLoading(true);
        const clientData = {
            id: $('#client-id').value,
            name: $('#client-name').value,
            email: $('#client-email').value,
            phone: $('#client-phone').value,
            address: $('#client-address').value,
        };

        const isUpdate = !!clientData.id;
        const apiCall = isUpdate ? 'updateClient' : 'addClient';

        google.script.run
            .withSuccessHandler(() => {
                toggleClientModal(false);
                showToast(`Cliente ${isUpdate ? 'actualizado' : 'añadido'} con éxito.`);
                loadClients();
            })
            .withFailureHandler(error => {
                showToast(`Error: ${error.message}`, true);
                showLoading(false);
            })
            [apiCall](clientData);
    });

    elements.clientsTableBody.addEventListener('click', e => {
        const target = e.target;
        if(target.classList.contains('edit-client-btn')) {
            const id = parseInt(target.dataset.id);
            const client = appState.clients.find(c => c.id === id);
            toggleClientModal(true, client);
        }
        if(target.classList.contains('delete-client-btn')) {
            const id = parseInt(target.dataset.id);
            if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
                showLoading(true);
                google.script.run
                    .withSuccessHandler(() => {
                        showToast('Cliente eliminado.');
                        loadClients();
                    })
                    .withFailureHandler(error => {
                        showToast(`Error: ${error.message}`, true);
                        showLoading(false);
                    })
                    .deleteClient(id);
            }
        }
    });

    elements.startPauseButton.addEventListener('click', () => {
        if (appState.timer.isRunning) pauseTimer();
        else if (appState.timer.isPaused) resumeTimer();
        else startTimer();
    });

    elements.stopButton.addEventListener('click', stopTimer);

    elements.sendInvoiceButton.addEventListener('click', () => {
        if (!appState.currentInvoiceData) return;

        showLoading(true);
        const { client, hours, rate, total } = appState.currentInvoiceData;
        const invoiceData = {
            clientId: client.id,
            durationHours: hours,
            hourlyRate: rate,
            totalAmount: total
        };

        google.script.run
            .withSuccessHandler(() => {
                toggleInvoiceModal(false);
                showToast('Factura guardada con éxito.');
                showLoading(false);
            })
            .withFailureHandler(error => {
                showToast(`Error al guardar factura: ${error.message}`, true);
                showLoading(false);
            })
            .saveInvoice(invoiceData);
    });

    elements.darkModeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        elements.darkModeToggle.textContent = isDark ? 'Modo Claro ☀️' : 'Modo Oscuro 🌙';
    });

    function init() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            elements.darkModeToggle.textContent = 'Modo Claro ☀️';
        }
        switchView('dashboard');
    }

    init();
});
