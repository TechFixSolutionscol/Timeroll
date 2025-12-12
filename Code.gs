const SHEET_ID = "ID_DE_TU_HOJA_DE_CÁLCULO"; // Reemplaza con el ID de tu hoja de cálculo
const db = SpreadsheetApp.openById(SHEET_ID);

function doGet(e) {
  // GET solo se usa para obtener datos de forma segura
  if (e.parameter.action === 'getClients') {
    return getClients();
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Acción GET no válida' })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  switch (data.action) {
    case 'setup':
      return setup();
    case 'login':
      return login(data.username, data.password);
    case 'addClient':
      return addClient(data.client);
    case 'editClient':
      return editClient(data.client);
    case 'deleteClient':
      return deleteClient(data.id);
    case 'getClients':
       return getClients();
    default:
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Acción POST no válida' })).setMimeType(ContentService.MimeType.JSON);
  }
}

function setup() {
  try {
    const usersSheet = db.getSheetByName('Users') || db.insertSheet('Users');
    usersSheet.clear().appendRow(['ID', 'Username', 'Password']);
    usersSheet.appendRow([1, 'admin', 'admin123']);
    const clientsSheet = db.getSheetByName('Clients') || db.insertSheet('Clients');
    clientsSheet.clear().appendRow(['ID', 'Name', 'Email', 'Phone', 'Address']);
    clientsSheet.appendRow([1, 'Cliente de Ejemplo', 'c@e.com', '123', 'Calle Falsa 123']);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Tablas creadas.' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function login(username, password) {
  // ALERTA DE SEGURIDAD: ¡Nunca almacenes contraseñas en texto plano en producción!
  // Esto es solo para fines de demostración. Considera usar un sistema de autenticación real.
  const users = db.getSheetByName('Users').getDataRange().getValues();
  const user = users.find(u => u[1] === username && u[2] === password);
  if (user) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', user: { id: user[0], username: user[1] } })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Credenciales incorrectas' })).setMimeType(ContentService.MimeType.JSON);
}

function getClients() {
  const data = db.getSheetByName('Clients').getDataRange().getValues();
  data.shift(); // Remover encabezados
  const clients = data.map(r => ({ id: r[0], name: r[1], email: r[2], phone: r[3], address: r[4] }));
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', clients })).setMimeType(ContentService.MimeType.JSON);
}

function addClient(client) {
    const sheet = db.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const maxId = data.reduce((max, row) => Math.max(max, row[0] || 0), 0);
    const newId = maxId + 1;
    sheet.appendRow([newId, client.name, client.email, client.phone, client.address]);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: newId })).setMimeType(ContentService.MimeType.JSON);
}

function editClient(client) {
    const sheet = db.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] == client.id);
    if (rowIndex > -1) {
      sheet.getRange(rowIndex + 1, 2, 1, 4).setValues([[client.name, client.email, client.phone, client.address]]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Cliente no encontrado' })).setMimeType(ContentService.MimeType.JSON);
}

function deleteClient(id) {
    const sheet = db.getSheetByName('Clients');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] == id);
    if (rowIndex > -1) {
      sheet.deleteRow(rowIndex + 1);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Cliente no encontrado' })).setMimeType(ContentService.MimeType.JSON);
}
