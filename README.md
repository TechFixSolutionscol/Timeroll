# TimeBill Pro - Google Apps Script Invoicing App

TimeBill Pro is a time-tracking and invoicing application built entirely on the Google Apps Script platform, using a Google Sheet as its database. It allows users to manage clients, track time spent on projects, and generate invoices.

This project was a complete refactoring of a static HTML/JavaScript application into a full-stack web app powered by Google Apps Script.

## Features

- **User Authentication:** Secure user registration and login system.
- **Database Backend:** Uses a Google Sheet for all data storage (users and clients).
- **Automated Setup:** A simple, one-click process to create and initialize the Google Sheet database.
- **Client Management:** Full CRUD (Create, Read, Update, Delete) functionality for clients.
- **Time Tracking:** A stopwatch-style timer to accurately record billable hours.
- **Invoice Generation:** Automatically calculates the total amount based on time and hourly rate.
- **Dark Mode:** A toggle for user interface preference.

## Setup Instructions

To deploy your own instance of TimeBill Pro, follow these steps:

### 1. Create the Google Apps Script Project

1.  Go to the Google Apps Script dashboard: [script.google.com](https://script.google.com)
2.  Click **New project**.
3.  Give your project a name (e.g., "TimeBill Pro").

### 2. Add the Project Files

You will need to copy the code from this repository into your Apps Script project.

1.  **`Code.gs`:** Delete the default `Code.gs` content and replace it with the content of `Code.gs` from this repository.
2.  **`index.html`:** Click the **+** icon and select **HTML**. Name the file `index` and paste the content of `index.html` from this repository.
3.  **`scripts.html`:** Click the **+** icon and select **HTML**. Name the file `scripts` and paste the content of `scripts.html`.
4.  **`styles.html`:** Click the **+** icon and select **HTML**. Name the file `styles` and paste the content of `styles.html`.

### 3. Deploy as a Web App

1.  Click the **Deploy** button in the top right corner and select **New deployment**.
2.  Click the gear icon next to "Select type" and choose **Web app**.
3.  In the configuration, set the following:
    *   **Description:** (Optional) A description for your deployment.
    *   **Execute as:** "Me"
    *   **Who has access:** "Anyone with Google account" (or "Anyone" if you want it to be public).
4.  Click **Deploy**.
5.  **Important:** Google will ask you to authorize the script's permissions. Click **Authorize access**, choose your Google account, and grant the necessary permissions. The script needs access to Google Sheets to function.
6.  A URL will be provided for your deployed web app. This is the URL you will use to access the application.

### 4. Initial Application Setup

1.  Open the web app URL you received after deployment.
2.  You will see a "Configuration Required" screen.
3.  Click the **"Configurar Base de Datos"** button. This will automatically create a new Google Sheet in your Google Drive named "TimeBill Pro Database" and set it up with the required "Users" and "Clients" tables.
4.  Once the setup is complete, the page will reload.

### 5. Create an Account and Log In

1.  After the page reloads, you will be presented with the login/registration screen.
2.  Create your user account.
3.  Log in to start using the application.

You are now ready to use TimeBill Pro!