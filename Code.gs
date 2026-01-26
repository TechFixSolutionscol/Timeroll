// Constantes globales para la configuración de la base de datos
const SPREADSHEET_ID_KEY = 'spreadsheetId';

//================================================================
// SERVIDOR WEB Y MENÚS
//================================================================

/**
 * Se ejecuta cuando se abre la hoja de cálculo. Crea un menú personalizado.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup Inicial', 'setupDatabase')
      .addItem('Configurar API Key de Gemini', 'setGeminiApiKey')
      .addToUi();
}

/**
 * Punto de entrada principal para la aplicación web.
 * Sirve la página de inicio de sesión o la aplicación principal según el estado de autenticación.
 */
function doGet(e) {
  if (!checkAuth()) {
    return HtmlService.createTemplateFromFile('Login').evaluate()
        .setTitle('TimeBill Pro - Iniciar Sesión')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Permite incluir archivos HTML parciales (templates) dentro de otros.
 * @param {string} filename El nombre del archivo a incluir.
 * @return {string} El contenido del archivo HTML.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


//================================================================
// SETUP DE LA BASE DE DATOS
//================================================================

/**
 * Configura la hoja de cálculo por primera vez.
 * Crea las hojas 'Usuarios' y 'Clientes', establece encabezados y un usuario admin por defecto.
 */
function setupDatabase() {
  const ui = SpreadsheetApp.getUi();
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, spreadsheet.getId());

    // Crear hoja de Usuarios
    let userSheet = spreadsheet.getSheetByName('Usuarios');
    if (!userSheet) {
      userSheet = spreadsheet.insertSheet('Usuarios');
      userSheet.getRange('A1:C1').setValues([['ID', 'Username', 'PasswordHash']]).setFontWeight('bold');
      userSheet.setFrozenRows(1);
    }

    // Crear hoja de Clientes
    let clientSheet = spreadsheet.getSheetByName('Clientes');
    if (!clientSheet) {
      clientSheet = spreadsheet.insertSheet('Clientes');
      clientSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]).setFontWeight('bold');
      clientSheet.setFrozenRows(1);
    }

    // Añadir usuario admin si no existe
    const users = userSheet.getDataRange().getValues();
    const adminExists = users.slice(1).some(row => row[1] === 'admin');

    if (!adminExists) {
        const password = Math.random().toString(36).slice(-8);
        const passwordHash = hashPassword(password);
        const newId = getNextId(userSheet);
        userSheet.appendRow([newId, 'admin', passwordHash]);
        ui.alert(`Setup completado. Se ha creado el usuario 'admin' con la contraseña: ${password}. Guárdala en un lugar seguro.`);
    } else {
        ui.alert('El setup ya se había completado anteriormente.');
    }

  } catch (e) {
    Logger.log(e);
    ui.alert(`Error durante el setup: ${e.message}`);
  }
}

/**
 * Obtiene una referencia a la hoja de cálculo activa usando el ID almacenado.
 * @return {Spreadsheet} El objeto Spreadsheet.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('La base de datos no ha sido inicializada. Ejecuta el "Setup Inicial" desde el menú.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

//================================================================
// AUTENTICACIÓN
//================================================================

/**
 * Inicia sesión de un usuario.
 * @param {string} username El nombre de usuario.
 * @param {string} password La contraseña.
 * @return {object} Un objeto indicando el éxito o el error.
 */
function login(username, password) {
  try {
    const userSheet = getSpreadsheet().getSheetByName('Usuarios');
    const users = sheetToObjects(userSheet);

    const user = users.find(u => u.Username === username);

    if (user && user.PasswordHash === hashPassword(password)) {
      const sessionToken = Utilities.base64Encode(Math.random().toString());
      // Las propiedades de usuario están asociadas al usuario de Google que ejecuta el script
      PropertiesService.getUserProperties().setProperty('sessionToken', sessionToken);
      return { success: true, user: { username: user.Username } };
    }

    return { success: false, error: 'Usuario o contraseña incorrectos.' };
  } catch (e) {
    Logger.log(e);
    return { success: false, error: e.message };
  }
}

/**
 * Cierra la sesión del usuario actual.
 */
function logout() {
    PropertiesService.getUserProperties().deleteProperty('sessionToken');
    return { success: true };
}


/**
 * Verifica si el usuario actual tiene una sesión activa.
 * @return {boolean} Verdadero si la sesión es válida.
 */
function checkAuth() {
  return !!PropertiesService.getUserProperties().getProperty('sessionToken');
}

/**
 * Obtiene la información del usuario autenticado.
 * @return {{username: string}}
 */
function getAuthenticatedUser() {
    // Esta es una simplificación. En un caso real, podríamos querer
    // almacenar el nombre de usuario en la sesión al hacer login.
    // Por ahora, asumimos que si está autenticado, es el usuario que hizo login.
    // Vamos a buscar el usuario para devolver su nombre.
    return { username: 'admin' }; // Simplificado para este ejemplo
}


/**
 * Genera un hash SHA-256 para una contraseña.
 * @param {string} password La contraseña a hashear.
 * @return {string} El hash en formato hexadecimal.
 */
function hashPassword(password) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}


//================================================================
// OPERACIONES CRUD DE CLIENTES
//================================================================

/**
 * Obtiene todos los clientes de la hoja de cálculo.
 * @return {Array<Object>} Un array de objetos de cliente.
 */
function getClients() {
  try {
    if (!checkAuth()) throw new Error('No autorizado.');
    const clientSheet = getSpreadsheet().getSheetByName('Clientes');
    return sheetToObjects(clientSheet);
  } catch (e) {
    Logger.log(e);
    return []; // Devuelve un array vacío en caso de error
  }
}

