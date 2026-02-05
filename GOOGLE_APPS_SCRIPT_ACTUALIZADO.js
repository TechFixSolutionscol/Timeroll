/**
 * ============================================================
 * GOOGLE APPS SCRIPT - TimeBill Pro v2.2
 * Maneja sesiones, clientes y gestión de usuarios con roles y seguridad
 * ============================================================
 */

// IDs de configuración
const SPREADSHEET_ID = "tu_id_de_spreadsheet_aqui";
const SHEET_SESIONES = "Sesiones";
const SHEET_CLIENTES = "Clientes";
const SHEET_CONFIG = "Configuración";
const SHEET_USUARIOS = "Usuarios";

// Encabezados esperados para cada hoja
const HEADERS_SESIONES = ["ID", "Fecha", "Hora Inicio", "Hora Fin", "Cliente", "Email Cliente", "Duración (horas)", "Valor/Hora ($)", "Total ($)", "Estado"];
const HEADERS_CLIENTES = ["ID", "Nombre", "Email", "Teléfono", "Dirección", "Fecha Creación", "Estado"];
const HEADERS_CONFIG = ["Parámetro", "Valor", "Tipo", "Descripción"];
// Se incluye "Salt" para mejorar la seguridad de las contraseñas
const HEADERS_USUARIOS = ["ID", "Email", "Contraseña (Hash)", "Salt", "Nombre", "Rol", "Fecha Registro", "Gmail_SenderEmail", "Gmail_AppPassword", "Estado"];

/**
 * ============================================================
 * CONFIGURACIÓN Y MENÚ
 * ============================================================
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 TimeBill Pro')
      .addItem('Inicializar Base de Datos', 'initializeDatabase')
      .addSeparator()
      .addItem('Configurar Script', 'showConfigInfo')
      .addToUi();
}

function showConfigInfo() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Configuración', 'Asegúrate de haber publicado este script como Aplicación Web con acceso para "Cualquiera".\n\nID de la Hoja actual: ' + SpreadsheetApp.getActiveSpreadsheet().getId(), ui.ButtonSet.OK);
}

/**
 * Helper para obtener el Spreadsheet (por ID o Activo)
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "tu_id_de_spreadsheet_aqui" && SPREADSHEET_ID.length > 5) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      return SpreadsheetApp.getActiveSpreadsheet();
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ============================================================
 * FUNCIONES PRINCIPALES (POST/GET)
 * ============================================================
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
 * SEGURIDAD Y USUARIOS
 * ============================================================
 */

function generateSalt(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let retVal = '';
  for (let i = 0; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return retVal;
}

function hashPassword(password, salt) {
  const combined = password + salt;
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined));
}

function registerUser(payload) {
  try {
    if (!payload.email || !payload.password || !payload.nombre) {
      return errorResponse('Faltan datos requeridos: email, password, nombre');
    }

    const spreadsheet = getSpreadsheet();
    let usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    if (!usuariosSheet) {
      initializeDatabase();
      usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);
    }

    const data = usuariosSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email) {
        return errorResponse('El email ya está registrado');
      }
    }

    const isFirstUser = data.length <= 1;
    const role = isFirstUser ? 'Admin' : 'Usuario';
    const nextId = usuariosSheet.getLastRow();
    const salt = generateSalt();
    const passwordHash = hashPassword(payload.password, salt);
    const fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    const newUser = [
      nextId,
      payload.email,
      passwordHash,
      salt,
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
    const salt = generateSalt();
    const passwordHash = hashPassword(payload.password, salt);
    const fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    const newUser = [
      nextId,
      payload.email,
      passwordHash,
      salt,
      payload.nombre,
      payload.role,
      fechaRegistro,
      '',
      '',
      'activo'
    ];

    usuariosSheet.appendRow(newUser);
    return successResponse('Usuario creado correctamente', { id: nextId, nombre: payload.nombre, role: payload.role });

  } catch (error) {
    return errorResponse('Error al crear usuario: ' + error.toString());
  }
}

