/**
 * ============================================================
 * GOOGLE APPS SCRIPT - TimeBill Pro v3.0
 * Módulos: Sesiones, Clientes, Usuarios, Contratos, Horas, Cierres
 * ============================================================
 */

// ── Hojas existentes ──────────────────────────────────────────
const SPREADSHEET_ID = "tu_id_de_spreadsheet_aqui";
const SHEET_SESIONES = "Sesiones";
const SHEET_CLIENTES = "Clientes";
const SHEET_CONFIG = "Configuración";
const SHEET_USUARIOS = "Usuarios";

// ── Nuevas hojas ─────────────────────────────────────────────
const SHEET_EMP_CONFIG = "Empresa_Config";
const SHEET_SERVICIOS = "Servicios_Reportados";
const SHEET_CIERRES = "Cierres_Quincenales";

// ── Headers existentes ────────────────────────────────────────
const HEADERS_SESIONES = ["ID", "Fecha", "Hora Inicio", "Hora Fin", "Cliente", "Email Cliente", "Duración (horas)", "Valor/Hora ($)", "Total ($)", "Estado"];
const HEADERS_CLIENTES = ["ID", "Nombre", "Email", "Teléfono", "Dirección", "Fecha Creación", "Estado"];
const HEADERS_CONFIG = ["Parámetro", "Valor", "Tipo", "Descripción"];
const HEADERS_USUARIOS = ["ID", "Email", "Contraseña (Hash)", "Nombre", "Rol", "Fecha Registro", "Gmail_SenderEmail", "Gmail_AppPassword", "Estado"];

// ── Headers nuevos ────────────────────────────────────────────
const HEADERS_EMP_CONFIG = [
  "ID", "EmpresaID", "VigenteDesde", "VigenteHasta", "TipoCobro",
  "ValorFijoQuincenal", "HorasIncluidas", "ValorHora", "ValorHoraExtra",
  "Estado", "Observaciones"
];
const HEADERS_SERVICIOS = ["ID", "EmpresaID", "ConfigID", "Fecha", "Descripcion", "Horas"];
const HEADERS_CIERRES = [
  "ID", "EmpresaID", "ConfigID", "Desde", "Hasta",
  "TotalHoras", "HorasNormales", "HorasExtra", "TotalCobro",
  "Estado", "FechaCierre", "NombreEmpresa", "TipoCobro"
];

// ─────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA POST
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents)
      return errorResponse('No se recibieron datos');

    let payload;
    try { payload = JSON.parse(e.postData.contents); }
    catch (err) { return errorResponse('JSON inválido: ' + err); }

    const action = payload.action;

    switch (action) {
      // Auth & usuarios
      case 'login': return loginUser(payload);
      case 'register': return registerUser(payload);
      case 'create_user': return createUserAdmin(payload);
      case 'get_users': return getUsersList(payload);
      case 'delete_user': return deleteUser(payload);
      case 'save_config': return saveUserConfig(payload);
      case 'get_config': return getUserConfig(payload);
      case 'send_email': return sendEmailViaSmtp(payload);
      case 'initialize': return initializeDatabase();
      // Sesiones
      case 'save_session': return saveSession(payload);
      // Clientes
      case 'add_client': return addClient(payload);
      case 'update_client': return updateClient(payload);
      case 'delete_client': return deleteClient(payload);
      // ── Contratos ──
      case 'save_empresa_config': return saveEmpresaConfig(payload);
      // ── Servicios ──
      case 'save_servicio': return saveServicioReportado(payload);
      case 'delete_servicio': return deleteServicioReportado(payload);
      // ── Cierres ──
      case 'save_cierre': return saveCierreQuincenal(payload);
      case 'cerrar_cierre': return cerrarCierreQuincenal(payload);
      case 'calcular_cierre': return calcularCierre(payload);

      default: return errorResponse('Acción no reconocida: ' + action);
    }
  } catch (error) {
    return errorResponse('Error en doPost: ' + error.toString());
  }
}

