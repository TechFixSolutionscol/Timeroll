document.addEventListener('DOMContentLoaded', () => {

    // Configuración de Google Sheets
    const GOOGLE_SHEETS_CONFIG = {
        appScriptUrl: 'https://script.google.com/macros/s/AKfycbxltspHg_waM1KXGzIlsfvfdbedTIem8eqrIlFb4eBoTovVW2Y2aggrE2R2L29OGQyE/exec'
    };

    const appState = {
        clients: [],
        users: [],
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
        registerForm: $('#register-form'),
        loginEmail: $('#login-email'),
        loginPassword: $('#login-password'),
        loginSubmitButton: $('#login-submit-button'),
        loginError: $('#login-error'),
        registerName: $('#register-name'),
        registerEmail: $('#register-email'),
        registerPassword: $('#register-password'),
        registerSubmitButton: $('#register-submit-button'),
        registerError: $('#register-error'),
        toggleRegisterBtn: $('#toggle-register-btn'),
        toggleLoginBtn: $('#toggle-login-btn'),
        quickInitButton: $('#quick-init-button'),
        darkModeToggle: $('#dark-mode-toggle'),
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
        noClientsMessage: $('#no-clients-message'),
        clientModal: $('#client-modal'),
        clientForm: $('#client-form'),
        cancelClientModal: $('#cancel-client-modal'),
        clientIdInput: $('#client-id'),
        clientModalTitle: $('#client-modal-title'),
        invoiceModal: $('#invoice-modal'),
        invoiceContent: $('#invoice-content'),
        sendWhatsappButton: $('#send-whatsapp-button'),
        initDatabaseButton: $('#init-database-button'),
        initSpinner: $('#init-spinner'),
        initStatus: $('#init-status'),
        initMessage: $('#init-message'),
        usersTableBody: $('#users-table-body'),
        addUserButton: $('#add-user-button'),
        userModal: $('#user-modal'),
        userForm: $('#user-form'),
        cancelUserModal: $('#cancel-user-modal'),
        closeUserModalBtn: $('#close-user-modal-btn'),
        navUsers: $('#nav-users'),
        noUsersMessage: $('#no-users-message'),
        toast: $('#toast-notification'),
        toastMessage: $('#toast-message'),
        sidebarUserName: $('#sidebar-user-name'),
        scriptUrlInput: $('#script-url-input')
    };

    function showToast(message, type = 'success') {
        elements.toastMessage.textContent = message;
        elements.toast.className = `fixed bottom-10 right-10 text-white py-3 px-6 rounded-lg shadow-xl text-lg transition-all duration-500 z-[100] ${type === 'error' ? 'bg-red-600' : 'bg-indigo-600'}`;
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

    function renderUsers() {
        elements.usersTableBody.innerHTML = '';
        const users = appState.users || [];

        if (users.length === 0) {
            elements.noUsersMessage.classList.remove('hidden');
            elements.usersTableBody.classList.add('hidden');
        } else {
            elements.noUsersMessage.classList.add('hidden');
            elements.usersTableBody.classList.remove('hidden');

            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-gray-50 dark:hover:bg-zinc-600';
                tr.innerHTML = `
                    <td class="p-4 font-medium dark:text-zinc-100">${user.nombre}</td>
                    <td class="p-4 text-gray-600 dark:text-zinc-300">${user.email}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded text-xs font-semibold ${user.role === 'Admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}">${user.role}</span></td>
                    <td class="p-4 text-gray-600 dark:text-zinc-300">${user.estado || 'Activo'}</td>
                    <td class="p-4 text-right">
                        <button class="delete-user-btn text-red-600 hover:text-red-800" data-id="${user.id}">Eliminar</button>
                    </td>
                `;
                elements.usersTableBody.appendChild(tr);
            });
        }
    }

    function toggleUserModal(show = false) {
        if (show) {
            elements.userForm.reset();
            $('#user-modal-title').textContent = 'Nuevo Usuario';
            elements.userModal.classList.remove('hidden');
            setTimeout(() => {
                elements.userModal.querySelector('.modal-content').classList.remove('scale-95');
                elements.userModal.classList.remove('opacity-0');
            }, 10);
        } else {
            elements.userModal.querySelector('.modal-content').classList.add('scale-95');
            elements.userModal.classList.add('opacity-0');
            setTimeout(() => elements.userModal.classList.add('hidden'), 300);
        }
    }

    async function loadUsersFromGoogleSheets() {
        try {
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'get_users' })
            });
            const result = await response.json();
            if (result.status === 'success' && result.data.users) {
                appState.users = result.data.users;
                renderUsers();
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
        }
    }

    async function createUserViaSheets(userData) {
        try {
            showToast('⏳ Creando usuario...');
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'create_user',
                    nombre: userData.nombre,
                    email: userData.email,
                    password: userData.password,
                    role: userData.role
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast('✅ Usuario creado exitosamente');
                loadUsersFromGoogleSheets();
                return true;
            } else {
                showToast(`❌ Error: ${result.message}`, 'error');
                return false;
            }
        } catch (error) {
            showToast('❌ Error de conexión', 'error');
            return false;
        }
    }

    async function deleteUserViaSheets(userId) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        try {
            showToast('⏳ Eliminando usuario...');
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'delete_user', id: userId })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast('✅ Usuario eliminado');
                loadUsersFromGoogleSheets();
            } else {
                showToast(`❌ Error: ${result.message}`, 'error');
            }
        } catch (e) {
            showToast('❌ Error de conexión', 'error');
        }
    }

    function switchView(viewId) {
        appState.activeView = viewId;
        elements.pages.forEach(page => page.classList.add('hidden'));
        $(`#page-${viewId}`).classList.remove('hidden');
        elements.navItems.forEach(item => {
            const itemHref = item.getAttribute('href').substring(1);
            if (itemHref === viewId) {
                item.classList.add('bg-gray-300', 'dark:bg-zinc-700');
            } else {
                item.classList.remove('bg-gray-300', 'dark:bg-zinc-700');
            }
        });
    }

    function toggleClientModal(show = false, client = null) {
        if (show) {
            elements.clientForm.reset();
            if (client) {
                elements.clientModalTitle.textContent = 'Editar Cliente';
                elements.clientIdInput.value = client.id;
                $('#client-name').value = client.name;
                $('#client-email').value = client.email;
                $('#client-phone').value = client.phone;
                $('#client-address').value = client.address;
            } else {
                elements.clientModalTitle.textContent = 'Añadir Nuevo Cliente';
                elements.clientIdInput.value = '';
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
                <div class="flex justify-between"><span class="font-semibold">Duración:</span><span class="dark:text-zinc-200">${hours.toFixed(2)} horas</span></div>
                <div class="flex justify-between"><span class="font-semibold">Tarifa:</span><span class="dark:text-zinc-200">$${rate.toFixed(2)} / hora</span></div>
                <div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600"><span class="font-semibold">TOTAL:</span><span class="dark:text-zinc-200">$${total.toFixed(2)}</span></div>
            `;
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
            showToast('Por favor, selecciona un cliente.', 'error');
            return;
        }
        if (!elements.hourlyRate.value || parseFloat(elements.hourlyRate.value) <= 0) {
            showToast('Por favor, introduce un valor por hora válido.', 'error');
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
            showToast('⚠️ Error: No se pudo identificar el cliente.', 'error');
            return;
        }
        const sessionData = {
            client, hours, rate, total,
            startTime: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        };
        saveSessionToGoogleSheets(sessionData);
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

    async function saveSessionToGoogleSheets(sessionData) {
        try {
            const payload = {
                action: 'save_session',
                cliente: sessionData.client.name,
                email: sessionData.client.email,
                duracion: sessionData.hours,
                valor_hora: sessionData.rate,
                hora_inicio: sessionData.startTime
            };
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast(`✅ Sesión guardada: $${result.data.total}`);
            } else {
                showToast(`⚠️ Error al guardar: ${result.message}`, 'error');
            }
        } catch (error) {
            showToast('⚠️ Error de conexión al guardar sesión', 'error');
        }
    }

    async function checkDatabaseInitialization() {
        try {
            const response = await fetch(`${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=check_initialization`);
            const result = await response.json();
            return result.status === 'success' ? result.data : null;
        } catch (error) {
            return null;
        }
    }

    async function initializeDatabase() {
        try {
            if (elements.initDatabaseButton) elements.initDatabaseButton.disabled = true;
            if (elements.initSpinner) elements.initSpinner.classList.remove('hidden');
            if (elements.initStatus) elements.initStatus.classList.remove('hidden');
            if (elements.initMessage) elements.initMessage.textContent = '⏳ Inicializando base de datos...';

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'initialize' })
            });
            const result = await response.json();
            if (result.status === 'success') {
                if (elements.initMessage) elements.initMessage.textContent = '✅ Base de datos lista';
                showToast('✅ Base de datos inicializada correctamente');
                loadClientsFromGoogleSheets();
            } else {
                if (elements.initMessage) elements.initMessage.textContent = `❌ Error: ${result.message}`;
                showToast(`❌ Error: ${result.message}`, 'error');
            }
        } catch (error) {
            if (elements.initMessage) elements.initMessage.textContent = '❌ Error de conexión';
            showToast('❌ Error de conexión', 'error');
        } finally {
            if (elements.initDatabaseButton) elements.initDatabaseButton.disabled = false;
            if (elements.initSpinner) elements.initSpinner.classList.add('hidden');
        }
    }

    async function loadClientsFromGoogleSheets() {
        try {
            const response = await fetch(`${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_clients`);
            const result = await response.json();
            if (result.status === 'success' && result.data.clients) {
                appState.clients = result.data.clients.map(client => ({
                    id: client.ID,
                    name: client.Nombre,
                    email: client.Email,
                    phone: client.Teléfono || client.Telefono || '',
                    address: client.Dirección || client.Address || ''
                }));
                renderClients();
            }
        } catch (error) {
            console.error('Error al cargar clientes:', error);
        }
    }

    async function addClientToGoogleSheets(clientData) {
        try {
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'add_client', ...clientData })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast(`✅ Cliente "${result.data.name}" agregado`);
                return result.data;
            }
            return null;
        } catch (error) {
            showToast('⚠️ Error de conexión', 'error');
            return null;
        }
    }

    async function updateClientInGoogleSheets(clientData) {
        try {
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'update_client', ...clientData })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast('✅ Cliente actualizado');
                return true;
            }
            return false;
        } catch (error) {
            showToast('⚠️ Error de conexión', 'error');
            return false;
        }
    }

    async function deleteClientFromGoogleSheets(clientId) {
        try {
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'delete_client', id: clientId })
            });
            const result = await response.json();
            return result.status === 'success';
        } catch (error) {
            return false;
        }
    }

    function checkUserRole(role) {
        if (role === 'Admin') {
            elements.navUsers.classList.remove('hidden');
        } else {
            elements.navUsers.classList.add('hidden');
        }
    }

    async function loginUserViaSheets(email, password) {
        elements.loginError.classList.add('hidden');
        if (!email || !password) {
            elements.loginError.textContent = '⚠️ Por favor completa todos los campos.';
            elements.loginError.classList.remove('hidden');
            return;
        }
        try {
            elements.loginSubmitButton.disabled = true;
            showToast('🔍 Validando...');
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'login', email, password })
            });
            const result = await response.json();
            if (result.status === 'success') {
                sessionStorage.setItem('userEmail', result.data.email);
                sessionStorage.setItem('userName', result.data.nombre);
                sessionStorage.setItem('userRole', result.data.role);
                localStorage.setItem('lastUser', email);

                elements.sidebarUserName.textContent = `Usuario: ${result.data.nombre} (${result.data.role})`;
                checkUserRole(result.data.role);
                if (result.data.role === 'Admin') loadUsersFromGoogleSheets();

                elements.loginModal.querySelector('.modal-content').classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    elements.loginModal.classList.add('hidden');
                    elements.appContainer.classList.remove('hidden');
                    elements.appContainer.classList.add('md:flex');
                    showToast(`✅ ¡Bienvenido, ${result.data.nombre}!`);
                    loadClientsFromGoogleSheets();
                }, 300);
            } else {
                elements.loginError.textContent = `❌ ${result.message}`;
                elements.loginError.classList.remove('hidden');
            }
        } catch (error) {
            elements.loginError.textContent = '❌ Error de conexión';
            elements.loginError.classList.remove('hidden');
        } finally {
            elements.loginSubmitButton.disabled = false;
        }
    }

    async function registerUserViaSheets(name, email, password) {
        elements.registerError.classList.add('hidden');
        try {
            elements.registerSubmitButton.disabled = true;
            showToast('📝 Creando cuenta...');
            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'register', nombre: name, email, password })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast('✅ Cuenta creada. Inicia sesión.');
                elements.registerForm.reset();
                switchAuthForm('login');
            } else {
                elements.registerError.textContent = `❌ ${result.message}`;
                elements.registerError.classList.remove('hidden');
            }
        } catch (error) {
            elements.registerError.textContent = '❌ Error de conexión';
            elements.registerError.classList.remove('hidden');
        } finally {
            elements.registerSubmitButton.disabled = false;
        }
    }

    function switchAuthForm(form) {
        if (form === 'login') {
            elements.loginForm.classList.remove('hidden');
            elements.registerForm.classList.add('hidden');
            $('#login-title').textContent = '🔐 Iniciar Sesión';
        } else {
            elements.loginForm.classList.add('hidden');
            elements.registerForm.classList.remove('hidden');
            $('#login-title').textContent = '📝 Registro de Usuario';
        }
    }

    function init() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            if (elements.darkModeToggle) elements.darkModeToggle.textContent = 'Modo Claro ☀️';
        }

        elements.scriptUrlInput.value = GOOGLE_SHEETS_CONFIG.appScriptUrl;

        const userEmail = sessionStorage.getItem('userEmail');
        if (userEmail) {
            elements.loginModal.classList.add('hidden');
            elements.appContainer.classList.remove('hidden');
            elements.appContainer.classList.add('md:flex');
            elements.sidebarUserName.textContent = `Usuario: ${sessionStorage.getItem('userName')} (${sessionStorage.getItem('userRole')})`;
            checkUserRole(sessionStorage.getItem('userRole'));
            loadClientsFromGoogleSheets();
            if (sessionStorage.getItem('userRole') === 'Admin') loadUsersFromGoogleSheets();
        } else {
            elements.loginModal.classList.remove('hidden');
            elements.appContainer.classList.add('hidden');
            elements.appContainer.classList.remove('md:flex');
            const lastUser = localStorage.getItem('lastUser');
            if (lastUser) elements.loginEmail.value = lastUser;
        }

        // Event Listeners
        elements.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loginUserViaSheets(elements.loginEmail.value.trim(), elements.loginPassword.value.trim());
        });

        elements.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            registerUserViaSheets(elements.registerName.value.trim(), elements.registerEmail.value.trim(), elements.registerPassword.value.trim());
        });

        elements.toggleRegisterBtn.addEventListener('click', () => switchAuthForm('register'));
        elements.toggleLoginBtn.addEventListener('click', () => switchAuthForm('login'));
        elements.quickInitButton.addEventListener('click', initializeDatabase);

        elements.logoutButton.addEventListener('click', () => {
            sessionStorage.clear();
            elements.appContainer.classList.add('hidden');
            elements.appContainer.classList.remove('md:flex');
            elements.loginModal.classList.remove('hidden');
            elements.loginModal.querySelector('.modal-content').classList.remove('scale-95', 'opacity-0');
            showToast('Sesión cerrada');
        });

        elements.initDatabaseButton.addEventListener('click', initializeDatabase);
        elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(e.currentTarget.getAttribute('href').substring(1));
            });
        });

        elements.addClientButton.addEventListener('click', () => toggleClientModal(true));
        elements.cancelClientModal.addEventListener('click', () => toggleClientModal(false));
        elements.clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientData = {
                name: $('#client-name').value,
                email: $('#client-email').value,
                phone: $('#client-phone').value,
                address: $('#client-address').value,
            };
            const id = elements.clientIdInput.value;
            if (id) {
                clientData.id = id;
                if (await updateClientInGoogleSheets(clientData)) loadClientsFromGoogleSheets();
            } else {
                if (await addClientToGoogleSheets(clientData)) loadClientsFromGoogleSheets();
            }
            toggleClientModal(false);
        });

        elements.clientsTableBody.addEventListener('click', async e => {
            const id = e.target.dataset.id;
            if (e.target.classList.contains('edit-client-btn')) {
                const client = appState.clients.find(c => c.id == id);
                toggleClientModal(true, client);
            }
            if (e.target.classList.contains('delete-client-btn')) {
                if (confirm('¿Eliminar cliente?') && await deleteClientFromGoogleSheets(id)) loadClientsFromGoogleSheets();
            }
        });

        elements.startPauseButton.addEventListener('click', () => {
            if (appState.timer.isRunning) pauseTimer();
            else if (appState.timer.isPaused) resumeTimer();
            else startTimer();
        });
        elements.stopButton.addEventListener('click', stopTimer);
        if (elements.darkModeToggle) elements.darkModeToggle.addEventListener('click', toggleDarkMode);

        elements.sendWhatsappButton.addEventListener('click', () => {
            if (!appState.currentInvoiceData) return;
            const { client, hours, rate, total } = appState.currentInvoiceData;
            const msg = `📄 *CUENTA DE COBRO*\n\n¡Hola ${client.name}!\n\nDuración: ${hours.toFixed(2)}h\nTotal: $${total.toFixed(2)}`;
            const phone = String(client.phone).replace(/\D/g, '');
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            toggleInvoiceModal(false);
        });

        elements.addUserButton.addEventListener('click', () => toggleUserModal(true));
        elements.cancelUserModal.addEventListener('click', () => toggleUserModal(false));
        elements.closeUserModalBtn.addEventListener('click', () => toggleUserModal(false));
        elements.userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                nombre: $('#user-name').value,
                email: $('#user-email').value,
                password: $('#user-password').value,
                role: $('#user-role').value
            };
            if (await createUserViaSheets(userData)) toggleUserModal(false);
        });
        elements.usersTableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-user-btn')) await deleteUserViaSheets(e.target.dataset.id);
        });
    }

    function toggleDarkMode() {
        if (document.documentElement.classList.toggle('dark')) {
            elements.darkModeToggle.textContent = 'Modo Claro ☀️';
            localStorage.setItem('theme', 'dark');
        } else {
            elements.darkModeToggle.textContent = 'Modo Oscuro 🌙';
            localStorage.setItem('theme', 'light');
        }
    }

    init();
});
