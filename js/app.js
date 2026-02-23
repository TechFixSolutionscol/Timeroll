document.addEventListener('DOMContentLoaded', () => {

    // Configuración de Google Sheets
    const GOOGLE_SHEETS_CONFIG = {
        appScriptUrl: 'https://script.google.com/macros/s/AKfycbxltspHg_waM1KXGzIlsfvfdbedTIem8eqrIlFb4eBoTovVW2Y2aggrE2R2L29OGQyE/exec'
    };

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
        nextClientId: 2,
        currentInvoiceData: null, // To store invoice data for email generation
    };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const elements = {
        appContainer: $('#app-container'),
        loginModal: $('#login-modal'),
        // Login fields
        loginForm: $('#login-form'),
        loginEmail: $('#login-email'),
        loginPassword: $('#login-password'),
        loginSubmitButton: $('#login-submit-button'),
        loginError: $('#login-error'),
        // Register fields removed
        // App control
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
        // Users Management (New)
        usersTableBody: $('#users-table-body'),
        addUserButton: $('#add-user-button'),
        userModal: $('#user-modal'),
        userForm: $('#user-form'),
        cancelUserModal: $('#cancel-user-modal'),
        closeUserModalBtn: $('#close-user-modal-btn'),
        navUsers: $('#nav-users'),
        noUsersMessage: $('#no-users-message'),

        // Added missing references if needed, but existing list seems complete for now.
        toast: $('#toast-notification'), // Adding this as it was used in showToast but maybe accessed directly via ID in original code? 
        // Original code used elements.toastMessage and elements.toast. 
        // Let's check original showToast function.
        // It used elements.toastMessage and elements.toast. But these were not in the 'elements' object definition I saw above?
        // Ah, looking at lines 496+, showToast uses elements.toastMessage and elements.toast.
        // I need to add them to elements object.
        toastMessage: $('#toast-message'),
    };

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

        // Módulo contratos: poblar selects de empresa y añadir botón ⚙ Contrato
        if (typeof poblarSelectsEmpresas === 'function') poblarSelectsEmpresas();
        if (typeof renderClientesConBotonContrato === 'function') renderClientesConBotonContrato();
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

    // Load Users
    async function loadUsersFromGoogleSheets() {
        try {
            const url = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_users`; // Not exactly standard GET in this script but if changed to POST or handled in doGet
            // Since doGet doesn't handle get_users in previous version, we used POST for everything mostly or consistent GET.
            // Wait, I added get_users to doPost in GAS but not doGet?
            // Checking GAS: `case 'get_users': return getUsersList(payload);` in doPost.
            // So I must use POST.

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'get_users' })
            });

            const result = await response.json();

            if (result.status === 'success' && result.data.users) {
                appState.users = result.data.users;
                console.log('✅ Usuarios cargados:', appState.users);
                renderUsers();
            } else {
                console.warn('⚠️ No se pudieron cargar usuarios');
            }
        } catch (error) {
            console.error('❌ Error al cargar usuarios:', error);
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
                loadUsersFromGoogleSheets(); // Reload list
                return true;
            } else {
                showToast(`❌ Error: ${result.message}`);
                return false;
            }
        } catch (error) {
            console.error('Error creating user:', error);
            showToast('❌ Error de conexión');
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
                body: JSON.stringify({
                    action: 'delete_user',
                    id: userId
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                showToast('✅ Usuario eliminado');
                loadUsersFromGoogleSheets();
            } else {
                showToast(`❌ Error: ${result.message}`);
            }
        } catch (e) {
            showToast('❌ Error de conexión');
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

        if (!client) {
            alert('⚠️ Error: No se pudo identificar el cliente. Los datos se perderán.');
            return;
        }

        // Guardar la sesión en Google Sheets
        const sessionData = {
            client,
            hours,
            rate,
            total,
            startTime: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        };
        saveSessionToGoogleSheets(sessionData);

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

    /**
     * Guarda la sesión de tiempo en Google Sheets
     */
    async function saveSessionToGoogleSheets(sessionData) {
        try {
            const payload = {
                action: 'save_session',
                cliente: sessionData.client.name,
                email: sessionData.client.email,
                duracion: sessionData.hours,
                valor_hora: sessionData.rate,
                hora_inicio: sessionData.startTime || new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            };

            console.log('📤 Enviando sesión a Google Sheets:', payload);

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            console.log('📥 Respuesta de Google Sheets:', result);

            if (result.status === 'success') {
                console.log('✅ Sesión guardada en Google Sheets:', result.data);
                showToast(`✅ Datos guardados: ID ${result.data.id} - Total: $${result.data.total}`);
                return result.data;
            } else {
                console.error('❌ Error al guardar:', result.message);
                showToast(`⚠️ No se pudo guardar en la nube: ${result.message}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error de conexión con Google Sheets:', error);
            showToast('⚠️ Error de conexión. Los datos se guardaron localmente.');
            return null;
        }
    }

    /**
     * Verifica si la base de datos está inicializada
     */
    async function checkDatabaseInitialization() {
        try {
            const url = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=check_initialization`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.status === 'success') {
                console.log('✅ Estado de inicialización:', result.data);
                return result.data;
            } else {
                console.error('❌ Error al verificar:', result.message);
                return null;
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            return null;
        }
    }

    /**
     * Inicializa la base de datos
     */
    async function initializeDatabase() {
        try {
            elements.initDatabaseButton.disabled = true;
            elements.initSpinner.classList.remove('hidden');
            elements.initStatus.classList.remove('hidden');
            elements.initMessage.textContent = '⏳ Inicializando base de datos...';

            const payload = {
                action: 'initialize'
            };

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                console.log('✅ Base de datos inicializada:', result.data);
                elements.initMessage.textContent = `✅ ${result.data.message}`;
                elements.initStatus.classList.add('bg-green-50');
                elements.initStatus.classList.remove('bg-blue-50');
                elements.initMessage.classList.add('text-green-800');
                elements.initMessage.classList.remove('text-blue-800');
                showToast('✅ Base de datos inicializada correctamente');

                // Recargar clientes
                setTimeout(() => {
                    loadClientsFromGoogleSheets();
                }, 1500);
            } else {
                console.error('❌ Error:', result.message);
                elements.initMessage.textContent = `❌ Error: ${result.message}`;
                elements.initStatus.classList.add('bg-red-50');
                elements.initStatus.classList.remove('bg-blue-50');
                elements.initMessage.classList.add('text-red-800');
                elements.initMessage.classList.remove('text-blue-800');
                showToast(`❌ Error: ${result.message}`);
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            elements.initMessage.textContent = `❌ Error de conexión: ${error.message}`;
            elements.initStatus.classList.add('bg-red-50');
            elements.initStatus.classList.remove('bg-blue-50');
            elements.initMessage.classList.add('text-red-800');
            elements.initMessage.classList.remove('text-blue-800');
            showToast('❌ Error de conexión');
        } finally {
            elements.initDatabaseButton.disabled = false;
            elements.initSpinner.classList.add('hidden');
        }
    }

    /**
     * Carga clientes desde Google Sheets
     */
    async function loadClientsFromGoogleSheets() {
        try {
            const url = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_clients`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.status === 'success' && result.data.clients) {
                appState.clients = result.data.clients.map(client => ({
                    id: client.ID,
                    name: client.Nombre,
                    email: client.Email,
                    phone: client.Teléfono || client.Telefono || client.Phone || '',
                    address: client.Dirección || client.Address || ''
                }));

                console.log('✅ Clientes cargados desde Google Sheets:', appState.clients);
                renderClients();
                return appState.clients;
            } else {
                console.warn('⚠️ No se pudieron cargar clientes, usando locales');
                renderClients();
            }
        } catch (error) {
            console.error('❌ Error al cargar clientes:', error);
            renderClients();
        }
    }

    /**
     * Agrega un cliente a Google Sheets
     */
    async function addClientToGoogleSheets(clientData) {
        try {
            const payload = {
                action: 'add_client',
                name: clientData.name,
                email: clientData.email,
                phone: clientData.phone,
                address: clientData.address
            };

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                console.log('✅ Cliente agregado en Google Sheets:', result.data);
                showToast(`✅ Cliente "${result.data.name}" agregado`);
                return result.data;
            } else {
                console.error('❌ Error al agregar cliente:', result.message);
                showToast(`⚠️ Error: ${result.message}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            showToast('⚠️ Error de conexión. Cliente guardado localmente.');
            return null;
        }
    }

    /**
     * Actualiza un cliente en Google Sheets
     */
    async function updateClientInGoogleSheets(clientData) {
        try {
            const payload = {
                action: 'update_client',
                id: clientData.id,
                name: clientData.name,
                email: clientData.email,
                phone: clientData.phone,
                address: clientData.address
            };

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                console.log('✅ Cliente actualizado en Google Sheets:', result.data);
                showToast(`✅ Cliente "${result.data.name}" actualizado`);
                return result.data;
            } else {
                console.error('❌ Error al actualizar cliente:', result.message);
                showToast(`⚠️ Error: ${result.message}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            showToast('⚠️ Error de conexión. Cliente actualizado localmente.');
            return null;
        }
    }

    /**
     * Elimina un cliente de Google Sheets
     */
    async function deleteClientFromGoogleSheets(clientId) {
        try {
            const payload = {
                action: 'delete_client',
                id: clientId
            };

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                console.log('✅ Cliente eliminado de Google Sheets');
                showToast('✅ Cliente eliminado');
                return true;
            } else {
                console.error('❌ Error al eliminar cliente:', result.message);
                showToast(`⚠️ Error: ${result.message}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            showToast('⚠️ Error de conexión. Cliente eliminado localmente.');
            return false;
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



    function saveLoginCredentials(email, appPassword) {
        // Guardar credenciales de forma segura en localStorage
        localStorage.setItem('userEmail', email);
        // NOTA: NO guardamos la contraseña sin encriptar. La app solicitará que la ingrese cada vez.
        // O si deseas guardarla, usa una encriptación simple (base64 es solo para demo):
        localStorage.setItem('userAppPassword', btoa(appPassword)); // Base64 (solo para demo, no es criptografía real)
        localStorage.setItem('isLoggedIn', 'true');
    }

    function loadLoginCredentials() {
        const email = localStorage.getItem('userEmail');
        if (email) {
            elements.loginEmail.value = email;
        }
    }

    function loginUser() {
        const email = elements.loginEmail.value?.trim();
        const appPassword = elements.loginPassword.value?.trim();
        const errorDiv = elements.loginError;

        // Limpiar error anterior
        errorDiv.classList.add('hidden');

        // Validar campos vacíos
        if (!email || !appPassword) {
            errorDiv.textContent = '⚠️ Por favor completa todos los campos.';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {


            // Guardar credenciales
            saveLoginCredentials(email, appPassword);

            // Animar cierre del modal
            elements.loginModal.querySelector('.modal-content').classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                elements.loginModal.classList.add('hidden');
                elements.appContainer.classList.remove('hidden');
                showToast(`✅ Bienvenido, ${email}!`);
                checkDatabaseInitialization();
            }, 300);

        } catch (error) {
            console.error('Error de login:', error);
            errorDiv.textContent = `❌ ${error.message}`;
            errorDiv.classList.remove('hidden');
        }
    }

    // Funciones de Login/Registro con Google Sheets
    async function loginUserViaSheets(email, password) {
        const errorDiv = elements.loginError;
        errorDiv.classList.add('hidden');

        if (!email || !password) {
            errorDiv.textContent = '⚠️ Por favor completa todos los campos.';
            errorDiv.classList.remove('hidden');
            return false;
        }

        try {
            elements.loginSubmitButton.disabled = true;
            showToast('🔍 Validando credenciales...');

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify({
                    action: 'login',
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                sessionStorage.setItem('userEmail', result.data.email);
                sessionStorage.setItem('userName', result.data.nombre);
                sessionStorage.setItem('userId', result.data.id);
                sessionStorage.setItem('userRole', result.data.role); // Save role
                localStorage.setItem('lastUser', email); // Recordar último usuario

                checkUserRole(result.data.role);
                if (result.data.role === 'Admin') {
                    loadUsersFromGoogleSheets();
                }



                // Animar cierre
                elements.loginModal.querySelector('.modal-content').classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    elements.loginModal.classList.add('hidden');
                    elements.appContainer.classList.remove('hidden');
                    showToast(`✅ ¡Bienvenido, ${result.data.nombre}!`);
                    checkDatabaseInitialization();
                }, 300);

                return true;
            } else {
                errorDiv.textContent = `❌ ${result.message}`;
                errorDiv.classList.remove('hidden');
                return false;
            }
        } catch (error) {
            console.error('Error al hacer login:', error);
            errorDiv.textContent = '❌ Error de conexión. Intenta de nuevo.';
            errorDiv.classList.remove('hidden');
            return false;
        } finally {
            elements.loginSubmitButton.disabled = false;
        }
    }

    // Check role and show menu
    function checkUserRole(role) {
        if (role === 'Admin') {
            elements.navUsers.classList.remove('hidden');
        } else {
            elements.navUsers.classList.add('hidden');
        }
    }

    async function registerUserViaSheets(name, email, password, passwordConfirm) {
        const errorDiv = elements.registerError;
        errorDiv.classList.add('hidden');

        // Validaciones
        if (!name || !email || !password || !passwordConfirm) {
            errorDiv.textContent = '⚠️ Por favor completa todos los campos.';
            errorDiv.classList.remove('hidden');
            return false;
        }

        if (password !== passwordConfirm) {
            errorDiv.textContent = '⚠️ Las contraseñas no coinciden.';
            errorDiv.classList.remove('hidden');
            return false;
        }

        if (password.length < 8) {
            errorDiv.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres.';
            errorDiv.classList.remove('hidden');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorDiv.textContent = '⚠️ Email no válido.';
            errorDiv.classList.remove('hidden');
            return false;
        }

        try {
            elements.registerSubmitButton.disabled = true;
            showToast('📝 Creando cuenta...');

            const response = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // Fixed CORS
                body: JSON.stringify({
                    action: 'register',
                    nombre: name,
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                showToast('✅ Cuenta creada exitosamente. Inicia sesión.');
                // Limpiar y cambiar a login
                elements.registerForm.reset();
                switchAuthForm('login');
                return true;
            } else {
                errorDiv.textContent = `❌ ${result.message}`;
                errorDiv.classList.remove('hidden');
                return false;
            }
        } catch (error) {
            console.error('Error al registrar:', error);
            errorDiv.textContent = '❌ Error de conexión. Intenta de nuevo.';
            errorDiv.classList.remove('hidden');
            return false;
        } finally {
            elements.registerSubmitButton.disabled = false;
        }
    }

    function switchAuthForm(form) {
        // Function simplified as only login exists now
        elements.loginForm.classList.remove('hidden');
        elements.loginError.classList.add('hidden');
    }

    // Event listeners para formularios
    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = elements.loginEmail.value?.trim();
        const password = elements.loginPassword.value?.trim();
        loginUserViaSheets(email, password);
    });

    // Register event listeners removed

    elements.logoutButton.addEventListener('click', () => {
        // Limpiar sesión
        sessionStorage.clear();

        // Limpiar formularios
        elements.loginForm.reset();
        elements.loginError.classList.add('hidden');

        // Ocultar menú admin si estaba visible
        elements.navUsers.classList.add('hidden');

        // Mostrar login form
        switchAuthForm('login');

        // Mostrar modal
        elements.appContainer.classList.add('hidden');
        elements.loginModal.classList.remove('hidden');
        elements.loginModal.querySelector('.modal-content').classList.remove('opacity-0');
        setTimeout(() => elements.loginModal.querySelector('.modal-content').classList.remove('scale-95'), 10);

        showToast('✅ Sesión cerrada');
    });

    // Event listener para inicializar base de datos
    elements.initDatabaseButton.addEventListener('click', initializeDatabase);

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

        if (id) {
            // Actualizar cliente existente
            clientData.id = id;
            const result = await updateClientInGoogleSheets(clientData);
            if (result) {
                const index = appState.clients.findIndex(c => c.id === id);
                appState.clients[index] = { ...clientData, id };
            }
        } else {
            // Agregar nuevo cliente
            const result = await addClientToGoogleSheets(clientData);
            if (result) {
                clientData.id = result.id;
                appState.clients.push(clientData);
            } else {
                // Si falla la sincronización, guardar localmente
                clientData.id = appState.nextClientId++;
                appState.clients.push(clientData);
            }
        }

        renderClients();
        toggleClientModal(false);
    });

    elements.clientsTableBody.addEventListener('click', e => {
        const target = e.target;
        if (target.classList.contains('edit-client-btn')) {
            const id = parseInt(target.dataset.id);
            const client = appState.clients.find(c => c.id === id);
            toggleClientModal(true, client);
        }
        if (target.classList.contains('delete-client-btn')) {
            const id = parseInt(target.dataset.id);
            if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
                deleteClientFromGoogleSheets(id).then(success => {
                    if (success || true) { // Eliminar localmente de todas formas
                        appState.clients = appState.clients.filter(c => c.id !== id);
                        renderClients();
                    }
                });
            }
        }
    });

    elements.startPauseButton.addEventListener('click', () => {
        if (appState.timer.isRunning) {
            pauseTimer();
        } else if (appState.timer.isPaused) {
            resumeTimer();
        } else {
            startTimer();
        }
    });

    elements.stopButton.addEventListener('click', stopTimer);

    if (elements.darkModeToggle) {
        elements.darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    elements.sendWhatsappButton.addEventListener('click', () => {
        if (!appState.currentInvoiceData) {
            showToast('⚠️ Primero debes finalizar una sesión para enviar la factura.');
            return;
        }
        if (!appState.currentInvoiceData.client.phone) {
            console.warn('⚠️ Cliente sin teléfono:', appState.currentInvoiceData.client);
            alert('⚠️ El cliente no tiene número de teléfono configurado. Por favor, edita el cliente y añade un número.');
            return;
        }
        const { client, hours, rate, total } = appState.currentInvoiceData;
        const mensaje = `📄 *CUENTA DE COBRO*\n\n¡Hola ${client.name}!\n\nTe comparto la cuenta de cobro por la sesión de trabajo:\n\n━━━━━━━━━━━━━━━━━━━━\n⏱️ *Duración:* ${hours.toFixed(2)} horas\n💰 *Tarifa:* $${rate.toFixed(2)}/hora\n✅ *TOTAL A PAGAR:* $${total.toFixed(2)}\n━━━━━━━━━━━━━━━━━━━━\n\n¡Gracias por tu confianza en nuestros servicios! 🙏`;
        let numero = String(client.phone).replace(/\D/g, '');
        if (numero && !numero.startsWith('57')) {
            numero = '57' + numero;
        }
        if (!numero) {
            showToast('⚠️ No se pudo procesar el número de teléfono.');
            return;
        }
        const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
        toggleInvoiceModal(false);
        showToast('✅ Se abrió WhatsApp con la plantilla de factura lista para enviar.');
    });

    function init() {
        // Initialize theme based on localStorage or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }

        // Verificar si está logueado (usando sessionStorage)
        const userEmail = sessionStorage.getItem('userEmail');
        if (userEmail) {
            // Ya está logueado
            elements.loginModal.classList.add('hidden');
            elements.appContainer.classList.remove('hidden');
            switchAuthForm('login'); // Asegurar que muestra form correcto
            switchView('dashboard');
            loadClientsFromGoogleSheets();
        } else {
            // No está logueado - mostrar login
            elements.loginModal.classList.remove('hidden');
            elements.appContainer.classList.add('hidden');
            switchAuthForm('login');
            // Pre-cargar último usuario si existe
            const lastUser = localStorage.getItem('lastUser');
            if (lastUser) {
                elements.loginEmail.value = lastUser;
            }
        }

        // Event Listeners for Users Management
        if (elements.addUserButton) elements.addUserButton.addEventListener('click', () => toggleUserModal(true));
        if (elements.cancelUserModal) elements.cancelUserModal.addEventListener('click', () => toggleUserModal(false));
        if (elements.closeUserModalBtn) elements.closeUserModalBtn.addEventListener('click', () => toggleUserModal(false));

        if (elements.userForm) {
            elements.userForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userData = {
                    nombre: $('#user-name').value,
                    email: $('#user-email').value,
                    password: $('#user-password').value,
                    role: $('#user-role').value
                };

                // Basic validation
                if (userData.password.length < 6) {
                    alert('La contraseña debe tener al menos 6 caracteres');
                    return;
                }

                const success = await createUserViaSheets(userData);
                if (success) {
                    toggleUserModal(false);
                }
            });
        }

        if (elements.usersTableBody) {
            elements.usersTableBody.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-user-btn')) {
                    const userId = e.target.getAttribute('data-id');
                    await deleteUserViaSheets(userId);
                }
            });
        }

        // Verificar estado de inicialización en background (si está logueado)
        if (userEmail) {
            checkDatabaseInitialization().then(status => {
                if (status && !status.initialized) {
                    console.warn('⚠️ Base de datos no inicializada. Navegue a Configuración para inicializar.');
                }
            });
        }
    }

    init();

    // ═══════════════════════════════════════════════════════════
    // MÓDULO: CONTRATOS, REPORTE DE HORAS Y CIERRES QUINCENALES
    // ═══════════════════════════════════════════════════════════

    const COP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

    // Estado del módulo de contratos
    const contratoState = {
        empresaActual: null,   // { id, name, email }
        configActiva: null,
    };

    // ── Utilidad: llenado de selects de empresa ────────────────
    function poblarSelectsEmpresas() {
        const selectores = [
            $('#reporte-empresa'),
            $('#filtro-servicio-empresa'),
            $('#contrato-empresa-selector'),
        ];
        selectores.forEach(sel => {
            if (!sel) return;
            const val = sel.value; // conservar selección actual
            while (sel.options.length > 1) sel.remove(1);
            appState.clients.forEach(c => {
                const opt = new Option(c.name, c.id);
                sel.add(opt);
            });
            sel.value = val;
        });
    }


    // Hook: cuando se renderizan clientes, también poblar selects y añadir botón contrato
    // (se ejecuta desde renderClients() existente, extendido abajo)

    // Añadir botón "⚙ Contrato" en tabla de Clientes
    function renderClientesConBotonContrato() {
        document.querySelectorAll('#clients-table-body tr').forEach(tr => {
            // Evitar duplicados
            if (tr.querySelector('.contrato-btn')) return;
            const lastTd = tr.querySelector('td:last-child');
            if (!lastTd) return;
            const btnEl = document.createElement('button');
            btnEl.className = 'contrato-btn text-indigo-600 hover:text-indigo-800 ml-4 text-sm font-semibold';
            btnEl.textContent = '⚙ Contrato';
            // Obtener id del botón de editar
            const editBtn = tr.querySelector('.edit-client-btn');
            if (editBtn) {
                const cid = editBtn.dataset.id;
                btnEl.dataset.id = cid;
            }
            lastTd.appendChild(btnEl);
        });
    }

    // Abrir modal de contrato desde la tabla de clientes
    document.querySelector('#clients-table-body')?.addEventListener('click', e => {
        if (e.target.classList.contains('contrato-btn')) {
            const id = e.target.dataset.id;
            const client = appState.clients.find(c => String(c.id) === String(id));
            if (client) abrirModalContrato(client);
        }
    });

    // ── MODAL CONTRATO ─────────────────────────────────────────

    function abrirModalContrato(client) {
        $('#contrato-empresa-id').value = client.id;
        $('#contrato-empresa-nombre').textContent = `Empresa: ${client.name}`;
        $('#contrato-form').reset();
        $('#contrato-empresa-id').value = client.id;
        actualizarCamposSegunTipo($('#contrato-tipo').value);
        // Pre-llenar fecha de hoy
        $('#contrato-vigente-desde').value = new Date().toISOString().split('T')[0];
        const modal = $('#contrato-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.querySelector('.modal-content').classList.remove('scale-95'), 10);
    }

    function cerrarModalContrato() {
        const modal = $('#contrato-modal');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    function actualizarCamposSegunTipo(tipo) {
        if (tipo === 'FIJO') {
            $('#campo-valor-fijo').classList.remove('hidden');
            $('#campos-por-horas').classList.add('hidden');
        } else {
            $('#campo-valor-fijo').classList.add('hidden');
            $('#campos-por-horas').classList.remove('hidden');
        }
    }

    $('#contrato-tipo')?.addEventListener('change', e => actualizarCamposSegunTipo(e.target.value));
    $('#cancel-contrato-modal')?.addEventListener('click', cerrarModalContrato);
    $('#close-contrato-modal')?.addEventListener('click', cerrarModalContrato);

    $('#contrato-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const tipo = $('#contrato-tipo').value;
        const payload = {
            action: 'save_empresa_config',
            empresaId: $('#contrato-empresa-id').value,
            tipoCobro: tipo,
            valorFijo: $('#contrato-valor-fijo')?.value || 0,
            horasIncluidas: $('#contrato-horas-incluidas')?.value || 0,
            valorHora: $('#contrato-valor-hora')?.value || 0,
            valorHoraExtra: $('#contrato-valor-hora-extra')?.value || 0,
            vigenteDesde: $('#contrato-vigente-desde').value,
            observaciones: $('#contrato-observaciones').value,
        };
        try {
            showToast('⏳ Guardando contrato...');
            const res = await apiPost(payload);
            if (res.status === 'success') {
                showToast('✅ Contrato guardado correctamente');
                cerrarModalContrato();
                // Si hay empresa seleccionada en panel contratos, recargarla
                if (contratoState.empresaActual?.id == payload.empresaId) {
                    cargarPanelContrato(contratoState.empresaActual);
                }
            } else {
                showToast(`❌ ${res.message}`);
            }
        } catch (err) {
            showToast('❌ Error de conexión');
        }
    });

    // ── PÁGINA CONTRATOS ───────────────────────────────────────

    $('#btn-ver-contrato')?.addEventListener('click', () => {
        const sel = $('#contrato-empresa-selector');
        const id = sel.value;
        const name = sel.options[sel.selectedIndex]?.text;
        if (!id) { showToast('⚠️ Selecciona una empresa'); return; }
        const client = appState.clients.find(c => String(c.id) === String(id));
        cargarPanelContrato(client || { id, name });
    });

    async function cargarPanelContrato(client) {
        contratoState.empresaActual = client;
        $('#panel-contrato-placeholder').classList.add('hidden');
        $('#panel-contrato-activo').classList.remove('hidden');

        // Cargar config activa
        try {
            const url = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_empresa_config&empresaId=${client.id}`;
            const res = await (await fetch(url)).json();
            const config = res.data?.config;
            contratoState.configActiva = config;
            renderConfigActiva(config, client);
        } catch (e) { renderConfigActiva(null, client); }

        // Cargar historial
        try {
            const url2 = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_empresa_config_history&empresaId=${client.id}`;
            const res2 = await (await fetch(url2)).json();
            renderHistorialContratos(res2.data?.history || []);
        } catch (e) { renderHistorialContratos([]); }

        // Cargar cierres
        try {
            const url3 = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_cierres&empresaId=${client.id}`;
            const res3 = await (await fetch(url3)).json();
            renderCierres(res3.data?.cierres || [], client);
        } catch (e) { renderCierres([], client); }
    }

    function renderConfigActiva(config, client) {
        const box = $('#contrato-activo-info');

        // Siempre asignar el onclick, tanto si hay config como si no
        const btnNuevoContrato = $('#btn-nuevo-contrato');
        if (btnNuevoContrato) {
            btnNuevoContrato.onclick = () => abrirModalContrato(client);
        }

        if (!config) {
            box.innerHTML = `<p class="col-span-3 text-gray-400 dark:text-zinc-500 text-center py-4">Sin configuración activa. Haz clic en <strong>Nuevo Contrato</strong> para configurar.</p>`;
            return;
        }
        const tipo = config.TipoCobro || config['TipoCobro'];
        const badge = tipo === 'FIJO'
            ? '<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">FIJO</span>'
            : '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">POR HORAS</span>';

        let detalle = '';
        if (tipo === 'FIJO') {
            detalle = `<div><p class="text-xs text-gray-500 dark:text-zinc-400">Valor Quincenal</p><p class="text-2xl font-bold text-indigo-700 dark:text-indigo-300">${COP(config.ValorFijoQuincenal || 0)}</p></div>`;
        } else {
            detalle = `
                <div><p class="text-xs text-gray-500 dark:text-zinc-400">Horas incluidas</p><p class="text-xl font-bold">${config.HorasIncluidas || 0} h</p></div>
                <div><p class="text-xs text-gray-500 dark:text-zinc-400">Valor hora</p><p class="text-xl font-bold">${COP(config.ValorHora || 0)}</p></div>
                <div><p class="text-xs text-gray-500 dark:text-zinc-400">Valor hora extra</p><p class="text-xl font-bold">${COP(config.ValorHoraExtra || 0)}</p></div>
            `;
        }
        box.innerHTML = `
            <div class="bg-indigo-50 dark:bg-zinc-600 p-4 rounded-xl">
                <p class="text-xs text-gray-500 dark:text-zinc-400 mb-1">Tipo de Contrato</p>
                ${badge}
                <p class="text-xs text-gray-400 mt-2">Desde: ${config.VigenteDesde || '—'}</p>
            </div>
            ${detalle}
        `;
    }

    function renderHistorialContratos(history) {
        const tbody = $('#historial-contratos-body');
        tbody.innerHTML = '';
        if (!history.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Sin historial</td></tr>';
            return;
        }
        history.forEach(h => {
            const tipo = h.TipoCobro || '—';
            const valor = tipo === 'FIJO'
                ? COP(h.ValorFijoQuincenal || 0)
                : `${h.HorasIncluidas || 0}h · ${COP(h.ValorHora || 0)}/h`;
            const estadoBadge = h.Estado === 'Activa'
                ? '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">Activa</span>'
                : '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">Cerrada</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-medium">${tipo}</td>
                <td class="p-3">${h.VigenteDesde || '—'}</td>
                <td class="p-3">${h.VigenteHasta || 'vigente'}</td>
                <td class="p-3">${valor}</td>
                <td class="p-3">${estadoBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderCierres(cierres, client) {
        const tbody = $('#cierres-table-body');
        const noMsg = $('#no-cierres-msg');
        tbody.innerHTML = '';

        // Botón generar cierre
        $('#btn-nuevo-cierre').onclick = () => abrirModalCierre(client);

        if (!cierres.length) {
            noMsg.classList.remove('hidden');
            return;
        }
        noMsg.classList.add('hidden');

        cierres.forEach(c => {
            const estadoBadge = c.Estado === 'Cerrado'
                ? '<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Cerrado</span>'
                : '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">Abierto</span>';
            const cerrarBtn = c.Estado === 'Abierto'
                ? `<button class="cerrar-cierre-btn text-xs text-red-600 hover:text-red-800 mr-2" data-id="${c.ID}">Cerrar</button>`
                : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3">${c.Desde} → ${c.Hasta}</td>
                <td class="p-3 font-medium">${c.TipoCobro || '—'}</td>
                <td class="p-3 text-right">${c.TotalHoras || 0} h</td>
                <td class="p-3 text-right font-bold text-indigo-700 dark:text-indigo-300">${COP(c.TotalCobro || 0)}</td>
                <td class="p-3 text-center">${estadoBadge}</td>
                <td class="p-3 text-center">
                    ${cerrarBtn}
                    <button class="ver-pdf-btn text-xs text-indigo-600 hover:text-indigo-800" data-cierre='${JSON.stringify(c)}' data-empresa="${client.name}">📄 PDF</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Delegación de eventos en la tabla de cierres
        tbody.addEventListener('click', async e => {
            if (e.target.classList.contains('cerrar-cierre-btn')) {
                if (!confirm('¿Cerrar este cierre quincenal definitivamente?')) return;
                const id = e.target.dataset.id;
                const res = await apiPost({ action: 'cerrar_cierre', id });
                if (res.status === 'success') {
                    showToast('✅ Cierre cerrado'); cargarPanelContrato(client);
                } else showToast(`❌ ${res.message}`);
            }
            if (e.target.classList.contains('ver-pdf-btn')) {
                const cierre = JSON.parse(e.target.dataset.cierre);
                const empresa = e.target.dataset.empresa;
                mostrarPDF(cierre, empresa, client.id);
            }
        });
    }

    // ── MODAL CIERRE ───────────────────────────────────────────

    function abrirModalCierre(client) {
        $('#cierre-empresa-id').value = client.id;
        $('#cierre-empresa-nombre').textContent = `Empresa: ${client.name}`;
        $('#cierre-form').reset();
        $('#cierre-empresa-id').value = client.id;
        $('#cierre-preview').classList.add('hidden');

        // Sugerir quincena actual
        const hoy = new Date();
        const dia = hoy.getDate();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        if (dia <= 15) {
            $('#cierre-desde').value = `${anio}-${mes}-01`;
            $('#cierre-hasta').value = `${anio}-${mes}-15`;
        } else {
            const ultimo = new Date(anio, hoy.getMonth() + 1, 0).getDate();
            $('#cierre-desde').value = `${anio}-${mes}-16`;
            $('#cierre-hasta').value = `${anio}-${mes}-${ultimo}`;
        }

        const modal = $('#cierre-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.querySelector('.modal-content').classList.remove('scale-95'), 10);
    }

    function cerrarModalCierre() {
        const modal = $('#cierre-modal');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    $('#cancel-cierre-modal')?.addEventListener('click', cerrarModalCierre);
    $('#close-cierre-modal')?.addEventListener('click', cerrarModalCierre);

    $('#btn-preview-cierre')?.addEventListener('click', async () => {
        const empresaId = $('#cierre-empresa-id').value;
        const desde = $('#cierre-desde').value;
        const hasta = $('#cierre-hasta').value;
        if (!desde || !hasta) { showToast('⚠️ Completa las fechas'); return; }
        try {
            showToast('⏳ Calculando...');
            const res = await apiPost({ action: 'calcular_cierre', empresaId, desde, hasta });
            if (res.status === 'success') {
                const d = res.data;
                const box = $('#cierre-preview');
                box.classList.remove('hidden');
                box.innerHTML = `
                    <div class="flex justify-between"><span>Tipo de contrato:</span><strong>${d.tipoCobro}</strong></div>
                    <div class="flex justify-between"><span>Total horas:</span><strong>${d.totalHoras} h</strong></div>
                    ${d.tipoCobro === 'POR_HORAS' ? `
                    <div class="flex justify-between"><span>Horas normales:</span><strong>${d.horasNormales} h</strong></div>
                    <div class="flex justify-between"><span>Horas extra:</span><strong>${d.horasExtra} h</strong></div>
                    ` : ''}
                    <div class="flex justify-between border-t pt-2 mt-2 text-base"><span class="font-bold">Total a cobrar:</span><strong class="text-indigo-700 dark:text-indigo-300">${COP(d.totalCobro)}</strong></div>
                `;
                showToast('✅ Cálculo listo');
            } else {
                showToast(`❌ ${res.message}`);
            }
        } catch (err) {
            showToast('❌ Error de conexión');
        }
    });

    $('#cierre-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const empresaId = $('#cierre-empresa-id').value;
        const desde = $('#cierre-desde').value;
        const hasta = $('#cierre-hasta').value;
        const empresaName = contratoState.empresaActual?.name || '';
        try {
            showToast('⏳ Guardando cierre...');
            const res = await apiPost({ action: 'save_cierre', empresaId, desde, hasta, nombreEmpresa: empresaName });
            if (res.status === 'success') {
                showToast(`✅ Cierre guardado · ${COP(res.data.totalCobro)}`);
                cerrarModalCierre();
                cargarPanelContrato(contratoState.empresaActual);
            } else {
                showToast(`❌ ${res.message}`);
            }
        } catch (err) {
            showToast('❌ Error de conexión');
        }
    });

    // ── MODAL PDF ──────────────────────────────────────────────

    async function mostrarPDF(cierre, empresaNombre, empresaId) {
        // Cargar servicios del período para el detalle
        let servicios = [];
        try {
            const url = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_servicios&empresaId=${empresaId}&desde=${cierre.Desde}&hasta=${cierre.Hasta}`;
            const res = await (await fetch(url)).json();
            servicios = res.data?.servicios || [];
        } catch (e) { }

        const filas = servicios.map(s =>
            `<tr><td class="border p-2">${s.Fecha}</td><td class="border p-2">${s.Descripcion}</td><td class="border p-2 text-right">${s.Horas} h</td></tr>`
        ).join('') || '<tr><td colspan="3" class="border p-2 text-center text-gray-400">Sin servicios en este período</td></tr>';

        const tipoCobro = cierre.TipoCobro || (parseFloat(cierre.TotalHoras) > 0 ? 'POR_HORAS' : 'FIJO');
        const resumen = tipoCobro === 'POR_HORAS' ? `
            <tr><td class="font-semibold p-1">Horas normales:</td><td class="p-1 text-right">${cierre.HorasNormales || 0} h</td></tr>
            <tr><td class="font-semibold p-1">Horas extra:</td><td class="p-1 text-right">${cierre.HorasExtra || 0} h</td></tr>
        ` : '';

        $('#pdf-contenido').innerHTML = `
            <div id="pdf-print-area" style="font-family: sans-serif;">
                <div style="text-align:center; margin-bottom:16px;">
                    <h1 style="font-size:1.5rem; font-weight:bold; color:#4338CA;">REPORTE QUINCENAL DE SERVICIOS</h1>
                    <p style="color:#6b7280;">TimeBill Pro · TechFix Solutions</p>
                </div>
                <hr style="margin-bottom:12px;">
                <table style="width:100%; margin-bottom:16px;">
                    <tr><td><strong>Empresa:</strong> ${empresaNombre}</td><td style="text-align:right;"><strong>Período:</strong> ${cierre.Desde} al ${cierre.Hasta}</td></tr>
                    <tr><td><strong>Tipo de contrato:</strong> ${cierre.TipoCobro}</td><td style="text-align:right;"><strong>Estado:</strong> ${cierre.Estado}</td></tr>
                </table>
                <h3 style="font-weight:bold; margin-bottom:8px;">Servicios Reportados</h3>
                <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:0.9rem;">
                    <thead><tr style="background:#4338CA; color:white;">
                        <th class="border p-2 text-left">Fecha</th>
                        <th class="border p-2 text-left">Descripción</th>
                        <th class="border p-2 text-right">Horas</th>
                    </tr></thead>
                    <tbody>${filas}</tbody>
                </table>
                <h3 style="font-weight:bold; margin-bottom:8px;">Resumen de Cobro</h3>
                <table style="width:50%; margin-left:auto; border-collapse:collapse; font-size:0.95rem;">
                    <tr><td class="font-semibold p-1">Total horas:</td><td class="p-1 text-right">${cierre.TotalHoras || 0} h</td></tr>
                    ${resumen}
                    <tr style="border-top: 2px solid #4338CA; font-size:1.1rem;">
                        <td class="font-bold p-1">TOTAL A COBRAR:</td>
                        <td class="font-bold p-1 text-right" style="color:#4338CA;">${COP(cierre.TotalCobro || 0)}</td>
                    </tr>
                </table>
                <p style="margin-top:32px; font-size:0.75rem; color:#9ca3af; text-align:center;">
                    Generado por TimeBill Pro · ${new Date().toLocaleDateString('es-CO')}
                </p>
            </div>
        `;

        const modal = $('#pdf-modal');
        modal.classList.remove('hidden');
    }

    $('#close-pdf-modal')?.addEventListener('click', () => $('#pdf-modal').classList.add('hidden'));
    $('#btn-imprimir-pdf')?.addEventListener('click', () => window.print());

    // ── PÁGINA REPORTE DE HORAS ────────────────────────────────

    // Precargar fecha de hoy en el form de reporte
    const hoyISO = new Date().toISOString().split('T')[0];
    if ($('#reporte-fecha')) $('#reporte-fecha').value = hoyISO;

    $('#reporte-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const empresaId = $('#reporte-empresa').value;
        const fecha = $('#reporte-fecha').value;
        const horas = $('#reporte-horas').value;
        const descripcion = $('#reporte-descripcion').value;

        if (!empresaId) { showToast('⚠️ Selecciona una empresa'); return; }

        try {
            showToast('⏳ Guardando servicio...');
            const res = await apiPost({ action: 'save_servicio', empresaId, fecha, horas, descripcion });
            if (res.status === 'success') {
                showToast('✅ Servicio registrado');
                $('#reporte-form').reset();
                $('#reporte-fecha').value = hoyISO;
                cargarServiciosTabla();
            } else {
                showToast(`❌ ${res.message}`);
            }
        } catch (err) {
            showToast('❌ Error de conexión');
        }
    });

    async function cargarServiciosTabla() {
        const empresaId = $('#filtro-servicio-empresa').value;
        const desde = $('#filtro-servicio-desde').value;
        const hasta = $('#filtro-servicio-hasta').value;

        let url = `${GOOGLE_SHEETS_CONFIG.appScriptUrl}?action=get_servicios`;
        if (empresaId) url += `&empresaId=${empresaId}`;
        if (desde) url += `&desde=${desde}`;
        if (hasta) url += `&hasta=${hasta}`;

        try {
            const res = await (await fetch(url)).json();
            const servicios = res.data?.servicios || [];
            renderTablaServicios(servicios);
        } catch (e) {
            renderTablaServicios([]);
        }
    }

    function renderTablaServicios(servicios) {
        const tbody = $('#servicios-table-body');
        const noMsg = $('#no-servicios-msg');
        tbody.innerHTML = '';

        if (!servicios.length) {
            noMsg.classList.remove('hidden');
            return;
        }
        noMsg.classList.add('hidden');

        servicios.forEach(s => {
            // Nombre de empresa desde appState
            const client = appState.clients.find(c => String(c.id) === String(s.EmpresaID)) || { name: s.EmpresaID };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-medium">${client.name}</td>
                <td class="p-3">${s.Fecha}</td>
                <td class="p-3 text-gray-600 dark:text-zinc-300">${s.Descripcion}</td>
                <td class="p-3 text-right font-bold">${s.Horas} h</td>
                <td class="p-3 text-center">
                    <button class="eliminar-servicio-btn text-red-500 hover:text-red-700 text-sm" data-id="${s.ID}">🗑 Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.addEventListener('click', async e => {
            if (e.target.classList.contains('eliminar-servicio-btn')) {
                if (!confirm('¿Eliminar este servicio?')) return;
                const id = e.target.dataset.id;
                const res = await apiPost({ action: 'delete_servicio', id });
                if (res.status === 'success') {
                    showToast('✅ Servicio eliminado');
                    cargarServiciosTabla();
                } else {
                    showToast(`❌ ${res.message}`);
                }
            }
        });
    }

    $('#btn-filtrar-servicios')?.addEventListener('click', cargarServiciosTabla);

    // ── Extensión de switchView para el módulo de contratos ────
    // Interceptamos el evento de navegación mediante el listener preexistente
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            const viewId = e.currentTarget.getAttribute('href')?.substring(1);
            if (viewId === 'reporte') {
                setTimeout(() => { poblarSelectsEmpresas(); cargarServiciosTabla(); }, 50);
            }
            if (viewId === 'contratos') {
                setTimeout(() => poblarSelectsEmpresas(), 50);
            }
        });
    });

    // ── Utilidad POST ──────────────────────────────────────────
    async function apiPost(payload) {
        const res = await fetch(GOOGLE_SHEETS_CONFIG.appScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return res.json();
    }

    // Cargar clientes al inicio: la función original ya existe.
    // Este módulo se enlaza al evento de carga principal mediante el
    // bloque de loadClientsFromGoogleSheets ya llamado en init().
    // poblarSelectsEmpresas() se llama explícitamente tras renderClients().

}); // fin DOMContentLoaded