// ─────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA GET
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'get_clients': return getClients();
      case 'get_sessions': return getSessions();
      case 'check_initialization': return checkInitialization();
      // ── Contratos ──
      case 'get_empresa_config': return getEmpresaConfig(e);
      case 'get_empresa_config_history': return getEmpresaConfigHistory(e);
      // ── Servicios ──
      case 'get_servicios': return getServiciosReportados(e);
      // ── Cierres ──
      case 'get_cierres': return getCierresQuincenales(e);
      default: return errorResponse('Acción no reconocida');
    }
  } catch (error) {
    return errorResponse(error.toString());
  }
}

// ─────────────────────────────────────────────────────────────
// AUTENTICACIÓN Y USUARIOS  (sin cambios)
// ─────────────────────────────────────────────────────────────
function hashPassword(password) {
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
  );
}

function registerUser(payload) {
  try {
    if (!payload.email || !payload.password || !payload.nombre)
      return errorResponse('Faltan datos: email, password, nombre');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_USUARIOS);
    if (!sheet) { initializeDatabase(); sheet = ss.getSheetByName(SHEET_USUARIOS); }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email) return errorResponse('El email ya está registrado');
    }
    const isFirst = data.length <= 1;
    const role = isFirst ? 'Admin' : 'Usuario';
    const nextId = sheet.getLastRow();
    const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([nextId, payload.email, hashPassword(payload.password), payload.nombre, role, fecha, '', '', 'activo']);
    return successResponse('Usuario registrado', { id: nextId, email: payload.email, nombre: payload.nombre, role });
  } catch (err) { return errorResponse('Error al registrar: ' + err); }
}

function createUserAdmin(payload) {
  try {
    if (!payload.email || !payload.password || !payload.nombre || !payload.role)
      return errorResponse('Faltan datos requeridos');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USUARIOS);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email) return errorResponse('El email ya existe');
    }
    const nextId = sheet.getLastRow();
    const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([nextId, payload.email, hashPassword(payload.password), payload.nombre, payload.role, fecha, '', '', 'activo']);
    return successResponse('Usuario creado', { id: nextId, nombre: payload.nombre, role: payload.role });
  } catch (err) { return errorResponse('Error al crear usuario: ' + err); }
}

function getUsersList(payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USUARIOS);
    if (!sheet) return successResponse('Sin usuarios', { users: [] });

    const data = sheet.getDataRange().getValues();
    const users = [];
    for (let i = 1; i < data.length; i++) {
      users.push({ id: data[i][0], email: data[i][1], nombre: data[i][3], role: data[i][4], fecha: data[i][5], estado: data[i][8] });
    }
    return successResponse('Usuarios obtenidos', { users });
  } catch (err) { return errorResponse('Error: ' + err); }
}

function deleteUser(payload) {
  try {
    if (!payload.id) return errorResponse('ID requerido');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USUARIOS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) { sheet.deleteRow(i + 1); return successResponse('Usuario eliminado'); }
    }
    return errorResponse('Usuario no encontrado');
  } catch (err) { return errorResponse('Error: ' + err); }
}

function loginUser(payload) {
  try {
    if (!payload.email || !payload.password) return errorResponse('Email y contraseña requeridos');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USUARIOS);
    if (!sheet) return errorResponse('No hay usuarios registrados.');

    const data = sheet.getDataRange().getValues();
    const hash = hashPassword(payload.password);

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email && data[i][2] === hash) {
        return successResponse('Login exitoso', {
          id: data[i][0], email: data[i][1], nombre: data[i][3],
          role: data[i].length > 4 ? data[i][4] : 'Usuario',
          config: { gmailSenderEmail: data[i][6] || '', gmailAppPassword: data[i][7] || '' }
        });
      }
    }
    return errorResponse('Email o contraseña incorrectos');
  } catch (err) { return errorResponse('Error al autenticar: ' + err); }
}

function saveUserConfig(payload) {
  try {
    if (!payload.email || !payload.password) return errorResponse('Credenciales requeridas');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USUARIOS);
    if (!sheet) return errorResponse('Error de base de datos');

    const data = sheet.getDataRange().getValues();
    const hash = hashPassword(payload.password);
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.email && data[i][2] === hash) {
        if (payload.gmailSenderEmail) sheet.getRange(i + 1, 7).setValue(payload.gmailSenderEmail);
        if (payload.gmailAppPassword) sheet.getRange(i + 1, 8).setValue(payload.gmailAppPassword);
        return successResponse('Configuración guardada');
      }
    }
    return errorResponse('Credenciales inválidas');
  } catch (err) { return errorResponse('Error: ' + err); }
}

