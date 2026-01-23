// Constantes globales para la configuración
const SPREADSHEET_ID_KEY = 'spreadsheetId';
const SESSION_TOKEN_KEY = 'sessionToken';

// =================================================================
// SERVIDOR WEB Y UTILIDADES
// =================================================================

/**
 * Se ejecuta cuando un usuario visita la URL de la aplicación.
 * Sirve la página de inicio de sesión o la aplicación principal dependiendo del estado de autenticación.
 */
function doGet(e) {
  if (!checkAuth()) {
    return HtmlService.createTemplateFromFile('Login').evaluate()
      .setTitle('TimeBill Pro - Iniciar Sesión')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('TimeBill Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Incluye contenido de otros archivos HTML en la plantilla principal.
 * Permite la creación de componentes o parciales.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =================================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (GOOGLE SHEETS)
// =================================================================

/**
 * Se ejecuta cuando se abre la hoja de cálculo asociada.
 * Agrega un menú personalizado para configurar la base de datos.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TimeBill Pro')
    .addItem('Configurar Base de Datos', 'setupDatabase')
    .addToUi();
}

/**
 * Crea las hojas necesarias ("Usuarios" y "Clientes") con sus encabezados.
 * Almacena el ID de la hoja de cálculo en las propiedades del script para uso futuro.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro - Base de Datos');
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ss.getId());

  // Hoja de Usuarios
  const usersSheet = ss.insertSheet('Usuarios');
  usersSheet.appendRow(['ID', 'Username', 'PasswordHash', 'Salt']);
  usersSheet.getRange('A1:D1').setFontWeight('bold');
  // Crear un usuario de ejemplo
  const salt = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString()));
  const passwordHash = hashPassword('admin123', salt);
  usersSheet.appendRow([1, 'admin', passwordHash, salt]);

  // Hoja de Clientes
  const clientsSheet = ss.insertSheet('Clientes');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.getRange('A1:E1').setFontWeight('bold');
  clientsSheet.appendRow([1, 'Cliente de Ejemplo S.A.S', 'ejemplo@correo.com', '3001234567', 'Calle Falsa 123']);

  ss.deleteSheet(ss.getSheetByName('Sheet1')); // Eliminar la hoja por defecto

  SpreadsheetApp.getUi().alert('¡Base de datos configurada con éxito! El ID de la hoja de cálculo ha sido guardado. Usuario por defecto: admin, Contraseña: admin123');
}

/**
 * Función auxiliar para obtener el objeto Spreadsheet.
 * Lanza un error si la base de datos no ha sido configurada.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('La base de datos no ha sido configurada. Por favor, ejecute la función "Configurar Base de Datos" desde el menú.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// =================================================================
// AUTENTICACIÓN Y SESIONES
// =================================================================

/**
 * Hashea una contraseña usando un salt y el algoritmo SHA-256.
 */
function hashPassword(password, salt) {
  const saltedPassword = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword);
  return Utilities.base64Encode(hash);
}

/**
 * Verifica las credenciales del usuario contra la base de datos.
 * Si son correctas, crea una sesión.
 */
function login(credentials) {
  const { username, password } = credentials;
  const ss = getSpreadsheet();
  const usersSheet = ss.getSheetByName('Usuarios');
  const data = usersSheet.getDataRange().getValues();

  // Buscar al usuario (ignorando el encabezado)
  for (let i = 1; i < data.length; i++) {
    const [id, storedUsername, storedHash, storedSalt] = data[i];
    if (storedUsername === username) {
      const inputHash = hashPassword(password, storedSalt);
      if (inputHash === storedHash) {
        // Credenciales correctas, crear sesión
        const token = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Math.random().toString()));
        PropertiesService.getUserProperties().setProperty(SESSION_TOKEN_KEY, token);
        return { success: true, user: { username: storedUsername } };
      }
    }
  }

  throw new Error('Usuario o contraseña incorrectos.');
}

/**
 * Cierra la sesión del usuario eliminando el token.
 */
function logout() {
  PropertiesService.getUserProperties().deleteProperty(SESSION_TOKEN_KEY);
  return { success: true };
}


/**
 * Verifica si el usuario tiene un token de sesión válido.
 */
function checkAuth() {
  return PropertiesService.getUserProperties().getProperty(SESSION_TOKEN_KEY) !== null;
}

// =================================================================
// OPERACIONES CRUD PARA CLIENTES
// =================================================================

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 */
function getClients() {
  if (!checkAuth()) throw new Error('Acceso no autorizado.');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();

  // Omitir el encabezado
  data.shift();

  // Mapear los datos a objetos
  return data.map(row => ({
    ID: row[0],
    Name: row[1],
    Email: row[2],
    Phone: row[3],
    Address: row[4]
  }));
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 */
function addClient(clientData) {
  if (!checkAuth()) throw new Error('Acceso no autorizado.');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Clientes');

  // Obtener el siguiente ID
  const lastRow = sheet.getLastRow();
  const nextId = lastRow > 0 ? sheet.getRange(lastRow, 1).getValue() + 1 : 1;

  const newRow = [
    nextId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ];
  sheet.appendRow(newRow);

  return {
    ID: nextId,
    Name: clientData.name,
    Email: clientData.email,
    Phone: clientData.phone,
    Address: clientData.address
  };
}

/**
 * Edita un cliente existente en la hoja de cálculo.
 */
function editClient(clientData) {
  if (!checkAuth()) throw new Error('Acceso no autorizado.');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();

  const rowIndex = data.findIndex(row => row[0] == clientData.id);

  if (rowIndex === -1) {
    throw new Error('Cliente no encontrado.');
  }

  sheet.getRange(rowIndex + 1, 2).setValue(clientData.name);
  sheet.getRange(rowIndex + 1, 3).setValue(clientData.email);
  sheet.getRange(rowIndex + 1, 4).setValue(clientData.phone);
  sheet.getRange(rowIndex + 1, 5).setValue(clientData.address);

  return {
    ID: clientData.id,
    Name: clientData.name,
    Email: clientData.email,
    Phone: clientData.phone,
    Address: clientData.address
  };
}

/**
 * Elimina un cliente de la hoja de cálculo.
 */
function deleteClient(clientId) {
  if (!checkAuth()) throw new Error('Acceso no autorizado.');
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();

  const rowIndex = data.findIndex(row => row[0] == clientId);

  if (rowIndex === -1) {
    throw new Error('Cliente no encontrado.');
  }

  sheet.deleteRow(rowIndex + 1);
  return { success: true, deletedId: clientId };
}
