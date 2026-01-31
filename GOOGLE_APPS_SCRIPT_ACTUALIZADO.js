/**
 * ============================================================
 * GOOGLE APPS SCRIPT - TimeBill Pro v2.1
 * Maneja sesiones, clientes y gestión de usuarios con roles
 * ============================================================
 */

// IDs de configuración
const SPREADSHEET_ID = "TU_ID_DE_SPREADSHEET_AQUÍ";
const SHEET_SESIONES = "Sesiones";
const SHEET_CLIENTES = "Clientes";
const SHEET_CONFIG = "Configuración";
const SHEET_USUARIOS = "Usuarios"; // Hoja para usuarios

// Encabezados esperados para cada hoja
const HEADERS_SESIONES = ["ID", "Fecha", "Hora Inicio", "Hora Fin", "Cliente", "Email Cliente", "Duración (horas)", "Valor/Hora ($)", "Total ($)", "Estado"];
const HEADERS_CLIENTES = ["ID", "Nombre", "Email", "Teléfono", "Dirección", "Fecha Creación", "Estado"];
const HEADERS_CONFIG = ["Parámetro", "Valor", "Tipo", "Descripción"];
// Se agrega "Rol" a los encabezados de usuarios
const HEADERS_USUARIOS = ["ID", "Email", "Contraseña (Hash)", "Nombre", "Rol", "Fecha Registro", "Gmail_SenderEmail", "Gmail_AppPassword", "Estado"];

/**
 * Helper para obtener el spreadsheet activo o por ID
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    console.warn("No active spreadsheet found, trying by ID");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * ============================================================
 * FUNCIONES PRINCIPALES (POST/GET)
 * ============================================================
 */

/**
 * Punto de entrada para POST (guardar sesiones, clientes, usuarios)
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return errorResponse('No se recibieron datos (postData vacío)');
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return errorResponse('Error al parsear JSON: ' + parseError.toString());
    }

    const action = payload.action;

    switch (action) {
      case 'login':
        return loginUser(payload);
      case 'register':
        return registerUser(payload);
      case 'create_user':
        return createUserAdmin(payload);
      case 'get_users':
        return getUsersList(payload);
      case 'delete_user':
        return deleteUser(payload);
      case 'save_config':
        return saveUserConfig(payload);
      case 'get_config':
        return getUserConfig(payload);
      case 'send_email':
        return sendEmailViaSmtp(payload);
      case 'initialize':
        return initializeDatabase();
      case 'save_session':
        return saveSession(payload);
      case 'add_client':
        return addClient(payload);
      case 'update_client':
        return updateClient(payload);
      case 'delete_client':
        return deleteClient(payload);
      default:
        return errorResponse('Acción no reconocida: ' + action);
    }
  } catch (error) {
    return errorResponse('Error en doPost: ' + error.toString());
  }
}

/**
 * Punto de entrada para GET
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'get_clients') {
      return getClients();
    } else if (action === 'get_sessions') {
      return getSessions();
    } else if (action === 'check_initialization') {
      return checkInitialization();
    } else {
      return errorResponse('Acción no reconocida');
    }
  } catch (error) {
    return errorResponse(error.toString());
  }
}

/**
 * ============================================================
 * FUNCIONES DE AUTENTICACIÓN Y USUARIOS
 * ============================================================
 */

function hashPassword(password) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));
}

/**
 * Registro público de usuario (self-service)
 */
function registerUser(payload) {
  try {
    if (!payload.email || !payload.password || !payload.nombre) {
      return errorResponse('Faltan datos requeridos: email, password, nombre');
    }

    const spreadsheet = getSpreadsheet();
    let usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    // Crear hoja si no existe e inicializar
    if (!usuariosSheet) {
      initializeDatabase(); // Asegura que todo esté creado
      usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);
    }

    const data = usuariosSheet.getDataRange().getValues();

    // Verificar duplicados
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email) {
        return errorResponse('El email ya está registrado');
      }
    }

    // Determinar ID y Rol
    // Si es el primer usuario, lo hacemos Admin. Si no, Usuario estándar.
    const isFirstUser = data.length <= 1;
    const role = isFirstUser ? 'Admin' : 'Usuario';
    const nextId = usuariosSheet.getLastRow();
    const fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const passwordHash = hashPassword(payload.password);

    const newUser = [
      nextId,
      payload.email,
      passwordHash,
      payload.nombre,
      role,
      fechaRegistro,
      '', // Gmail_SenderEmail
      '', // Gmail_AppPassword
      'activo'
    ];

    usuariosSheet.appendRow(newUser);

    return successResponse('Usuario registrado correctamente', {
      id: nextId,
      email: payload.email,
      nombre: payload.nombre,
      role: role
    });
  } catch (error) {
    return errorResponse('Error al registrar usuario: ' + error.toString());
  }
}