function getUserConfig(payload) {
  return errorResponse('Use login para obtener la configuración inicial');
}

// ─────────────────────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────────────────────
function sendEmailViaSmtp(payload) {
  try {
    if (!payload.to || !payload.subject || !payload.body) return errorResponse('Faltan datos de correo');
    const sender = payload.senderEmail || Session.getActiveUser().getEmail();
    MailApp.sendEmail(payload.to, payload.subject, payload.body, { from: sender, replyTo: sender });
    return successResponse('Correo enviado');
  } catch (err) { return errorResponse(err.toString()); }
}

// ─────────────────────────────────────────────────────────────
// INICIALIZACIÓN DE BASE DE DATOS
// ─────────────────────────────────────────────────────────────
function initializeDatabase() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetNames = ss.getSheets().map(s => s.getName());

    const toCreate = [
      { name: SHEET_USUARIOS, headers: HEADERS_USUARIOS },
      { name: SHEET_SESIONES, headers: HEADERS_SESIONES },
      { name: SHEET_CLIENTES, headers: HEADERS_CLIENTES },
      { name: SHEET_CONFIG, headers: HEADERS_CONFIG },
      // ── Nuevas ──
      { name: SHEET_EMP_CONFIG, headers: HEADERS_EMP_CONFIG },
      { name: SHEET_SERVICIOS, headers: HEADERS_SERVICIOS },
      { name: SHEET_CIERRES, headers: HEADERS_CIERRES }
    ];

    const created = [];
    for (const cfg of toCreate) {
      let sheet;
      if (!sheetNames.includes(cfg.name)) {
        sheet = ss.insertSheet(cfg.name);
        sheet.appendRow(cfg.headers);
        created.push(cfg.name);
      } else {
        sheet = ss.getSheetByName(cfg.name);
      }
      // Estilo header
      const hr = sheet.getRange(1, 1, 1, sheet.getLastColumn());
      hr.setFontWeight('bold');
      hr.setBackground('#4338CA');
      hr.setFontColor('white');
    }

    // Config por defecto
    const cfgSheet = ss.getSheetByName(SHEET_CONFIG);
    if (cfgSheet && cfgSheet.getLastRow() <= 1) {
      cfgSheet.appendRow(['empresa_nombre', 'TimeBill Pro', 'string', 'Nombre de la empresa']);
      cfgSheet.appendRow(['empresa_email', 'info@techfix.com', 'string', 'Email de contacto']);
    }

    return successResponse('Base de datos inicializada/verificada', { created });
  } catch (err) { return errorResponse('Error init: ' + err); }
}

// ─────────────────────────────────────────────────────────────
// SESIONES Y CLIENTES  (sin cambios)
// ─────────────────────────────────────────────────────────────
function saveSession(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_SESIONES);
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
  } catch (err) { return errorResponse(err.toString()); }
}

function getSessions() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_SESIONES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const sessions = [];
    for (let i = 1; i < data.length; i++) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
      sessions.push(obj);
    }
    return successResponse('Sesiones', { sessions });
  } catch (err) { return errorResponse(err.toString()); }
}

function addClient(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_CLIENTES);
    const nextId = sheet.getLastRow();
    sheet.appendRow([nextId, payload.name, payload.email, payload.phone, payload.address, new Date(), "Activo"]);
    return successResponse('Cliente creado', { id: nextId, name: payload.name });
  } catch (err) { return errorResponse(err.toString()); }
}

function updateClient(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_CLIENTES);
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
  } catch (err) { return errorResponse(err.toString()); }
}

function deleteClient(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_CLIENTES);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) { sheet.deleteRow(i + 1); return successResponse('Eliminado'); }
    }
    return errorResponse('No encontrado');
  } catch (err) { return errorResponse(err.toString()); }
}

