
module.exports = {
  nodes: [
    {
      parameters: {},
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [250, 300]
    },
    {
      parameters: {
        url: "https://api.ejemplo.com/data",
        method: "GET",
        options: {}
      },
      name: "HTTP Request",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.1,
      position: [450, 300]
    },
    {
      parameters: {
        functionCode: "const items = $input.all();\nconst filtered = items.filter(item => {\n  const data = item.json;\n  return data.status === 'active';\n});\nreturn filtered;"
      },
      name: "Function",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [650, 300]
    },
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: "={{$json.priority}}",
              operation: "equals",
              value2: "high"
            }
          ]
        }
      },
      name: "IF",
      type: "n8n-nodes-base.if",
      typeVersion: 1,
      position: [850, 300]
    },
    {
      parameters: {
        operation: "append",
        documentId: "={{$env.GOOGLE_SHEET_ID}}",
        sheetName: "Sheet1",
        columns: {
          mappingMode: "defineBelow",
          value: {
            id: "={{$json.id}}",
            name: "={{$json.name}}",
            status: "={{$json.status}}",
            priority: "={{$json.priority}}"
          }
        },
        options: {}
      },
      name: "Google Sheets",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4,
      position: [1050, 200]
    },
    {
      parameters: {
        operation: "append",
        documentId: "={{$env.GOOGLE_SHEET_ID}}",
        sheetName: "Sheet2",
        columns: {
          mappingMode: "defineBelow",
          value: {
            id: "={{$json.id}}",
            name: "={{$json.name}}",
            status: "={{$json.status}}"
          }
        },
        options: {}
      },
      name: "Google Sheets Low Priority",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4,
      position: [1050, 400]
    }
  ],
  connections: {
    "Manual Trigger": {
      main: [
        [
          {
            node: "HTTP Request",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "HTTP Request": {
      main: [
        [
          {
            node: "Function",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Function": {
      main: [
        [
          {
            node: "IF",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "IF": {
      main: [
        [
          {
            node: "Google Sheets",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "Google Sheets Low Priority",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  }
};