/**
 * Creación administrativa de usuarios (permite definir rol)
 */
function createUserAdmin(payload) {
  try {
    if (!payload.email || !payload.password || !payload.nombre || !payload.role) {
      return errorResponse('Faltan datos requeridos');
    }

    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    const data = usuariosSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email) {
        return errorResponse('El email ya existe');
      }
    }

    const nextId = usuariosSheet.getLastRow();
    const fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const passwordHash = hashPassword(payload.password);

    const newUser = [
      nextId,
      payload.email,
      passwordHash,
      payload.nombre,
      payload.role,
      fechaRegistro,
      '',
      '',
      'activo'
    ];

    usuariosSheet.appendRow(newUser);

    return successResponse('Usuario creado correctamente', {
      id: nextId,
      nombre: payload.nombre,
      role: payload.role
    });

  } catch (error) {
    return errorResponse('Error al crear usuario: ' + error.toString());
  }
}

/**
 * Obtener lista de usuarios
 */
function getUsersList(payload) {
  try {
    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    if (!usuariosSheet) return successResponse('No hay usuarios', { users: [] });

    const data = usuariosSheet.getDataRange().getValues();
    const users = [];

    for (let i = 1; i < data.length; i++) {
      users.push({
        id: data[i][0],
        email: data[i][1],
        nombre: data[i][3],
        role: data[i][4],
        fecha: data[i][5],
        estado: data[i][8]
      });
    }

    return successResponse('Usuarios obtenidos', { users: users });
  } catch (error) {
    return errorResponse('Error al obtener usuarios: ' + error.toString());
  }
}

/**
 * Eliminar usuario (Admin)
 */
function deleteUser(payload) {
  try {
    if (!payload.id) return errorResponse('ID requerido');

    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);
    const data = usuariosSheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return errorResponse('Usuario no encontrado');

    usuariosSheet.deleteRow(rowIndex);
    return successResponse('Usuario eliminado');

  } catch (error) {
    return errorResponse('Error al eliminar: ' + error.toString());
  }
}


function loginUser(payload) {
  try {
    if (!payload.email || !payload.password) {
      return errorResponse('Email y contraseña requeridos');
    }

    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    if (!usuariosSheet) {
      return errorResponse('No hay usuarios registrados.');
    }

    const data = usuariosSheet.getDataRange().getValues();
    const passwordHash = hashPassword(payload.password);

    for (let i = 1; i < data.length; i++) {
      const email = data[i][1];
      const storedHash = data[i][2];
      const nombre = data[i][3];
      const userId = data[i][0];
      const rol = data[i].length > 4 ? data[i][4] : 'Usuario';

      if (email === payload.email && storedHash === passwordHash) {
        return successResponse('Login exitoso', {
          id: userId,
          email: email,
          nombre: nombre,
          role: rol,
          config: {
            gmailSenderEmail: data[i][6] || '',
            gmailAppPassword: data[i][7] || ''
          }
        });
      }
    }

    return errorResponse('Email o contraseña incorrectos');
  } catch (error) {
    return errorResponse('Error al autenticar: ' + error.toString());
  }
}

function saveUserConfig(payload) {
  try {
    if (!payload.email || !payload.password) {
      return errorResponse('Credenciales requeridas');
    }

    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    if (!usuariosSheet) return errorResponse('Error de base de datos');

    const data = usuariosSheet.getDataRange().getValues();
    const passwordHash = hashPassword(payload.password);
    let userRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email && data[i][2] === passwordHash) {
        userRowIndex = i + 1;
        break;
      }
    }

    if (userRowIndex === -1) return errorResponse('Credenciales inválidas');

    if (payload.gmailSenderEmail) usuariosSheet.getRange(userRowIndex, 7).setValue(payload.gmailSenderEmail);
    if (payload.gmailAppPassword) usuariosSheet.getRange(userRowIndex, 8).setValue(payload.gmailAppPassword);

    return successResponse('Configuración guardada');
  } catch (error) {
    return errorResponse('Error: ' + error.toString());
  }
}

function getUserConfig(payload) {
  return errorResponse("Función no implementada");
}


function sendEmailViaSmtp(payload) {
  try {
    if (!payload.to || !payload.subject || !payload.body) return errorResponse('Faltan datos de correo');

    let sender = payload.senderEmail || Session.getActiveUser().getEmail();

    MailApp.sendEmail(payload.to, payload.subject, payload.body, {
      from: sender,
      replyTo: sender
    });
    return successResponse('Correo enviado');
  } catch (e) { return errorResponse(e.toString()); }
}