function getClients() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_CLIENTES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const clients = [];
    for (let i = 1; i < data.length; i++) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
      clients.push(obj);
    }
    return successResponse('Clientes obtenidos', { clients });
  } catch (err) { return errorResponse('Error al obtener clientes: ' + err); }
}

function checkInitialization() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const names = ss.getSheets().map(s => s.getName());
    const isInit = names.includes(SHEET_USUARIOS) && names.includes(SHEET_CLIENTES);
    return successResponse('Check', { initialized: isInit });
  } catch (err) { return errorResponse(err.toString()); }
}

// ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
// MÓDULO CONTRATOS
// ════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────

/**
 * Guarda una nueva configuración contractual para una empresa.
 * Cierra la configuración anterior (si existe) al mismo tiempo.
 */
function saveEmpresaConfig(payload) {
  try {
    const { empresaId, tipoCobro, valorFijo, horasIncluidas,
      valorHora, valorHoraExtra, vigenteDesde, observaciones } = payload;

    if (!empresaId || !tipoCobro || !vigenteDesde)
      return errorResponse('Faltan datos: empresaId, tipoCobro, vigenteDesde');

    // Asegurar formato yyyy-MM-dd en vigenteDesde
    const desdeStr = String(vigenteDesde).substring(0, 10);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_EMP_CONFIG);
    if (!sheet) return errorResponse('Hoja Empresa_Config no existe. Inicializa la BD primero.');

    const data = sheet.getDataRange().getValues();

    // Cerrar configuración activa anterior
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(empresaId) && String(data[i][9]).trim() === 'Activa') {
        // Guardar VigenteHasta como texto plano para evitar conversión de fecha
        const celdaHasta = sheet.getRange(i + 1, 4);
        celdaHasta.setNumberFormat('@STRING@');  // forzar texto
        celdaHasta.setValue(desdeStr);
        sheet.getRange(i + 1, 10).setValue('Cerrada');   // Estado
      }
    }

    // Nueva configuración
    const nextId = sheet.getLastRow();
    const newRow = [
      nextId,
      empresaId,
      desdeStr,        // VigenteDesde como string
      '',              // VigenteHasta
      tipoCobro,
      tipoCobro === 'FIJO' ? (parseFloat(valorFijo) || 0) : 0,
      tipoCobro === 'POR_HORAS' ? (parseFloat(horasIncluidas) || 0) : 0,
      tipoCobro === 'POR_HORAS' ? (parseFloat(valorHora) || 0) : 0,
      tipoCobro === 'POR_HORAS' ? (parseFloat(valorHoraExtra) || 0) : 0,
      'Activa',
      observaciones || ''
    ];
    sheet.appendRow(newRow);

    // Forzar formato texto en la celda VigenteDesde de la nueva fila
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 3).setNumberFormat('@STRING@').setValue(desdeStr);  // col 3 = VigenteDesde

    return successResponse('Configuración de contrato guardada', { id: nextId });
  } catch (err) { return errorResponse('Error al guardar contrato: ' + err); }
}

/**
 * GET: Obtiene la configuración activa de una empresa.
 */
function getEmpresaConfig(e) {
  try {
    const empresaId = e.parameter.empresaId;
    if (!empresaId) return errorResponse('empresaId requerido');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_EMP_CONFIG);
    if (!sheet) return successResponse('Sin configuración', { config: null });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    let active = null;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(empresaId) && data[i][9] === 'Activa') {
        active = _rowToObj(headers, data[i]);
        break;
      }
    }
    return successResponse('Configuración activa', { config: active });
  } catch (err) { return errorResponse('Error: ' + err); }
}

/**
 * GET: Historial completo de configuraciones de una empresa.
 */
function getEmpresaConfigHistory(e) {
  try {
    const empresaId = e.parameter.empresaId;
    if (!empresaId) return errorResponse('empresaId requerido');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_EMP_CONFIG);
    if (!sheet) return successResponse('Sin historial', { history: [] });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const history = [];

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(empresaId)) {
        history.push(_rowToObj(headers, data[i]));
      }
    }
    return successResponse('Historial de contratos', { history });
  } catch (err) { return errorResponse('Error: ' + err); }
}

