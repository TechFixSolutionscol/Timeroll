const C_ = {
  // Script properties
  PROPS_SPREADSHEET_ID: 'spreadsheetId',

  // Sheet names
  SHEET_CLIENTS: 'Clients',
  SHEET_USERS: 'Users',
}

// ==============
// Server
// ==============

const doGet = (e) => {
  return HtmlService
    .createTemplateFromFile('templates/index')
    .evaluate()
    .setTitle('TimeBill Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
}

const include = (filename) => {
  return HtmlService.createHtmlOutputFromFile(filename).getContent()
}

// ==============
// Database
// ==============

const setupDatabase = () => {
  const spreadsheet = SpreadsheetApp.create('TimeBill Pro Database')
  const spreadsheetId = spreadsheet.getId()

  PropertiesService.getScriptProperties().setProperty(C_.PROPS_SPREADSHEET_ID, spreadsheetId)

  const clientsSheet = spreadsheet.insertSheet(C_.SHEET_CLIENTS)
  clientsSheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Address'])

  const usersSheet = spreadsheet.insertSheet(C_.SHEET_USERS)
  usersSheet.appendRow(['Username', 'Password'])
  usersSheet.appendRow(['demo', Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'demo').map(b => (b + 256).toString(16).slice(-2)).join('')])

  SpreadsheetApp.openById(spreadsheetId).deleteSheet(spreadsheet.getSheetByName('Sheet1'))

  return spreadsheetId
}

const getClients = () => {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(C_.PROPS_SPREADSHEET_ID)).getSheetByName(C_.SHEET_CLIENTS)
  const data = sheet.getDataRange().getValues()
  const headers = data.shift()
  return data.map(row => {
    const client = {}
    headers.forEach((header, i) => {
      client[header] = row[i]
    })
    return client
  })
}

const addClient = (clientData) => {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(C_.PROPS_SPREADSHEET_ID)).getSheetByName(C_.SHEET_CLIENTS)
  const newId = Utilities.getUuid()
  sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address])
  return { ...clientData, ID: newId }
}

const updateClient = (clientData) => {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(C_.PROPS_SPREADSHEET_ID)).getSheetByName(C_.SHEET_CLIENTS)
  const data = sheet.getDataRange().getValues()
  const headers = data.shift()
  const rowIndex = data.findIndex(row => row[0] === clientData.id)
  if (rowIndex > -1) {
    const rowValues = [
      clientData.id,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address
    ];
    sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
    return clientData;
  }
  return null;
}

const deleteClient = (clientId) => {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(C_.PROPS_SPREADSHEET_ID)).getSheetByName(C_.SHEET_CLIENTS)
  const data = sheet.getDataRange().getValues()
  const rowIndex = data.findIndex(row => row[0] === clientId)
  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 2)
    return true
  }
  return false
}

const checkUser = (username, password) => {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(C_.PROPS_SPREADSHEET_ID)).getSheetByName(C_.SHEET_USERS)
  const data = sheet.getDataRange().getValues()
  const headers = data.shift()
  const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password).map(b => (b + 256).toString(16).slice(-2)).join('')
  const user = data.find(row => row[0] === username && row[1] === passwordHash)
  return !!user
}

const generateEmailDraft = (invoiceData) => {
  const { client, hours, total } = invoiceData;
  const prompt = `Genera un borrador de correo electrónico profesional y amigable para enviar una factura a un cliente. La sesión duró ${hours.toFixed(2)} horas y el total a pagar es $${total.toFixed(2)}. El cliente se llama ${client.Name} y su correo es ${client.Email}. El correo debe ser conciso, agradecer por la oportunidad y recordar el valor de nuestro servicio. Incluye un saludo y una despedida formales. No incluyas información de contacto más allá del nombre del cliente y el total.`
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  }

  const response = UrlFetchApp.fetch(apiUrl, options)
  const result = JSON.parse(response.getContentText())
  return result.candidates[0].content.parts[0].text
}
