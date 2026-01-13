function doGet(e) {
  return HtmlService.createTemplateFromFile('templates/index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates a new Google Sheet to be used as the database and initializes it with the required sheets and headers.
 * Stores the ID of the new spreadsheet in Script Properties.
 *
 * @returns {object} An object with a status message.
 */
function setupDatabase() {
  try {
    // Create a new Spreadsheet
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    // Get the default sheet and rename it to 'Clients'
    const clientsSheet = spreadsheet.getSheetByName('Sheet1');
    clientsSheet.setName('Clients');

    // Set headers for the Clients sheet
    clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);
    clientsSheet.setFrozenRows(1);

    // Create a new sheet for 'Users'
    const usersSheet = spreadsheet.insertSheet('Users');

    // Set headers for the Users sheet
    usersSheet.getRange('A1:D1').setValues([['ID', 'Username', 'PasswordHash', 'Salt']]);
    usersSheet.setFrozenRows(1);

    // Save the Spreadsheet ID in script properties for later use
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    return { status: 'success', message: 'Database created successfully! Spreadsheet ID: ' + spreadsheetId };
  } catch (e) {
    Logger.log(e);
    return { status: 'error', message: 'An error occurred: ' + e.message };
  }
}

// --- Helper Functions ---
function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please run the setup function.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getUsersSheet() {
  return getSpreadsheet().getSheetByName('Users');
}

// --- User Management ---

/**
 * Generates a random string to be used as a salt.
 * @param {number} length The length of the salt.
 * @returns {string} The generated salt.
 */
function generateSalt(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let salt = '';
  for (let i = 0; i < length; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

function registerUser(username, password) {
  const usersSheet = getUsersSheet();
  const data = usersSheet.getDataRange().getValues();

  // Check if username already exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      return { status: 'error', message: 'Username already exists.' };
    }
  }

  const userId = Utilities.getUuid();
  const salt = generateSalt();
  const passwordHash = sha256(password + salt);

  usersSheet.appendRow([userId, username, passwordHash, salt]);

  return { status: 'success', message: 'User registered successfully.' };
}

function loginUser(username, password) {
  const usersSheet = getUsersSheet();
  const data = usersSheet.getDataRange().getValues();
  // Headers: ID, Username, PasswordHash, Salt

  for (let i = 1; i < data.length; i++) {
    const storedUsername = data[i][1];
    const storedHash = data[i][2];
    const salt = data[i][3];

    if (storedUsername === username) {
      const passwordHash = sha256(password + salt);
      if (storedHash === passwordHash) {
        return { status: 'success', message: 'Login successful.' };
      }
    }
  }

  return { status: 'error', message: 'Invalid username or password.' };
}

// --- Client Management ---
function getClientsSheet() {
  return getSpreadsheet().getSheetByName('Clients');
}

function getClients() {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row

  const clients = data.map(row => {
    let client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });

  return clients;
}

function addClient(clientData) {
  const sheet = getClientsSheet();
  const newId = Utilities.getUuid();
  sheet.appendRow([
    newId,
    clientData.name,
    clientData.email,
    clientData.phone,
    clientData.address
  ]);
  clientData.ID = newId; // Return the new ID to the client
  return { status: 'success', client: clientData };
}

function updateClient(clientData) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === clientData.id) { // Check against ID in first column
      sheet.getRange(i + 1, 2, 1, 4).setValues([[
        clientData.name,
        clientData.email,
        clientData.phone,
        clientData.address
      ]]);
      return { status: 'success', message: 'Client updated.' };
    }
  }
  return { status: 'error', message: 'Client not found.' };
}

// --- AI & External Services ---
function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = PropertiesService.getScriptProperties().getProperty('geminiApiKey');

  if (!apiKey) {
    throw new Error('Gemini API key is not set in Script Properties.');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      Logger.log('Unexpected API Response: ' + JSON.stringify(result));
      throw new Error('Could not parse the response from the AI model.');
    }
  } catch (e) {
    Logger.log('Error calling Gemini API: ' + e.toString());
    throw new Error('Failed to generate email draft. Please check the server logs.');
  }
}

function deleteClient(clientId) {
  const sheet = getClientsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === clientId) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Client deleted.' };
    }
  }
  return { status: 'error', message: 'Client not found.' };
}
