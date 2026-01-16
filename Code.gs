function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates a new Google Sheet to be used as the database and initializes it with the required sheets and headers.
 * This function is intended to be called once from the client-side UI.
 * @returns {string} A success message with the URL of the new spreadsheet.
 */
function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro - Database');
    const spreadsheetId = spreadsheet.getId();

    // Set up Clients sheet
    const clientsSheet = spreadsheet.getSheetByName('Sheet1');
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.setFrozenRows(1);

    // Set up Users sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Email', 'PasswordHash', 'PasswordSalt']);
    usersSheet.setFrozenRows(1);

    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    return `Database created successfully! You can view it here: ${spreadsheet.getUrl()}`;
  } catch (e) {
    return `Error setting up database: ${e.toString()}`;
  }
}

/**
 * Helper function to get the active spreadsheet.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
 * @throws {Error} If the database has not been set up.
 */
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please click the "Setup Database" button.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Registers a new user.
 * @param {string} email The user's email.
 * @param {string} password The user's plain-text password.
 * @returns {object} A success or error message.
 */
function registerUser(email, password) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Users');
    const salt = Utilities.getUuid();
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('');

    sheet.appendRow([Utilities.getUuid(), email, hash, salt]);
    return { success: true, message: 'User registered successfully.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Retrieves all clients from the spreadsheet.
 * @returns {Array<Object>} An array of client objects.
 */
function getClients() {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

/**
 * Adds a new client to the spreadsheet.
 * @param {Object} clientData The client's data.
 * @returns {object} The newly added client.
 */
function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const newId = Utilities.getUuid();
  const newRow = [newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address];
  sheet.appendRow(newRow);
  return {
    ID: newId,
    Name: clientData.Name,
    Email: clientData.Email,
    Phone: clientData.Phone,
    Address: clientData.Address
  };
}

/**
 * Updates an existing client's data.
 * @param {Object} clientData The client's data, including ID.
 * @returns {object} The updated client.
 */
function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clientData.ID) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[clientData.Name, clientData.Email, clientData.Phone, clientData.Address]]);
      return clientData;
    }
  }
  throw new Error('Client not found');
}

/**
 * Generates an email draft for an invoice.
 * NOTE: This is a placeholder and does not call the Gemini API.
 * @param {string} clientName The client's name.
 * @param {string} clientEmail The client's email.
 * @param {number} hours The number of hours worked.
 * @param {number} total The total amount to be invoiced.
 * @returns {string} The generated email draft.
 */
function generateEmailDraft(clientName, clientEmail, hours, total) {
  const prompt = `Asunto: Cuenta de Cobro por Servicios Profesionales

Estimado/a ${clientName},

Espero que este correo te encuentre muy bien.

Adjunto a este mensaje, te envío la cuenta de cobro por los servicios profesionales prestados recientemente. A continuación, te presento un resumen detallado de la sesión:

- **Duración de la Sesión:** ${hours.toFixed(2)} horas
- **Valor Total a Pagar:** $${total.toFixed(2)}

Agradezco de antemano tu confianza en mi trabajo. Ha sido un placer colaborar contigo y espero que sigamos trabajando juntos en futuros proyectos.

Si tienes alguna pregunta o necesitas alguna aclaración, no dudes en contactarme.

Saludos cordiales,

[Tu Nombre]
[Tu Cargo/Profesión]`;

  return prompt;
}

/**
 * Deletes a client from the spreadsheet.
 * @param {string} clientId The ID of the client to delete.
 * @returns {object} A success message.
 */
function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clientId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Client deleted successfully.' };
    }
  }
  throw new Error('Client not found');
}

/**
 * Logs in a user.
 * @param {string} email The user's email.
 * @param {string} password The user's plain-text password.
 * @returns {object} A success or error message, and user data if successful.
 */
function loginUser(email, password) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === email) {
        const salt = data[i][3];
        const storedHash = data[i][2];
        const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
          .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
          .join('');

        if (hash === storedHash) {
          return { success: true, message: 'Login successful.', user: { email: data[i][1] } };
        }
      }
    }
    return { success: false, message: 'Invalid email or password.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
