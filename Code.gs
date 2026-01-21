function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TimeBill Pro')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('TimeBill Pro')
      .addItem('Setup Database', 'setupDatabase')
      .addToUi();
}

const PASSWORD_SALT = "a417b895-9c29-42b7-8671-570711f4d2de"; // Static salt for this application

function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + PASSWORD_SALT);
  return digest.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
}

function setupDatabase() {
  const SPREADSHEET_NAME = "TimeBillPro_DB";
  var spreadsheet;

  // Check if file exists by name in root folder
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  }

  const spreadsheetId = spreadsheet.getId();
  PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheetId);

  let clientsSheet = spreadsheet.getSheetByName("Clients");
  if (!clientsSheet) {
    clientsSheet = spreadsheet.insertSheet("Clients");
    clientsSheet.appendRow(["ID", "Name", "Email", "Phone", "Address"]);
    clientsSheet.getRange("A1:E1").setFontWeight("bold");
    clientsSheet.setFrozenRows(1);
  }

  let usersSheet = spreadsheet.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = spreadsheet.insertSheet("Users");
    usersSheet.appendRow(["Username", "PasswordHash"]);
    usersSheet.getRange("A1:B1").setFontWeight("bold");
    usersSheet.setFrozenRows(1);
    // Add a default user with a hashed password
    const defaultPasswordHash = hashPassword("admin");
    usersSheet.appendRow(["admin", defaultPasswordHash]);
  }

  SpreadsheetApp.getUi().alert(`Database setup complete. Spreadsheet URL: ${spreadsheet.getUrl()}`);
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (!spreadsheetId) {
    throw new Error("Spreadsheet ID not set. Please run 'Setup Database' first.");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getClients() {
  const sheet = getSpreadsheet().getSheetByName("Clients");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.map(row => {
    let client = {};
    headers.forEach((header, i) => {
      client[header] = row[i];
    });
    return client;
  });
}

function getNextId() {
    const sheet = getSpreadsheet().getSheetByName("Clients");
    const ids = sheet.getRange("A2:A").getValues().flat().filter(String);
    return ids.length ? Math.max(...ids) + 1 : 1;
}


function addClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName("Clients");
  const newId = getNextId();
  // Ensure the data is in the correct order as per the sheet columns
  sheet.appendRow([newId, clientData.Name, clientData.Email, clientData.Phone, clientData.Address]);

  // Return a consistent object with capitalized keys
  return {
    ID: newId,
    Name: clientData.Name,
    Email: clientData.Email,
    Phone: clientData.Phone,
    Address: clientData.Address
  };
}

function updateClient(clientData) {
  const sheet = getSpreadsheet().getSheetByName("Clients");
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientData.ID);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 2).setValue(clientData.Name);
    sheet.getRange(rowIndex + 1, 3).setValue(clientData.Email);
    sheet.getRange(rowIndex + 1, 4).setValue(clientData.Phone);
    sheet.getRange(rowIndex + 1, 5).setValue(clientData.Address);
    return { success: true, client: clientData };
  }
  return { success: false, message: "Client not found." };
}

function deleteClient(clientId) {
  const sheet = getSpreadsheet().getSheetByName("Clients");
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == clientId);

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
    return { success: true, message: "Client deleted successfully." };
  }
  return { success: false, message: "Client not found." };
}

function checkLogin(username, password) {
    const sheet = getSpreadsheet().getSheetByName("Users");
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove headers
    const passwordHashIndex = headers.indexOf("PasswordHash");

    const providedPasswordHash = hashPassword(password);

    for (let i = 0; i < data.length; i++) {
        if (data[i][0] === username && data[i][passwordHashIndex] === providedPasswordHash) {
            return { success: true };
        }
    }
    return { success: false, message: "Invalid credentials." };
}

function getGeminiApiKey() {
  return PropertiesService.getScriptProperties().getProperty('geminiApiKey');
}

function generateEmailDraft(invoiceData) {
  const { client, hours, total } = invoiceData;
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return { success: false, message: "API key for Gemini not set in Script Properties." };
  }

  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent?key=${apiKey}`;

  const payload = {
    "contents": [{
      "parts": [{ "text": prompt }]
    }]
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      return { success: true, draft: text };
    } else {
      return { success: false, message: 'Could not generate email draft.' };
    }
  } catch (e) {
    return { success: false, message: 'API call failed: ' + e.toString() };
  }
}