// ─────────────────────────────────────────────────────────────
// MÓDULO SERVICIOS REPORTADOS
// ─────────────────────────────────────────────────────────────

/**
 * POST: Registra un servicio manual.
 */
function saveServicioReportado(payload) {
  try {
    const { empresaId, fecha, descripcion, horas } = payload;
    if (!empresaId || !fecha || !descripcion || horas === undefined)
      return errorResponse('Faltan datos: empresaId, fecha, descripcion, horas');

    // Asegurar formato yyyy-MM-dd
    const fechaStr = String(fecha).substring(0, 10);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SERVICIOS);
    if (!sheet) return errorResponse('Hoja Servicios_Reportados no existe. Inicializa la BD primero.');

    const configId = _getConfigIdForDate(ss, empresaId, fechaStr);

    const nextId = sheet.getLastRow();
    sheet.appendRow([nextId, empresaId, configId, fechaStr, descripcion, parseFloat(horas) || 0]);

    // Forzar texto en la celda de fecha
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 4).setNumberFormat('@STRING@').setValue(fechaStr);  // col 4 = Fecha

    return successResponse('Servicio registrado', { id: nextId });
  } catch (err) { return errorResponse('Error al registrar servicio: ' + err); }
}

/**
 * POST: Elimina un servicio reportado.
 */
function deleteServicioReportado(payload) {
  try {
    if (!payload.id) return errorResponse('ID requerido');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SERVICIOS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) { sheet.deleteRow(i + 1); return successResponse('Servicio eliminado'); }
    }
    return errorResponse('Servicio no encontrado');
  } catch (err) { return errorResponse('Error: ' + err); }
}

/**
 * GET: Lista servicios filtrados por empresa y período.
 */
function getServiciosReportados(e) {
  try {
    const empresaId = e.parameter.empresaId;
    const desde = e.parameter.desde || '';
    const hasta = e.parameter.hasta || '';

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SERVICIOS);
    if (!sheet) return successResponse('Sin servicios', { servicios: [] });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const servicios = [];

    const tz = Session.getScriptTimeZone();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmpId = String(row[1]);
      // Normalizar fecha: puede ser Date object o string
      const rawFecha = row[3];
      const rowFecha = rawFecha instanceof Date
        ? Utilities.formatDate(rawFecha, tz, 'yyyy-MM-dd')
        : String(rawFecha).substring(0, 10);
      if (empresaId && rowEmpId !== String(empresaId)) continue;
      if (desde && rowFecha < desde) continue;
      if (hasta && rowFecha > hasta) continue;
      servicios.push(_rowToObj(headers, row));
    }
    return successResponse('Servicios obtenidos', { servicios });
  } catch (err) { return errorResponse('Error: ' + err); }
}

// ─────────────────────────────────────────────────────────────
// MÓDULO CIERRES QUINCENALES
// ─────────────────────────────────────────────────────────────

/**
 * POST: Calcula los totales de un cierre (sin guardar).
 */
function calcularCierre(payload) {
  try {
    const { empresaId, desde, hasta } = payload;
    if (!empresaId || !desde || !hasta)
      return errorResponse('Faltan datos: empresaId, desde, hasta');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const result = _computeCierre(ss, empresaId, desde, hasta);
    if (result.error) return errorResponse(result.error);

    return successResponse('Cálculo de cierre', result);
  } catch (err) { return errorResponse('Error al calcular cierre: ' + err); }
}

/**
 * POST: Guarda un cierre quincenal (Estado=Abierto).
 */
