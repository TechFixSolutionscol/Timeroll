// Instrucciones en `index.html`
const SCRIPT_PROP = PropertiesService.getScriptProperties();

function setup() {
  const sheet = SpreadsheetApp.openByUrl(SCRIPT_PROP.getProperty("SPREADSHEET_URL"));

  const clientsSheet = sheet.getSheetByName('Clients') || sheet.insertSheet('Clients');
  clientsSheet.getRange('A1:E1').setValues([['ID', 'Name', 'Email', 'Phone', 'Address']]);

  const invoicesSheet = sheet.getSheetByName('Invoices') || sheet.insertSheet('Invoices');
  invoicesSheet.getRange('A1:E1').setValues([['Date', 'Client', 'Hours', 'Rate', 'Total']]);

  return { status: 'success', message: 'Tables created successfully' };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = SpreadsheetApp.openByUrl(SCRIPT_PROP.getProperty("SPREADSHEET_URL"));
    const { action, payload } = JSON.parse(e.postData.contents);
    let response;

    switch (action) {
      case 'setup':
        response = setup();
        break;
      case 'getClients':
        response = getClients(sheet);
        break;
      case 'addClient':
        response = addClient(sheet, payload);
        break;
      case 'updateClient':
        response = updateClient(sheet, payload);
        break;
      case 'deleteClient':
        response = deleteClient(sheet, payload);
        break;
      case 'addInvoice':
        response = addInvoice(sheet, payload);
        break;
      case 'generateEmailDraft':
        response = generateEmailDraft(payload);
        break;
      default:
        response = { status: 'error', message: 'Invalid action' };
    }

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getClients(sheet) {
  const clientsSheet = sheet.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const clients = data.slice(1).map(row => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4]
  }));
  return { status: 'success', data: clients };
}

function addClient(sheet, client) {
  const clientsSheet = sheet.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const maxId = data.slice(1).reduce((max, row) => Math.max(max, row[0]), 0);
  const newId = maxId + 1;
  clientsSheet.appendRow([newId, client.name, client.email, client.phone, client.address]);
  return { status: 'success', data: { ...client, id: newId } };
}

function updateClient(sheet, client) {
  const clientsSheet = sheet.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == client.id);
  if (rowIndex > 0) {
    clientsSheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[client.name, client.email, client.phone, client.address]]);
    return { status: 'success', data: client };
  }
  return { status: 'error', message: 'Client not found' };
}

function deleteClient(sheet, { id }) {
  const clientsSheet = sheet.getSheetByName('Clients');
  const data = clientsSheet.getDataRange().getValues();
  const rowIndex = data.findIndex(row => row[0] == id);
  if (rowIndex > 0) {
    clientsSheet.deleteRow(rowIndex + 1);
    return { status: 'success' };
  }
  return { status: 'error', message: 'Client not found' };
}

function addInvoice(sheet, invoice) {
  const invoicesSheet = sheet.getSheetByName('Invoices');
  invoicesSheet.appendRow([
    new Date(),
    invoice.client.name,
    invoice.hours,
    invoice.rate,
    invoice.total
  ]);
  return { status: 'success' };
}

function generateEmailDraft(data) {
    const { client, hours, total } = data;
    const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.name} y su correo es ${client.email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`;

    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiKey = SCRIPT_PROP.getProperty("GEMINI_API_KEY");
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

        const response = UrlFetchApp.fetch(apiUrl, {
            method: 'POST',
            contentType: 'application/json',
            payload: JSON.stringify(payload)
        });

        const result = JSON.parse(response.getContentText());
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            return { status: 'success', data: text };
        } else {
            return { status: 'error', message: 'No se pudo generar el borrador de correo.' };
        }
    } catch (error) {
        return { status: 'error', message: 'Error al llamar a la API de Gemini: ' + error.message };
    }
}
