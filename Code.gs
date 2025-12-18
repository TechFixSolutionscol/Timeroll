// Sustituye "TU_SPREADSHEET_URL_AQUI" con la URL de tu hoja de cálculo de Google.
const SPREADSHEET_URL = "TU_SPREADSHEET_URL_AQUI";
const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

// =================================================================================
// FUNCIÓN PRINCIPAL DE ENTRADA (ENDPOINT)
// =================================================================================

/**
 * Maneja las solicitudes POST del frontend.
 * Actúa como un enrutador, llamando a otras funciones basadas en la 'action' enviada.
 * @param {Object} e - El objeto de evento de la solicitud POST.
 * @returns {ContentService.TextOutput} - Una respuesta JSON.
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    let response;

    switch (action) {
      case 'setup':
        response = setup();
        break;
      case 'login':
        response = login(request.payload.username, request.payload.password);
        break;
      case 'getClients':
        response = getClients();
        break;
      case 'addClient':
        response = addClient(request.payload);
        break;
      case 'updateClient':
        response = updateClient(request.payload);
        break;
      case 'deleteClient':
        response = deleteClient(request.payload.id);
        break;
      case 'addInvoice':
        response = addInvoice(request.payload);
        break;
      default:
        throw new Error("Acción no válida: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: response }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error en doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================================
// FUNCIÓN DE CONFIGURACIÓN
// =================================================================================

/**
 * Crea las hojas necesarias en la hoja de cálculo si no existen.
 * También añade un usuario administrador por defecto si la hoja de usuarios está vacía.
 */
function setup() {
  const sheetNames = ["Usuarios", "Clientes", "Facturas"];
  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
      Logger.log("Hoja '" + name + "' creada.");
    }
  });

  // Configurar cabeceras y usuario admin por defecto
  const usersSheet = ss.getSheetByName("Usuarios");
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(["ID", "Username", "PasswordHash", "Salt"]);
    // ¡IMPORTANTE! Cambia este usuario y contraseña en producción
    const salt = Utilities.getUuid();
    const passwordHash = hashPassword("admin123", salt);
    usersSheet.appendRow([1, "admin", passwordHash, salt]);
    Logger.log("Usuario administrador por defecto creado.");
  }

  const clientsSheet = ss.getSheetByName("Clientes");
  if (clientsSheet.getLastRow() === 0) {
    clientsSheet.appendRow(["ID", "Name", "Email", "Phone", "Address"]);
    Logger.log("Cabeceras de Clientes creadas.");
  }

  const invoicesSheet = ss.getSheetByName("Facturas");
  if (invoicesSheet.getLastRow() === 0) {
    invoicesSheet.appendRow(["ID", "ClientID", "ClientName", "Date", "DurationHours", "HourlyRate", "TotalAmount"]);
    Logger.log("Cabeceras de Facturas creadas.");
  }

  return { message: "Configuración completada exitosamente." };
}

// =================================================================================
// FUNCIONES DE AUTENTICACIÓN Y USUARIOS
// =================================================================================

/**
 * Crea un hash de la contraseña usando un salt para mayor seguridad.
 * @param {string} password - La contraseña en texto plano.
 * @param {string} salt - Una cadena aleatoria única para este usuario.
 * @returns {string} - El hash de la contraseña.
 */
function hashPassword(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifica si una contraseña coincide con su hash almacenado.
 * @param {string} password - La contraseña en texto plano a verificar.
 * @param {string} salt - El salt almacenado para el usuario.
 * @param {string} storedHash - El hash de la contraseña almacenado.
 * @returns {boolean} - True si la contraseña es correcta, false en caso contrario.
 */
function verifyPassword(password, salt, storedHash) {
  const newHash = hashPassword(password, salt);
  return newHash === storedHash;
}

/**
 * Autentica a un usuario.
 * @param {string} username - El nombre de usuario.
 * @param {string} password - La contraseña.
 * @returns {Object} - Un objeto con el resultado del inicio de sesión.
 */
function login(username, password) {
  const usersSheet = ss.getSheetByName("Usuarios");
  const data = usersSheet.getDataRange().getValues();
  // Empezar en 1 para saltar la fila de cabecera
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) { // data[i][1] es la columna 'Username'
      const storedHash = data[i][2]; // data[i][2] es la columna 'PasswordHash'
      const salt = data[i][3];       // data[i][3] es la columna 'Salt'
      if (verifyPassword(password, salt, storedHash)) {
        return { success: true, message: "Inicio de sesión exitoso." };
      }
    }
  }
  return { success: false, message: "Nombre de usuario o contraseña incorrectos." };
}


// =================================================================================
// FUNCIONES CRUD PARA CLIENTES
// =================================================================================

/**
 * Obtiene el siguiente ID disponible para una hoja.
 * @param {Sheet} sheet - La hoja de cálculo para comprobar.
 * @returns {number} - El siguiente ID disponible.
 */
function getNextId(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return 1;
    }
    // Obtiene el rango de la primera columna (IDs)
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    // Encuentra el ID máximo y añade 1
    const maxId = ids.reduce((max, row) => Math.max(max, row[0]), 0);
    return maxId + 1;
}

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 * @returns {Array<Object>} - Un array de objetos de cliente.
 */
function getClients() {
  const sheet = ss.getSheetByName("Clientes");
  if (sheet.getLastRow() < 2) return []; // No hay clientes si solo está la cabecera
  // Obtener datos, excluyendo la cabecera
  const data = sheet.getDataRange().getValues().slice(1);
  return data.map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 * @param {Object} clientData - Los datos del cliente a añadir.
 * @returns {Object} - El cliente que fue añadido.
 */
function addClient(clientData) {
  const sheet = ss.getSheetByName("Clientes");
  const newId = getNextId(sheet);
  sheet.appendRow([
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ]);
  return { ...clientData, id: newId };
}

/**
 * Actualiza un cliente existente.
 * @param {Object} clientData - Los nuevos datos del cliente.
 * @returns {Object} - El cliente actualizado.
 */
function updateClient(clientData) {
  const sheet = ss.getSheetByName("Clientes");
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.id);

  if (rowIndex > 0) { // rowIndex > 0 asegura que no sea la cabecera
    sheet.getRange(rowIndex + 1, 2).setValue(clientData.name);
    sheet.getRange(rowIndex + 1, 3).setValue(clientData.email);
    sheet.getRange(rowIndex + 1, 4).setValue(clientData.phone);
    sheet.getRange(rowIndex + 1, 5).setValue(clientData.address);
    return clientData;
  }
  throw new Error("Cliente no encontrado para actualizar.");
}

/**
 * Elimina un cliente.
 * @param {number} id - El ID del cliente a eliminar.
 * @returns {Object} - Un mensaje de confirmación.
 */
function deleteClient(id) {
  const sheet = ss.getSheetByName("Clientes");
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == id);

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
    return { id: id, message: "Cliente eliminado correctamente." };
  }
  throw new Error("Cliente no encontrado para eliminar.");
}

// =================================================================================
// FUNCIÓN PARA GUARDAR FACTURAS
// =================================================================================

/**
 * Guarda los detalles de una factura en la hoja de cálculo.
 * @param {Object} invoiceData - Los datos de la factura.
 * @returns {Object} - La factura guardada.
 */
function addInvoice(invoiceData) {
    const sheet = ss.getSheetByName("Facturas");
    const newId = getNextId(sheet);
    sheet.appendRow([
        newId,
        invoiceData.client.id,
        invoiceData.client.name,
        new Date(),
        invoiceData.hours,
        invoiceData.rate,
        invoiceData.total
    ]);
    return { ...invoiceData, id: newId };
}