/**
 * Añade un nuevo cliente a la hoja de cálculo.
 * @param {object} clientData Los datos del cliente.
 * @return {object} El cliente añadido con su nuevo ID.
 */
function addClient(clientData) {
  try {
    if (!checkAuth()) throw new Error('No autorizado.');
    const clientSheet = getSpreadsheet().getSheetByName('Clientes');
    const newId = getNextId(clientSheet);
    const newRow = [newId, clientData.name, clientData.email, clientData.phone, clientData.address];
    clientSheet.appendRow(newRow);

    // Devolvemos el objeto completo que se acaba de crear
    return { ID: newId, Name: clientData.name, Email: clientData.email, Phone: clientData.phone, Address: clientData.address };
  } catch (e) {
    Logger.log(e);
    throw new Error(`Error al añadir cliente: ${e.message}`);
  }
}

/**
 * Actualiza un cliente existente en la hoja de cálculo.
 * @param {object} clientData Los datos actualizados del cliente, incluyendo su ID.
 * @return {object} Los datos del cliente actualizado.
 */
function updateClient(clientData) {
  try {
    if (!checkAuth()) throw new Error('No autorizado.');
    const clientSheet = getSpreadsheet().getSheetByName('Clientes');
    const data = clientSheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    const rowIndex = data.slice(1).findIndex(row => row[idColumnIndex] == clientData.ID) + 1;

    if (rowIndex > 0) {
      const rowToUpdate = [clientData.ID, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
      clientSheet.getRange(rowIndex + 1, 1, 1, rowToUpdate.length).setValues([rowToUpdate]);
      return clientData;
    } else {
      throw new Error('Cliente no encontrado.');
    }
  } catch (e) {
    Logger.log(e);
    throw new Error(`Error al actualizar cliente: ${e.message}`);
  }
}

/**
 * Elimina un cliente de la hoja de cálculo.
 * @param {number} clientId El ID del cliente a eliminar.
 * @return {{success: boolean, id: number}} Un objeto indicando el éxito y el ID eliminado.
 */
function deleteClient(clientId) {
  try {
    if (!checkAuth()) throw new Error('No autorizado.');
    const clientSheet = getSpreadsheet().getSheetByName('Clientes');
    const data = clientSheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');

    const rowIndex = data.slice(1).findIndex(row => row[idColumnIndex] == clientId) + 2;

    if (rowIndex > 1) {
      clientSheet.deleteRow(rowIndex);
      return { success: true, id: clientId };
    } else {
      throw new Error('Cliente no encontrado para eliminar.');
    }
  } catch (e) {
    Logger.log(e);
    throw new Error(`Error al eliminar cliente: ${e.message}`);
  }
}


//================================================================
// FUNCIONES HELPERS
//================================================================

/**
 * Convierte los datos de una hoja de cálculo a un array de objetos.
 * La primera fila se asume que contiene los encabezados (keys).
 * @param {Sheet} sheet El objeto Sheet de Google Apps Script.
 * @return {Array<Object>} El array de objetos.
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

/**
 * Calcula el siguiente ID autoincremental para una hoja.
 * @param {Sheet} sheet La hoja para la que se calculará el ID.
 * @return {number} El siguiente ID.
 */
function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1; // No hay datos, empezar en 1
  }
  // Buscar la última fila con datos en la columna A
  const maxId = sheet.getRange("A2:A").getValues()
    .filter(cell => cell[0] !== "") // Filtrar celdas vacías
    .reduce((max, cell) => Math.max(max, parseInt(cell[0], 10)), 0);
  return maxId + 1;
}

/**
 * Obtiene los datos iniciales necesarios para cargar la aplicación.
 * @return {{clients: Array<Object>, user: {username: string}}}
 */
function getInitialData() {
  if (!checkAuth()) throw new Error('No autorizado.');
  return {
    clients: getClients(),
    user: getAuthenticatedUser()
  };
}

//================================================================
// INTEGRACIÓN CON GEMINI API
//================================================================

/**
 * Pide al usuario que introduzca su API key de Gemini y la guarda en las propiedades del script.
 */
function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Configurar API Key de Gemini',
    'Por favor, introduce tu API key de Google Gemini:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const apiKey = response.getResponseText();
    PropertiesService.getScriptProperties().setProperty('geminiApiKey', apiKey);
    ui.alert('API Key guardada correctamente.');
  }
}

/**
 * Genera un borrador de correo electrónico usando la API de Gemini.
 * @param {string} clientName El nombre del cliente.
 * @param {string} clientEmail El email del cliente.
 * @param {object} invoiceData Los datos de la factura (hours, total).
 * @return {string} El borrador del correo electrónico.
 */
function generateEmailDraft(clientName, clientEmail, invoiceData) {
  if (!checkAuth()) throw new Error('No autorizado.');

  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
  if (!apiKey) {
    throw new Error('La API key de Gemini no ha sido configurada. Ve al menú "TimeBill Pro" > "Configurar API Key de Gemini" en la hoja de cálculo.');
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${invoiceData.hours.toFixed(2)} horas y el total a pagar es $${invoiceData.total.toFixed(2)}. El cliente se llama ${clientName} y su correo es ${clientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total. El correo debe estar en español.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const requestBody = {
    "contents": [{
      "parts": [{
        "text": prompt
      }]
    }]
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(requestBody),
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      throw new Error(`Error de la API: ${result.error.message}`);
    }

    const text = result.candidates[0].content.parts[0].text;
    return text;
  } catch (e) {
    Logger.log(`Error al llamar a Gemini API: ${e.toString()}`);
    throw new Error(`No se pudo generar el borrador. Detalles: ${e.message}`);
  }
}