function saveCierreQuincenal(payload) {
  try {
    const { empresaId, desde, hasta, nombreEmpresa } = payload;
    if (!empresaId || !desde || !hasta)
      return errorResponse('Faltan datos: empresaId, desde, hasta');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const calc = _computeCierre(ss, empresaId, desde, hasta);
    if (calc.error) return errorResponse(calc.error);

    const sheet = ss.getSheetByName(SHEET_CIERRES);
    if (!sheet) return errorResponse('Hoja Cierres_Quincenales no existe. Inicializa la BD.');

    const nextId = sheet.getLastRow();
    const newCierreRow = [
      nextId,
      empresaId,
      calc.configId,
      desde,
      hasta,
      calc.totalHoras,
      calc.horasNormales,
      calc.horasExtra,
      calc.totalCobro,
      'Abierto',
      '',          // FechaCierre
      nombreEmpresa || '',
      calc.tipoCobro  // TipoCobro
    ];
    sheet.appendRow(newCierreRow);

    // Forzar texto en las celdas de fecha Desde/Hasta
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 4).setNumberFormat('@STRING@').setValue(desde);  // col 4 = Desde
    sheet.getRange(lastRow, 5).setNumberFormat('@STRING@').setValue(hasta);  // col 5 = Hasta

    return successResponse('Cierre quincenal guardado', { id: nextId, ...calc });
  } catch (err) { return errorResponse('Error al guardar cierre: ' + err); }
}

/**
 * POST: Cierra definitivamente un cierre (Estado=Cerrado).
 */
function cerrarCierreQuincenal(payload) {
  try {
    if (!payload.id) return errorResponse('ID requerido');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_CIERRES);
    const data = sheet.getDataRange().getValues();
    const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) {
        sheet.getRange(i + 1, 10).setValue('Cerrado');  // Estado
        sheet.getRange(i + 1, 11).setValue(hoy);        // FechaCierre
        return successResponse('Cierre cerrado exitosamente');
      }
    }
    return errorResponse('Cierre no encontrado');
  } catch (err) { return errorResponse('Error: ' + err); }
}

/**
 * GET: Lista cierres de una empresa.
 */
function getCierresQuincenales(e) {
  try {
    const empresaId = e.parameter.empresaId;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_CIERRES);
    if (!sheet) return successResponse('Sin cierres', { cierres: [] });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const cierres = [];

    for (let i = 1; i < data.length; i++) {
      if (empresaId && String(data[i][1]) !== String(empresaId)) continue;
      cierres.push(_rowToObj(headers, data[i]));
    }
    return successResponse('Cierres obtenidos', { cierres });
  } catch (err) { return errorResponse('Error: ' + err); }
}

// ─────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES PRIVADAS
// ─────────────────────────────────────────────────────────────

/** Convierte una fila de datos (array) a objeto usando los headers.
 *  Los valores Date se normalizan a 'yyyy-MM-dd' para evitar problemas de serialización JSON.
 */
function _rowToObj(headers, row) {
  const obj = {};
  const tz = Session.getScriptTimeZone();
  for (let j = 0; j < headers.length; j++) {
    const val = row[j];
    obj[headers[j]] = val instanceof Date
      ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
      : val;
  }
  return obj;
}

/**
 * Obtiene el ID de la configuración vigente en una fecha dada para una empresa.
 * Si no hay configuración, retorna ''.
 */
function _getConfigIdForDate(ss, empresaId, fecha) {
  const sheet = ss.getSheetByName(SHEET_EMP_CONFIG);
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(empresaId)) continue;
    const rawDesde = data[i][2];
    const rawHasta = data[i][3];
    const desde = rawDesde instanceof Date
      ? Utilities.formatDate(rawDesde, tz, 'yyyy-MM-dd') : String(rawDesde).substring(0, 10);
    const hasta = rawHasta instanceof Date
      ? Utilities.formatDate(rawHasta, tz, 'yyyy-MM-dd') : String(rawHasta).substring(0, 10);
    const activa = String(data[i][9]).trim() === 'Activa';
    if (activa && fecha >= desde) return data[i][0];
    if (!activa && fecha >= desde && (hasta === '' || fecha <= hasta)) return data[i][0];
  }
  return '';
}

/**
 * Calcula totales de un cierre sin persistirlo.
 * Retorna { configId, totalHoras, horasNormales, horasExtra, totalCobro, tipoCobro, ... }
 */
