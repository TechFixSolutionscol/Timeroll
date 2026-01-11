function doGet() {
  return HtmlService.createTemplateFromFile('templates/index').evaluate()
      .setTitle('TimeBill Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates the Google Sheet database and sets up initial data.
 * This function is called from the frontend.
 */
function setupDatabase() {
  try {
    // Create a new spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Get the default sheet and rename it to 'Clients'
    const clientsSheet = spreadsheet.getSheets()[0];
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    // Create a 'Users' sheet
    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Name', 'Email', 'PasswordHash', 'Salt']);

    // Add a default admin user with a random password and salt
    const adminPassword = Math.random().toString(36).slice(-10);
    const salt = Utilities.getUuid();
    const adminPasswordHash = hashPassword(adminPassword, salt);
    usersSheet.appendRow([
      Utilities.getUuid(),
      'Admin',
      'admin@example.com',
      adminPasswordHash,
      salt
    ]);

    // Store the spreadsheet ID in script properties
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    return {
      success: true,
      message: 'Database created successfully!',
      adminPassword: adminPassword // Return the generated password
    };
  } catch (e) {
    Logger.log(e);
    return { success: false, message: 'An error occurred: ' + e.message };
  }
}

// --- Client CRUD Operations ---

/**
 * Helper function to get the Clients sheet.
 */
function _getClientSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not set up.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return spreadsheet.getSheetByName('Clients');
}

/**
 * Fetches all clients from the Google Sheet.
 */
function getClients() {
  try {
    const sheet = _getClientSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });

    return { success: true, clients: clients };
  } catch (e) {
    Logger.log(e);
    return { success: false, message: e.message };
  }
}

/**
 * Adds a new client to the Google Sheet.
 * @param {object} clientData The client's data.
 */
function addClient(clientData) {
  try {
    const sheet = _getClientSheet();
    const newId = Utilities.getUuid();
    sheet.appendRow([
      newId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ]);
    return { success: true, newClientId: newId };
  } catch (e) {
    Logger.log(e);
    return { success: false, message: e.message };
  }
}

/**
 * Updates an existing client in the Google Sheet.
 * @param {object} clientData The client's data, including ID.
 */
function updateClient(clientData) {
  try {
    const sheet = _getClientSheet();
    const data = sheet.getDataRange().getValues();

    // Find the row index for the given client ID
    const rowIndex = data.findIndex(row => row[0] === clientData.id);

    if (rowIndex > 0) { // rowIndex > 0 to avoid header
      sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[
        clientData.name,
        clientData.email,
        clientData.phone,
        clientData.address
      ]]);
      return { success: true };
    } else {
      return { success: false, message: 'Client not found.' };
    }
  } catch (e) {
    Logger.log(e);
    return { success: false, message: e.message };
  }
}

/**
 * Deletes a client from the Google Sheet.
 * @param {string} clientId The ID of the client to delete.
 */
function deleteClient(clientId) {
  try {
    const sheet = _getClientSheet();
    const data = sheet.getDataRange().getValues();

    const rowIndex = data.findIndex(row => row[0] === clientId);

    if (rowIndex > 0) { // rowIndex > 0 to avoid header
      sheet.deleteRow(rowIndex + 1);
      return { success: true };
    } else {
      return { success: false, message: 'Client not found.' };
    }
  } catch (e) {
    Logger.log(e);
    return { success: false, message: e.message };
  }
}

/**
 * Hashes a password with a salt using SHA-256.
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @return {string} The hashed password, encoded as a hex string.
 */
function hashPassword(password, salt) {
  const saltedPassword = password + salt; // Combine password and salt
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedPassword, Utilities.Charset.UTF_8);
  return digest.map(byte => {
    const hex = (byte & 0xFF).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Generates an email draft using the Gemini API.
 * @param {object} invoiceData The data for the invoice.
 * @return {object} The result from the API call.
 */
function generateEmailDraftBackend(invoiceData) {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');
    if (!apiKey) {
      return { success: false, message: "API key for Gemini not found in Script Properties." };
    }

    let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    } else {
      Logger.log("Gemini API Error Response: " + JSON.stringify(result));
      return { success: false, message: 'No se pudo generar el borrador de correo.' };
    }
  } catch (error) {
    Logger.log('Error al llamar a la API de Gemini: ' + error.toString());
    return { success: false, message: 'Error al generar el borrador: ' + error.message };
  }
}

/**
 * Authenticates a user.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 * @return {object} An object with a success status and a message.
 */
function login(email, password) {
  try {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    if (!spreadsheetId) {
      return { success: false, message: 'Database not set up. Please set it up first.' };
    }
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const usersSheet = spreadsheet.getSheetByName('Users');
    const users = usersSheet.getDataRange().getValues();

    // Remove header row
    users.shift();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userEmail = user[2];
      const storedHash = user[3];
      const salt = user[4];

      if (userEmail === email) {
        const passwordHash = hashPassword(password, salt);
        if (storedHash === passwordHash) {
          return { success: true, message: 'Login successful!', user: { name: user[1], email: user[2] } };
        }
      }
    }

    return { success: false, message: 'Invalid email or password.' };
  } catch (e) {
    Logger.log(e);
    return { success: false, message: 'An error occurred: ' + e.message };
  }
}
