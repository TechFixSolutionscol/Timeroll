const_ = {
  // Script properties
  PROPS: PropertiesService.getScriptProperties(),
  // App settings
  APP_NAME: 'TimeBill Pro',
  // Spreadsheet settings
  SS_ID_KEY: 'spreadsheetId',
  // Gemini API settings
  GEMINI_API_KEY: 'GEMINI_API_KEY'
};

/**
 * Serves the HTML of the web app.
 * @param {GoogleAppsScript.Events.DoGet} e The event parameter for a simple get request.
 * @returns {HtmlOutput} The HTML to be served.
 */
function doGet(e) {
  const title = const_.APP_NAME;
  const html = HtmlService.createTemplateFromFile('index').evaluate();
  html.setTitle(title);
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  html.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

/**
 * Includes the content of another HTML file.
 * @param {string} filename The name of the file to be included.
 * @returns {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Sets up the Google Sheet to be used as a database.
 * @returns {string} The ID of the spreadsheet.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.create('TimeBill Pro Database');
  const spreadsheetId = ss.getId();
  const_.PROPS.setProperty(const_.SS_ID_KEY, spreadsheetId);

  // Set up the Clients table
  const clientsSheet = ss.getSheets()[0];
  clientsSheet.setName('Clients');
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
  clientsSheet.setFrozenRows(1);

  // Set up the Users table
  const usersSheet = ss.insertSheet('Users');
  usersSheet.appendRow(['ID', 'Name', 'Email', 'Password', 'Salt']);
  usersSheet.setFrozenRows(1);

  return spreadsheetId;
}

/**
 * Gets the spreadsheet.
 * @returns {Spreadsheet} The spreadsheet.
 */
function _getSpreadsheet() {
  const spreadsheetId = const_.PROPS.getProperty(const_.SS_ID_KEY);
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID not found. Please set it up first.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Gets the clients from the spreadsheet.
 * @returns {Array} The clients.
 */
function getClients() {
  const sheet = _getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  if (!headers) {
    return [];
  }
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header.toLowerCase()] = row[i];
    });
    return client;
  });
}

/**
 * Adds a client to the spreadsheet.
 * @param {Object} client The client to be added.
 * @returns {Object} The added client.
 */
function addClient(client) {
  const sheet = _getSpreadsheet().getSheetByName('Clients');
  const newId = Utilities.getUuid();
  const newRow = [newId, client.name, client.email, client.phone, client.address];
  sheet.appendRow(newRow);
  return getClients();
}

/**
 * Updates a client in the spreadsheet.
 * @param {Object} client The client to be updated.
 * @returns {Object} The updated client.
 */
function updateClient(client) {
  const sheet = _getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idIndex = headers.indexOf('ID');
  const rowIndex = data.findIndex(row => row[idIndex] === client.id);
  if (rowIndex === -1) {
    throw new Error('Client not found.');
  }
  const newRow = [client.id, client.name, client.email, client.phone, client.address];
  sheet.getRange(rowIndex + 2, 1, 1, newRow.length).setValues([newRow]);
  return getClients();
}

/**
 * Deletes a client from the spreadsheet.
 * @param {string} id The ID of the client to be deleted.
 * @returns {string} The ID of the deleted client.
 */
function deleteClient(id) {
  const sheet = _getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idIndex = headers.indexOf('ID');
  const rowIndex = data.findIndex(row => row[idIndex] === id);
  if (rowIndex === -1) {
    throw new Error('Client not found.');
  }
  sheet.deleteRow(rowIndex + 2);
  return getClients();
}

/**
 * Generates an email draft using the Gemini API.
 * @param {Object} invoiceData The invoice data.
 * @returns {string} The email draft.
 */
function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const apiKey = const_.PROPS.getProperty(const_.GEMINI_API_KEY);
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please set it up in the script properties.');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      return 'No se pudo generar el borrador de correo. Inténtalo de nuevo.';
    }
  } catch (error) {
    console.error('Error al llamar a la API de Gemini:', error);
    return 'Error al generar el borrador. Por favor, revisa tu conexión y la configuración de la API.';
  }
}

/**
 * Hashes a password with a salt.
 * @param {string} password The password to hash.
 * @param {string} salt The salt.
 * @returns {string} The hashed password.
 */
function _hashPassword(password, salt) {
  const toHash = password + salt;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Registers a new user.
 * @param {Object} user The user to register.
 * @returns {Object} The registered user.
 */
function registerUser(user) {
  const sheet = _getSpreadsheet().getSheetByName('Users');
  const salt = Utilities.getUuid();
  const hashedPassword = _hashPassword(user.password, salt);
  const newId = Utilities.getUuid();
  const newRow = [newId, user.name, user.email, hashedPassword, salt];
  sheet.appendRow(newRow);
  return { id: newId, name: user.name, email: user.email };
}

/**
 * Logs in a user.
 * @param {Object} credentials The user's credentials.
 * @returns {Object} The logged in user.
 */
function loginUser(credentials) {
  const sheet = _getSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const emailIndex = headers.indexOf('Email');
  const passwordIndex = headers.indexOf('Password');
  const saltIndex = headers.indexOf('Salt');

  const userRow = data.find(row => row[emailIndex] === credentials.email);
  if (!userRow) {
    throw new Error('Invalid email or password.');
  }

  const hashedPassword = _hashPassword(credentials.password, userRow[saltIndex]);
  if (hashedPassword !== userRow[passwordIndex]) {
    throw new Error('Invalid email or password.');
  }

  return {
    id: userRow[headers.indexOf('ID')],
    name: userRow[headers.indexOf('Name')],
    email: userRow[headers.indexOf('Email')]
  };
}
