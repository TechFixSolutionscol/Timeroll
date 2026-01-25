// Archivo `Code.gs`

// Claves para almacenar valores en Script Properties, un lugar seguro para guardar información sensible.
const SPREADSHEET_ID_KEY = 'spreadsheetId';
const GEMINI_API_KEY = 'geminiApiKey';

// ==================================================================================
// FUNCIONES DEL MENÚ Y CONFIGURACIÓN INICIAL
// ==================================================================================

/**
 * @description
 * Se ejecuta cuando se abre la hoja de cálculo de Google.
 * Añade un menú personalizado "TimeBill Pro" a la interfaz de la hoja de cálculo
 * para facilitar la configuración inicial.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('1. Configurar Base de Datos', 'setupDatabase')
      .addItem('2. Establecer API Key de Gemini', 'setGeminiApiKey')
      .addToUi();
}

/**
 * @description
 * Configura las hojas 'Usuarios' y 'Clientes' en la hoja de cálculo de Google.
 * Crea las cabeceras y añade un usuario 'admin' por defecto con una contraseña aleatoria.
 * Muestra la contraseña al usuario para que pueda iniciar sesión.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ss.getId());

  // Configurar hoja de Usuarios
  let usersSheet = ss.getSheetByName('Usuarios');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('Usuarios');
    usersSheet.getRange('A1:C1').setValues([['ID', 'Username', 'PasswordHash']]).setFontWeight('bold');

    const adminPassword = Math.random().toString(36).slice(-8);
    const adminPasswordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, adminPassword)
                                       .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                       .join('');

    usersSheet.getRange('A2:C2').setValues([[1, 'admin', adminPasswordHash]]);
    SpreadsheetApp.getUi().alert(`Base de Datos Configurada.
      Usuario por defecto: admin
      Contraseña: ${adminPassword}
      Guarda esta contraseña en un lugar seguro. Deberás usarla para iniciar sesión en la aplicación.`);
  }

  // Configurar hoja de Clientes
  let clientsSheet = ss.getSheetByName('Clientes');
  if (!clientsSheet) {
    clientsSheet = ss.insertSheet('Clientes');
    clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]).setFontWeight('bold');
  }

  ss.toast('¡La base de datos está lista!');
}


/**
 * @description
 * Muestra un cuadro de diálogo para que el usuario ingrese su clave de API de Gemini.
 * La clave se guarda de forma segura en las Script Properties.
 */
function setGeminiApiKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
      'Establecer API Key de Gemini',
      'Pega tu clave de API de Google Gemini aquí:',
      ui.ButtonSet.OK_CANCEL);

  const button = result.getSelectedButton();
  const text = result.getResponseText();

  if (button == ui.Button.OK && text) {
    PropertiesService.getScriptProperties().setProperty(GEMINI_API_KEY, text);
    ui.alert('API Key de Gemini guardada correctamente.');
  }
}

// ==================================================================================
// SERVIDOR WEB Y AUTENTICACIÓN
// ==================================================================================

/**
 * @description
 * Se ejecuta cuando un usuario visita la URL de la aplicación web.
 * Sirve `Login.html` si no está autenticado, o `index.html` si ya hay una sesión activa.
 * @returns {HtmlOutput} La página web a ser renderizada.
 */
function doGet() {
  if (!checkAuth()) {
    return HtmlService.createTemplateFromFile('Login').evaluate()
      .setTitle('TimeBill Pro - Login')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * @description
 * Verifica las credenciales del usuario contra la hoja 'Usuarios'.
 * Si son correctas, crea una sesión para el usuario.
 * @param {string} username - El nombre de usuario.
 * @param {string} password - La contraseña.
 * @returns {object} Un objeto indicando el éxito o fracaso del inicio de sesión.
 */
function login(username, password) {
  try {
    const usersSheet = getSpreadsheet().getSheetByName('Usuarios');
    const usersData = usersSheet.getDataRange().getValues();
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
                                .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
                                .join('');

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][1] === username && usersData[i][2] === passwordHash) {
        const sessionToken = Utilities.base64Encode(Math.random().toString());
        PropertiesService.getUserProperties().setProperty('sessionToken', sessionToken);
        PropertiesService.getUserProperties().setProperty('username', username);
        return { success: true };
      }
    }
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  } catch (e) {
    return { success: false, message: `Error en el servidor: ${e.message}` };
  }
}

/**
 * @description
 * Cierra la sesión del usuario eliminando el token de sesión.
 */
function logout() {
  PropertiesService.getUserProperties().deleteProperty('sessionToken');
  PropertiesService.getUserProperties().deleteProperty('username');
}


/**
 * @description
 * Comprueba si el usuario tiene un token de sesión válido.
 * @returns {boolean} `true` si el usuario está autenticado, `false` en caso contrario.
 */
function checkAuth() {
  return !!PropertiesService.getUserProperties().getProperty('sessionToken');
}