function _computeCierre(ss, empresaId, desde, hasta) {
  // 1. Obtener configuración vigente (usar la del inicio del período)
  const cfgSheet = ss.getSheetByName(SHEET_EMP_CONFIG);
  if (!cfgSheet) return { error: 'Hoja Empresa_Config no existe' };

  const cfgData = cfgSheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  let config = null;

  for (let i = 1; i < cfgData.length; i++) {
    if (String(cfgData[i][1]) !== String(empresaId)) continue;

    // Normalizar fechas: pueden ser Date objects o strings
    const rawDesde = cfgData[i][2];
    const rawHasta = cfgData[i][3];
    const cfgDesde = rawDesde instanceof Date
      ? Utilities.formatDate(rawDesde, tz, 'yyyy-MM-dd')
      : String(rawDesde).substring(0, 10);
    const cfgHasta = rawHasta instanceof Date
      ? Utilities.formatDate(rawHasta, tz, 'yyyy-MM-dd')
      : String(rawHasta).substring(0, 10);
    const activa = String(cfgData[i][9]).trim() === 'Activa';

    // Config activa: aplica si el final del período es >= VigenteDesde del contrato
    // (permite usar el contrato aunque el período empezara antes de firmarlo)
    if (activa && hasta >= cfgDesde) { config = cfgData[i]; break; }
    // Config cerrada: aplica si hay solapamiento con su vigencia
    if (!activa && cfgDesde && hasta >= cfgDesde && (cfgHasta === '' || desde <= cfgHasta)) {
      config = cfgData[i]; break;
    }
  }

  if (!config) return { error: 'No hay configuración contractual activa para esta empresa en el período indicado' };

  const configId = config[0];
  const tipoCobro = String(config[4]).trim();
  const valorFijo = parseFloat(config[5]) || 0;
  const horasIncluidasC = parseFloat(config[6]) || 0;
  const valorHora = parseFloat(config[7]) || 0;
  const valorHoraExtra = parseFloat(config[8]) || 0;

  // 2. Sumar horas del período
  const srvSheet = ss.getSheetByName(SHEET_SERVICIOS);
  let totalHoras = 0;
  if (srvSheet) {
    const srvData = srvSheet.getDataRange().getValues();
    for (let i = 1; i < srvData.length; i++) {
      if (String(srvData[i][1]) !== String(empresaId)) continue;
      const rawFecha = srvData[i][3];
      const f = rawFecha instanceof Date
        ? Utilities.formatDate(rawFecha, tz, 'yyyy-MM-dd')
        : String(rawFecha).substring(0, 10);
      if (f >= desde && f <= hasta) totalHoras += parseFloat(srvData[i][5]) || 0;
    }
  }

  // 3. Calcular cobro usando horas de Servicios_Reportados
  let horasNormales = 0, horasExtra = 0, totalCobro = 0;

  if (tipoCobro === 'FIJO') {
    // Contrato bolsa/cerrado: valor fijo sin importar las horas
    totalCobro = valorFijo;
    horasNormales = totalHoras;
    horasExtra = 0;
  } else {
    // POR_HORAS: usa horas reportadas × tarifa
    // Si hay threshold (HorasIncluidas > 0): horas normales al valor base, exceso al extra
    // Si HorasIncluidas = 0: todas las horas al valor base
    if (horasIncluidasC > 0) {
      horasNormales = Math.min(totalHoras, horasIncluidasC);
      horasExtra = Math.max(0, totalHoras - horasIncluidasC);
      totalCobro = (horasNormales * valorHora) + (horasExtra * valorHoraExtra);
    } else {
      horasNormales = totalHoras;
      horasExtra = 0;
      totalCobro = totalHoras * valorHora;
    }
  }

  return {
    configId,
    tipoCobro,
    totalHoras: Math.round(totalHoras * 100) / 100,
    horasNormales: Math.round(horasNormales * 100) / 100,
    horasExtra: Math.round(horasExtra * 100) / 100,
    totalCobro: Math.round(totalCobro * 100) / 100,
    valorFijo,
    horasIncluidasContrato: horasIncluidasC,
    valorHora,
    valorHoraExtra
  };
}

// ─────────────────────────────────────────────────────────────
// UTILIDADES DE RESPUESTA
// ─────────────────────────────────────────────────────────────
function successResponse(msg, data = {}) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success', message: msg, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
