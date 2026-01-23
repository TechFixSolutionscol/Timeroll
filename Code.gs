function doGet(e) {
  if (checkAuth()) {
    return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    return HtmlService.createTemplateFromFile('Login').evaluate()
      .setTitle('TimeBill Pro - Iniciar Sesión');
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- DATABASE FUNCTIONS ---

const SPREADSHEET_ID_KEY = 'spreadsheetId';

/**
 * Creates the initial spreadsheet and sets it up for the application.
 * This function is intended to be run manually from the script editor.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro Database');
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ss.getId());

  // Set up Clients sheet
  const clientsSheet = ss.getSheetByName('Sheet1'); // Rename the default sheet
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

  // This alert will show for the developer running the script in the editor.
  SpreadsheetApp.getUi().alert('Database setup complete! The Spreadsheet ID has been stored: ' + ss.getId());
}

/**
 * Sets up the administrator credentials in Script Properties.
 * This function is intended to be run manually from the script editor ONCE.
 */
function setupCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('adminUsername', 'admin');
  // In a real scenario, you'd use a more secure password.
  // This password is intentionally simple for the demo.
  // We will hash it for storage.
  const password = 'admin';
  const hashedPassword = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  scriptProperties.setProperty('adminPasswordHash', bytesToHex(hashedPassword));

  SpreadsheetApp.getUi().alert('Administrator credentials have been set.');
}

// Helper to convert byte array to hex string
function bytesToHex(bytes) {
  return bytes.map(byte => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Gets the active spreadsheet, or throws an error if it's not set up.
 * @returns {SpreadsheetApp.Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please run the "setupDatabase" function from the script editor.');
  }
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    return ss;
  } catch (e) {
     throw new Error('Could not open the spreadsheet. Please check if the ID stored in Script Properties is correct and that you have access.');
  }
}

// --- CLIENT CRUD OPERATIONS ---

function getClients() {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row

  const clients = data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });

  return clients;
}

function addClient(client) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header

  const maxId = data.reduce((max, row) => Math.max(max, row[0]), 0);
  const newId = maxId + 1;

  const newRow = [newId, client.name, client.email, client.phone, client.address];
  sheet.appendRow(newRow);

  return { ID: newId, Name: client.name, Email: client.email, Phone: client.phone, Address: client.address };
}

function updateClient(client) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idColumnIndex = headers.indexOf('ID');

  const rowToUpdate = data.findIndex(row => row[idColumnIndex] == client.id) + 2; // +1 for header, +1 for 1-based index

  if (rowToUpdate > 1) {
    const newRowData = [client.id, client.name, client.email, client.phone, client.address];
    sheet.getRange(rowToUpdate, 1, 1, newRowData.length).setValues([newRowData]);
    return { success: true, client: client };
  } else {
    return { success: false, message: 'Client not found.' };
  }
}

function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idColumnIndex = headers.indexOf('ID');

  const rowToDelete = data.findIndex(row => row[idColumnIndex] == clientId) + 2;

  if (rowToDelete > 1) {
    sheet.deleteRow(rowToDelete);
    return { success: true };
  } else {
    return { success: false, message: 'Client not found.' };
  }
}

// --- GEMINI API FUNCTION ---

const GEMINI_API_KEY_KEY = 'geminiApiKey';

function generateEmailDraft(invoiceData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_KEY);
  if (!apiKey) {
    return { success: false, message: 'La clave de la API de Gemini no está configurada en las propiedades del script.' };
  }

  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());
    const text = result.candidates[0].content.parts[0].text;
    return { success: true, draft: text };
  } catch (error) {
    console.error('Error al llamar a la API de Gemini: ' + error.toString());
    return { success: false, message: 'Error al generar el borrador. Por favor, inténtalo de nuevo.' };
  }
}


/**
 * Checks if the user is authenticated.
 * @returns {boolean} True if authenticated, false otherwise.
 */
function checkAuth() {
  const userProperties = PropertiesService.getUserProperties();
  const sessionToken = userProperties.getProperty('sessionToken');
  // Simple check: does a session token exist?
  // A more robust implementation would check for token expiration.
  return sessionToken != null;
}

/**
 * Attempts to log the user in.
 * @param {string} username The username.
 * @param {string} password The password.
 * @returns {object} An object with a success status and a redirect URL or error message.
 */
function doLogin(username, password) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const storedUsername = scriptProperties.getProperty('adminUsername');
  const storedPasswordHash = scriptProperties.getProperty('adminPasswordHash');

  const hashedPassword = bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));

  if (username === storedUsername && hashedPassword === storedPasswordHash) {
    const userProperties = PropertiesService.getUserProperties();
    // Create a simple session token. In a real app, use something more secure.
    const sessionToken = 'user_logged_in_' + new Date().getTime();
    userProperties.setProperty('sessionToken', sessionToken);

    return {
      success: true,
      redirectUrl: ScriptApp.getService().getUrl()
    };
  } else {
    return {
      success: false,
      message: 'Usuario o contraseña incorrectos.'
    };
  }
}

/**
 * Logs the user out by deleting the session token.
 */
function doLogout() {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('sessionToken');
}