/**
 * @description
 * Obtiene el nombre de usuario de la sesión actual.
 * @returns {string|null} El nombre de usuario o `null` si no hay sesión.
 */
function getCurrentUser() {
  return PropertiesService.getUserProperties().getProperty('username');
}


/**
 * @description
 * Incluye contenido de otros archivos HTML en la plantilla principal.
 * Permite modularizar el código frontend (CSS, JS, HTML parciales).
 * @param {string} filename - El nombre del archivo a incluir (sin la extensión .html).
 * @returns {string} El contenido del archivo HTML solicitado.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// ==================================================================================
// OPERACIONES CRUD DE CLIENTES
// ==================================================================================

/**
 * @description
 * Obtiene la hoja de cálculo activa y lanza un error si no ha sido configurada.
 * @returns {Spreadsheet} El objeto de la hoja de cálculo.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('La base de datos (Google Sheet) no ha sido configurada. Ejecuta "Configurar Base de Datos" desde el menú en la hoja de cálculo.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * @description
 * Obtiene todos los clientes de la hoja 'Clientes'.
 * @returns {Array<Object>} Un array de objetos, donde cada objeto representa un cliente.
 */
function getClients() {
  if (!checkAuth()) throw new Error('No autorizado.');
  try {
    const sheet = getSpreadsheet().getSheetByName('Clientes');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Saca la fila de cabeceras

    return data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
  } catch (e) {
    return []; // Devuelve un array vacío si hay un error (ej. la hoja no existe)
  }
}

/**
 * @description
 * Añade un nuevo cliente a la hoja 'Clientes'.
 * Genera un nuevo ID para el cliente.
 * @param {object} clientData - Los datos del cliente a añadir.
 * @returns {object} El objeto del cliente recién creado.
 */
function addClient(clientData) {
   if (!checkAuth()) throw new Error('No autorizado.');
  const sheet = getSpreadsheet().getSheetByName('Clientes');
  const lastRow = sheet.getLastRow();
  const newId = lastRow > 0 ? sheet.getRange(lastRow, 1).getValue() + 1 : 1;

  const newRow = [
    newId,
    clientData.name || '',
    clientData.email || '',
    clientData.phone || '',
    clientData.address || ''
  ];

  sheet.appendRow(newRow);

  return {
    ID: newId,
    Name: clientData.name,
    Email: clientData.email,
    Phone: clientData.phone,
    Address: clientData.address
  };
}

/**
 * @description
 * Edita un cliente existente en la hoja 'Clientes' basado en su ID.
 * @param {object} clientData - Los nuevos datos del cliente. Debe incluir un 'ID'.
 * @returns {object} Un objeto confirmando el éxito.
 */
function editClient(clientData) {
  if (!checkAuth()) throw new Error('No autorizado.');
  const sheet = getSpreadsheet().getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == clientData.ID) {
      const newRow = headers.map(header => clientData[header] || data[i][headers.indexOf(header)]);
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { success: true, message: 'Cliente actualizado.' };
    }
  }
  throw new Error('Cliente no encontrado.');
}

/**
 * @description
 * Elimina un cliente de la hoja 'Clientes' basado en su ID.
 * @param {number} clientId - El ID del cliente a eliminar.
 * @returns {object} Un objeto confirmando el éxito.
 */
function deleteClient(clientId) {
  if (!checkAuth()) throw new Error('No autorizado.');
  const sheet = getSpreadsheet().getSheetByName('Clientes');
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('ID');

  for (let i = data.length - 1; i > 0; i--) { // Iterar hacia atrás para evitar problemas al eliminar filas
    if (data[i][idIndex] == clientId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Cliente eliminado.' };
    }
  }
  throw new Error('Cliente no encontrado.');
}


// ==================================================================================
// INTEGRACIÓN CON LA API DE GEMINI
// ==================================================================================

/**
 * @description
 * Genera un borrador de correo electrónico utilizando la API de Google Gemini.
 * La llamada se hace de forma segura desde el backend.
 * @param {object} invoiceData - Objeto con los detalles de la factura { client, hours, total }.
 * @returns {string} El borrador del correo electrónico generado por la IA.
 */
function generateEmailDraft(invoiceData) {
  if (!checkAuth()) throw new Error('No autorizado.');

  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error('La API Key de Gemini no ha sido configurada. Pídale al administrador que la configure desde el menú de la hoja de cálculo.');
  }

  const { client, hours, total } = invoiceData;

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total. El correo debe estar en español.`;

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
    'payload': JSON.stringify(requestBody)
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      // Intenta devolver el objeto de error si está disponible para dar más contexto
      if (result.error) {
         throw new Error(`Error de la API de Gemini: ${result.error.message}`);
      }
      throw new Error('No se pudo generar el borrador de correo. La respuesta de la API no tuvo el formato esperado.');
    }
  } catch (e) {
    // Captura errores de red o de la API y los devuelve de forma amigable
    throw new Error(`Error al contactar la API de Gemini: ${e.message}`);
  }
}