function initializeDatabase() {
  try {
    const spreadsheet = getSpreadsheet();
    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(s => s.getName());

    const sheetsToCreate = [
      { name: SHEET_USUARIOS, headers: HEADERS_USUARIOS },
      { name: SHEET_SESIONES, headers: HEADERS_SESIONES },
      { name: SHEET_CLIENTES, headers: HEADERS_CLIENTES },
      { name: SHEET_CONFIG, headers: HEADERS_CONFIG }
    ];

    const createdSheets = [];

    for (let sheetConfig of sheetsToCreate) {
      let sheet;
      if (!sheetNames.includes(sheetConfig.name)) {
        sheet = spreadsheet.insertSheet(sheetConfig.name);
        sheet.appendRow(sheetConfig.headers);
        createdSheets.push(sheetConfig.name);
      } else {
        sheet = spreadsheet.getSheetByName(sheetConfig.name);
      }

      if (sheet) {
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#4338CA');
        headerRange.setFontColor('white');
      }
    }

    // Default Config
    const configSheet = spreadsheet.getSheetByName(SHEET_CONFIG);
    if (configSheet && configSheet.getLastRow() <= 1) {
      configSheet.appendRow(['empresa_nombre', 'TimeBill Pro', 'string', 'Nombre de la empresa']);
      configSheet.appendRow(['empresa_email', 'info@techfix.com', 'string', 'Email de contacto']);
    }

    // Default Admin User
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);
    if (usuariosSheet && usuariosSheet.getLastRow() <= 1) {
      const defaultAdmin = [
        1,
        "admin@techfix.com",
        hashPassword("admin"),
        "Administrador",
        "Admin",
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
        "",
        "",
        "activo"
      ];
      usuariosSheet.appendRow(defaultAdmin);
      createdSheets.push("Usuario Admin por defecto");
    }

    return successResponse('Base de datos inicializada/verificada', { created: createdSheets });
  } catch (error) {
    return errorResponse('Error init: ' + error.toString());
  }
}

function saveSession(payload) {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_SESIONES);
    const nextId = sheet.getLastRow();
    sheet.appendRow([
      nextId,
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      payload.hora_inicio || "00:00",
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm"),
      payload.cliente, payload.email, payload.duracion, payload.valor_hora,
      (payload.duracion * payload.valor_hora).toFixed(2), "Completado"
    ]);
    return successResponse('Sesión guardada', { id: nextId });
  } catch (e) { return errorResponse(e.toString()); }
}

function getSessions() {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_SESIONES);
    const data = sheet.getDataRange().getValues();
    return successResponse('Sesiones', { sessions: [] });
  } catch (e) { return errorResponse(e.toString()); }
}

function addClient(payload) {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_CLIENTES);
    const nextId = sheet.getLastRow();
    sheet.appendRow([nextId, payload.name, payload.email, payload.phone, payload.address, new Date(), "Activo"]);
    return successResponse('Cliente creado', { id: nextId, name: payload.name });
  } catch (e) { return errorResponse(e.toString()); }
}

function updateClient(payload) {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_CLIENTES);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) {
        sheet.getRange(i + 1, 2).setValue(payload.name);
        sheet.getRange(i + 1, 3).setValue(payload.email);
        sheet.getRange(i + 1, 4).setValue(payload.phone);
        sheet.getRange(i + 1, 5).setValue(payload.address);
        return successResponse('Actualizado');
      }
    }
    return errorResponse('No encontrado');
  } catch (e) { return errorResponse(e.toString()); }
}

function deleteClient(payload) {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_CLIENTES);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) {
        sheet.deleteRow(i + 1);
        return successResponse('Eliminado');
      }
    }
    return errorResponse('No encontrado');
  } catch (e) { return errorResponse(e.toString()); }
}

function getClients() {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_CLIENTES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const clients = [];

    for (let i = 1; i < data.length; i++) {
      const client = {};
      for (let j = 0; j < headers.length; j++) {
        client[headers[j]] = data[i][j];
      }
      clients.push(client);
    }
    return successResponse('Clientes obtenidos', { clients: clients });
  } catch (error) {
    return errorResponse('Error al obtener clientes: ' + error.toString());
  }
}

function checkInitialization() {
  try {
    const spreadsheet = getSpreadsheet();
    const sheets = spreadsheet.getSheets().map(s => s.getName());
    const isInit = sheets.includes(SHEET_USUARIOS) && sheets.includes(SHEET_CLIENTES);
    return successResponse('Check', { initialized: isInit });
  } catch (e) { return errorResponse(e.toString()); }
}


// Utilidades de respuesta
function successResponse(msg, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: msg, data: data })).setMimeType(ContentService.MimeType.JSON);
}
function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: msg })).setMimeType(ContentService.MimeType.JSON);
}