function loginUser(payload) {
  try {
    if (!payload.email || !payload.password) {
      return errorResponse('Email y contraseña requeridos');
    }

    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);

    if (!usuariosSheet) return errorResponse('No hay usuarios registrados.');

    const data = usuariosSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const email = data[i][1];
      const storedHash = data[i][2];
      const salt = data[i][3];
      const nombre = data[i][4];
      const userId = data[i][0];
      const rol = data[i][5] || 'Usuario';

      if (email === payload.email) {
        const hashToVerify = hashPassword(payload.password, salt);
        if (storedHash === hashToVerify) {
          return successResponse('Login exitoso', {
            id: userId,
            email: email,
            nombre: nombre,
            role: rol,
            config: {
              gmailSenderEmail: data[i][7] || '',
              gmailAppPassword: data[i][8] || ''
            }
          });
        }
      }
    }

    return errorResponse('Email o contraseña incorrectos');
  } catch (error) {
    return errorResponse('Error al autenticar: ' + error.toString());
  }
}

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
        nombre: data[i][4],
        role: data[i][5],
        fecha: data[i][6],
        estado: data[i][9]
      });
    }

    return successResponse('Usuarios obtenidos', { users: users });
  } catch (error) {
    return errorResponse('Error al obtener usuarios: ' + error.toString());
  }
}

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

function saveUserConfig(payload) {
  try {
    if (!payload.email) return errorResponse('Email requerido');

    const spreadsheet = getSpreadsheet();
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);
    if (!usuariosSheet) return errorResponse('Error de base de datos');

    const data = usuariosSheet.getDataRange().getValues();
    let userRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email) {
        userRowIndex = i + 1;
        break;
      }
    }

    if (userRowIndex === -1) return errorResponse('Usuario no encontrado');

    if (payload.gmailSenderEmail) usuariosSheet.getRange(userRowIndex, 8).setValue(payload.gmailSenderEmail);
    if (payload.gmailAppPassword) usuariosSheet.getRange(userRowIndex, 9).setValue(payload.gmailAppPassword);

    return successResponse('Configuración guardada');
  } catch (error) {
    return errorResponse('Error: ' + error.toString());
  }
}

/**
 * ============================================================
 * INICIALIZACIÓN Y GESTIÓN DE DATOS
 * ============================================================
 */

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

    // Config por defecto
    const configSheet = spreadsheet.getSheetByName(SHEET_CONFIG);
    if (configSheet && configSheet.getLastRow() <= 1) {
      configSheet.appendRow(['empresa_nombre', 'TimeBill Pro', 'string', 'Nombre de la empresa']);
      configSheet.appendRow(['empresa_email', 'info@techfix.com', 'string', 'Email de contacto']);
    }

    // Crear usuario admin por defecto si no hay ninguno
    const usuariosSheet = spreadsheet.getSheetByName(SHEET_USUARIOS);
    if (usuariosSheet && usuariosSheet.getLastRow() <= 1) {
      const salt = generateSalt();
      const passHash = hashPassword('admin', salt);
      const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      usuariosSheet.appendRow([1, 'admin@techfix.com', passHash, salt, 'Administrador', 'Admin', fecha, '', '', 'activo']);
      createdSheets.push('Usuario Admin por defecto creado');
    }

    return successResponse('Base de datos inicializada correctamente', { created: createdSheets });
  } catch (error) {
    return errorResponse('Error init: ' + error.toString());
  }
}

function saveSession(payload) {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_SESIONES);
    const nextId = sheet.getLastRow();
    sheet.appendRow([
      nextId,
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      payload.hora_inicio || "00:00",
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm"),
      payload.cliente, payload.email, payload.duracion, payload.valor_hora,
      (payload.duracion * payload.valor_hora).toFixed(2), "Completado"
    ]);
    return successResponse('Sesión guardada', { id: nextId, total: (payload.duracion * payload.valor_hora).toFixed(2) });
  } catch (e) { return errorResponse(e.toString()); }
}

function getSessions() {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_SESIONES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const sessions = [];

    for (let i = 1; i < data.length; i++) {
      const session = {};
      for (let j = 0; j < headers.length; j++) {
        session[headers[j]] = data[i][j];
      }
      sessions.push(session);
    }
    return successResponse('Sesiones', { sessions: sessions });
  } catch (e) { return errorResponse(e.toString()); }
}

function addClient(payload) {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_CLIENTES);
    const nextId = sheet.getLastRow();
    sheet.appendRow([nextId, payload.name, payload.email, payload.phone, payload.address, new Date(), "Activo"]);
    return successResponse('Cliente creado', { id: nextId, name: payload.name });
  } catch (e) { return errorResponse(e.toString()); }
}

function updateClient(payload) {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_CLIENTES);
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
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_CLIENTES);
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
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_CLIENTES);
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

function successResponse(msg, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: msg, data: data })).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: msg })).setMimeType(ContentService.MimeType.JSON);
}
