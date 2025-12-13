const SCRIPT_PROP = PropertiesService.getScriptProperties();

function doGet(e) {
  const op = e.parameter.action;
  const ss = SpreadsheetApp.openByUrl(SCRIPT_PROP.getProperty("SPREADSHEET_URL"));

  if (op === "getClients") {
    const ws = ss.getSheetByName("Clients");
    const data = ws.getRange("A2:E" + ws.getLastRow()).getValues();
    const clients = data.map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      phone: row[3],
      address: row[4]
    }));
    return ContentService.createTextOutput(JSON.stringify(clients)).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput("Unsupported action").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const op = e.parameter.action;
  const ss = SpreadsheetApp.openByUrl(SCRIPT_PROP.getProperty("SPREADSHEET_URL"));

  if (op === "setup") {
    return setup(ss);
  }

  const data = JSON.parse(e.postData.contents);

  if (op === "addClient") {
    return addClient(ss, data);
  }

  if (op === "updateClient") {
    return updateClient(ss, data);
  }

  if (op === "deleteClient") {
    return deleteClient(ss, data.id);
  }

  if (op === "saveInvoice") {
    return saveInvoice(ss, data);
  }

  if (op === "generateEmail") {
    return generateEmail(data);
  }

  return ContentService.createTextOutput("Unsupported action").setMimeType(ContentService.MimeType.TEXT);
}

function setup(ss) {
  const sheetNames = ["Clients", "Invoices"];
  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });

  const clientsSheet = ss.getSheetByName("Clients");
  clientsSheet.getRange("A1:E1").setValues([["ID", "Name", "Email", "Phone", "Address"]]);
  clientsSheet.getRange("A:A").setNumberFormat('@');

  const invoicesSheet = ss.getSheetByName("Invoices");
  invoicesSheet.getRange("A1:F1").setValues([["ID", "Client ID", "Date", "Duration (Hours)", "Rate", "Total"]]);
  invoicesSheet.getRange("A:A").setNumberFormat('@');

  return ContentService.createTextOutput("Setup complete").setMimeType(ContentService.MimeType.TEXT);
}

function getNextId(ws) {
  const lastRow = ws.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const ids = ws.getRange("A2:A" + lastRow).getValues();
  const maxId = ids.reduce((max, row) => Math.max(max, row[0]), 0);
  return maxId + 1;
}

function addClient(ss, clientData) {
  const ws = ss.getSheetByName("Clients");
  const newId = getNextId(ws);
  ws.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
  return ContentService.createTextOutput(JSON.stringify({ id: newId })).setMimeType(ContentService.MimeType.JSON);
}

function updateClient(ss, clientData) {
  const ws = ss.getSheetByName("Clients");
  const data = ws.getRange("A2:A" + ws.getLastRow()).getValues();
  let rowNumber = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == clientData.id) {
      rowNumber = i + 2;
      break;
    }
  }
  if (rowNumber !== -1) {
    ws.getRange(rowNumber, 2, 1, 4).setValues([[clientData.name, clientData.email, clientData.phone, clientData.address]]);
    return ContentService.createTextOutput("Client updated").setMimeType(ContentService.MimeType.TEXT);
  }
  return ContentService.createTextOutput("Client not found").setMimeType(ContentService.MimeType.TEXT);
}

function deleteClient(ss, clientId) {
  const ws = ss.getSheetByName("Clients");
  const data = ws.getRange("A2:A" + ws.getLastRow()).getValues();
  let rowNumber = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == clientId) {
      rowNumber = i + 2;
      break;
    }
  }
  if (rowNumber !== -1) {
    ws.deleteRow(rowNumber);
    return ContentService.createTextOutput("Client deleted").setMimeType(ContentService.MimeType.TEXT);
  }
  return ContentService.createTextOutput("Client not found").setMimeType(ContentService.MimeType.TEXT);
}

function saveInvoice(ss, invoiceData) {
  const ws = ss.getSheetByName("Invoices");
  const newId = getNextId(ws);
  ws.appendRow([newId, invoiceData.client.id, new Date(), invoiceData.hours, invoiceData.rate, invoiceData.total]);
  return ContentService.createTextOutput("Invoice saved").setMimeType(ContentService.MimeType.TEXT);
}

function generateEmail(invoiceData) {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

  const GEMINI_API_KEY = SCRIPT_PROP.getProperty("GEMINI_API_KEY");
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const result = JSON.parse(response.getContentText());
  const text = result.candidates[0].content.parts[0].text;

  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}

function test() {
  Logger.log("Test execution");
}