const DBNAME = "TimeBillProDB";

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function setup() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets().map(sheet => sheet.getName());

    if (!sheets.includes("Clients")) {
      spreadsheet.insertSheet("Clients");
      const clientsSheet = spreadsheet.getSheetByName("Clients");
      clientsSheet.appendRow(["id", "name", "email", "phone", "address"]);
    }

    return { status: "success", message: "Spreadsheet setup complete." };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

function getClients() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clients");
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const clients = data.map(row => {
      let client = {};
      headers.forEach((header, i) => {
        client[header] = row[i];
      });
      return client;
    });
    return { status: "success", data: clients };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

function addClient(clientData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clients");
    const newId = getNextId(sheet);
    sheet.appendRow([newId, clientData.name, clientData.email, clientData.phone, clientData.address]);
    return { status: "success", message: "Client added successfully.", id: newId };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

function updateClient(clientData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clients");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf("id");

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] == clientData.id) {
        let row = [];
        headers.forEach(header => {
          row.push(clientData[header]);
        });
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return { status: "success", message: "Client updated successfully." };
      }
    }
    return { status: "error", message: "Client not found." };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

function deleteClient(id) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clients");
    const data = sheet.getDataRange().getValues();
    const idIndex = data[0].indexOf("id");

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] == id) {
        sheet.deleteRow(i + 1);
        return { status: "success", message: "Client deleted successfully." };
      }
    }
    return { status: "error", message: "Client not found." };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 1;
  }
  const lastId = sheet.getRange(lastRow, 1).getValue();
  return lastId + 1;
}