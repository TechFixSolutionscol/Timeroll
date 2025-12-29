# TimeBill Pro Setup Instructions

Follow these steps to set up the Google Sheets database and configure the Google Apps Script project.

## 1. Create the Google Sheet

1.  Go to [sheets.new](https://sheets.new) to create a new Google Sheet.
2.  Rename the spreadsheet to "TimeBill Pro DB".
3.  Create two sheets within the spreadsheet named "Users" and "Clients".
4.  Set up the columns for each sheet as follows:

    **Users sheet:**

    | ID | Name | Email | HashedPassword | Salt |
    | :-- | :--- | :---- | :--- | :--- |

    **Clients sheet:**

    | ID | Name | Email | Phone | Address |
    | :-- | :--- | :---- | :--- | :--- |

## 2. Get the Spreadsheet ID

1.  Open the "TimeBill Pro DB" Google Sheet.
2.  The URL in your browser's address bar will look like this: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3.  Copy the `SPREADSHEET_ID` value from the URL.

## 3. Configure the Google Apps Script Project

1.  Open the `Code.gs` file in your Google Apps Script editor.
2.  Go to **Project Settings** > **Script Properties**.
3.  Add a new script property:
    *   **Property:** `SPREADSHEET_ID`
    *   **Value:** Paste the Spreadsheet ID you copied in the previous step.
