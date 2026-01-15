
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('TimeBill Pro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database');
    const spreadsheetId = spreadsheet.getId();

    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

    const clientsSheet = spreadsheet.getSheetByName('Sheet1');
    clientsSheet.setName('Clients');
    clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);

    const usersSheet = spreadsheet.insertSheet('Users');
    usersSheet.appendRow(['ID', 'Email', 'PasswordHash', 'Salt']);

    return 'Database created successfully!';
  } catch (e) {
    console.error('Error setting up database:', e);
    throw new Error('Failed to set up the database.');
  }
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error('Database not set up. Please click "Setup Database" first.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getClients() {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

function addClient(client) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  client.ID = Utilities.getUuid();
  sheet.appendRow([client.ID, client.Name, client.Email, client.Phone, client.Address]);
}

function updateClient(client) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === client.ID);
  if (rowIndex > -1) {
    sheet.getRange(rowIndex + 1, 1, 1, 5).setValues([[client.ID, client.Name, client.Email, client.Phone, client.Address]]);
  }
}

function deleteClient(id) {
  const sheet = getSpreadsheet().getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] === id);
  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 1);
  }
}

function registerUser(email, password) {
  const sheet = getSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const userExists = data.some(row => row[1] === email);

  if (userExists) {
    return null;
  }

  const salt = Utilities.getUuid();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('');
  const userId = Utilities.getUuid();

  sheet.appendRow([userId, email, hash, salt]);

  return { id: userId, email: email };
}

function loginUser(email, password) {
  const sheet = getSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const userRow = data.find(row => row[1] === email);

  if (!userRow) {
    return null;
  }

  const [userId, storedEmail, storedHash, storedSalt] = userRow;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + storedSalt)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('');

  if (hash === storedHash) {
    return { id: userId, email: storedEmail };
  }

  return null;
}

function generateEmailDraft(clientName, clientEmail, hours, total) {
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${clientName} y su correo es ${clientEmail}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;
  // This is a placeholder for the actual Gemini API call.
  // In a real application, you would use UrlFetchApp to call the Gemini API.
  return `Asunto: Cuenta de Cobro - Servicios de TechFix Solutions\n\nEstimado/a ${clientName},\n\nEspero que te encuentres muy bien.\n\nAdjunto a este correo, te envío la cuenta de cobro por los servicios prestados recientemente. La sesión de trabajo tuvo una duración de ${hours.toFixed(2)} horas, sumando un total de $${total.toFixed(2)}.\n\nAgradezco mucho tu confianza y la oportunidad de colaborar contigo.\n\nQuedo a tu disposición para cualquier consulta.\n\nSaludos cordiales,\n\n[Tu Nombre]\nTechFix Solutions`;
}
