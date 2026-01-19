import re

# Leer los archivos de plantilla
with open('index.html', 'r') as f:
    index_content = f.read()
with open('templates/styles.html', 'r') as f:
    styles_content = f.read()
with open('templates/scripts.html', 'r') as f:
    scripts_content = f.read()

# Reemplazar los includes de Apps Script con el contenido real
combined_html = index_content.replace("<?!= include('templates/styles'); ?>", f"<style>{styles_content}</style>")
combined_html = combined_html.replace("<?!= include('templates/scripts'); ?>", f"<script>{scripts_content}</script>")

# Inyectar el mock de google.script.run
mock_script = """
<script>
  // Mock google.script.run for local testing
  window.google = {
    script: {
      run: {
        withSuccessHandler: function(handler) {
          this.successHandler = handler;
          return this;
        },
        withFailureHandler: function(handler) {
          this.failureHandler = handler;
          return this;
        },
        getClients: function() {
          const mockClients = [
            { ID: 1, Name: 'Mock Client 1', Email: 'test1@example.com', Phone: '12345', Address: 'Addr 1' },
            { ID: 2, Name: 'Mock Client 2', Email: 'test2@example.com', Phone: '67890', Address: 'Addr 2' }
          ];
          this.successHandler(mockClients);
        },
        addClient: function(clientData) {
          // Simulate adding a client and returning the updated list
          const mockClients = [
            { ID: 1, Name: 'Mock Client 1', Email: 'test1@example.com', Phone: '12345', Address: 'Addr 1' },
            { ID: 2, Name: 'Mock Client 2', Email: 'test2@example.com', Phone: '67890', Address: 'Addr 2' },
            { ID: 3, Name: clientData.name, Email: clientData.email, Phone: clientData.phone, Address: clientData.address }
          ];
          this.successHandler(mockClients);
        },
        updateClient: function(clientData) {
            // Simulate updating and returning the list
             const mockClients = [
                { ID: 1, Name: clientData.name, Email: clientData.email, Phone: clientData.phone, Address: clientData.address },
                { ID: 2, Name: 'Mock Client 2', Email: 'test2@example.com', Phone: '67890', Address: 'Addr 2' },
            ];
            this.successHandler(mockClients);
        },
        deleteClient: function(clientId) {
          // Simulate deleting and returning the list
          const mockClients = [
             { ID: 2, Name: 'Mock Client 2', Email: 'test2@example.com', Phone: '67890', Address: 'Addr 2' }
          ];
          this.successHandler(mockClients);
        },
        generateEmailDraft: function(prompt) {
          this.successHandler("Este es un borrador de correo electrónico de prueba generado por el mock.");
        }
      }
    }
  };

  // Create a proxy to dynamically handle chained calls
  const handler = {
    get(target, prop, receiver) {
      if (prop in target) {
        return target[prop];
      }
      // If the method doesn't exist on our mock, return a function that does nothing
      // but allows chaining.
      return function() { return receiver; };
    }
  };

  window.google.script.run = new Proxy(window.google.script.run, handler);
</script>
"""

# Insertar el mock ANTES del script principal de la aplicación
final_html = combined_html.replace("</body>", f"{mock_script}</body>")

# Escribir el archivo de verificación final
with open('/home/jules/verification/verification.html', 'w') as f:
    f.write(final_html)

print("verification.html creado exitosamente.")
