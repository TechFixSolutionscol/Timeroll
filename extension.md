PROMPT PARA ANTIGRAVITY

Objetivo
Configurar un módulo en un sistema existente (TimeBill / Apps Script + Google Sheets) para gestión de contratos, reporte manual de horas y generación de reportes quincenales en PDF, sin uso obligatorio de cronómetro, soportando múltiples empresas y contratos flexibles.

1. Contexto del sistema existente

Ya existe un módulo de Gestión de Clientes / Empresas con campos:

Nombre

Correo

Teléfono

Dirección

Ya existe autenticación de usuarios y roles.

El backend usa Google Apps Script y Google Sheets como base de datos.

NO se debe romper el módulo actual de clientes.

2. Reglas de negocio clave (CRÍTICAS)

El reporte de horas NO es diario, es manual, por servicio.

No siempre se usa cronómetro.

Cada empresa puede tener reglas de cobro distintas, según contrato.

Las reglas de cobro deben versionarse en el tiempo (histórico intacto).

Los cambios de contrato NO deben recalcular el pasado.

El cálculo se hace quincenalmente (01–15 / 16–fin de mes).

El resultado final debe generar un PDF quincenal.

3. Tipos de contrato soportados
Tipo 1 – FIJO (bolsa de horas / contrato cerrado)

Valor quincenal fijo (ej: 375.000)

Horas incluidas solo como referencia

Se cobra el valor fijo, independiente de las horas usadas

El reporte es respaldo contractual

Tipo 2 – POR_HORAS

Se reportan horas manualmente

Se calcula:

Horas normales

Horas extra

Ejemplo:

Valor hora normal: 25.000

Valor hora extra: 30.000

4. Modelo de datos requerido
4.1 Empresas (ya existe – no modificar)

Hoja: Clientes o Empresas

4.2 Configuración contractual por empresa (NUEVA)

Hoja: Empresa_Config

Campos:

ID

EmpresaID

VigenteDesde (fecha)

VigenteHasta (fecha, puede ser null)

TipoCobro (FIJO | POR_HORAS)

ValorFijoQuincenal

HorasIncluidas

ValorHora

ValorHoraExtra

Estado (Activa | Cerrada)

Observaciones

Regla:
Solo puede existir una configuración activa por empresa a la vez.

4.3 Servicios reportados manualmente (NUEVA)

Hoja: Servicios_Reportados

Campos:

ID

EmpresaID

ConfigID (configuración vigente en la fecha)

Fecha

Descripción del servicio

Horas reportadas

Regla:
Cada registro debe quedar ligado a la configuración vigente según la fecha.

4.4 Cierre quincenal (NUEVA)

Hoja: Cierres_Quincenales

Campos:

ID

EmpresaID

ConfigID

Desde

Hasta

TotalHoras

TotalCobro

Estado (Abierto | Cerrado)

FechaCierre

El cierre congela valores y reglas.

5. Lógica de cálculo
Si TipoCobro = FIJO

TotalCobro = ValorFijoQuincenal

Si TipoCobro = POR_HORAS

HorasNormales = MIN(TotalHoras, HorasIncluidas)

HorasExtra = MAX(0, TotalHoras − HorasIncluidas)

TotalCobro =

(HorasNormales × ValorHora)

(HorasExtra × ValorHoraExtra)

6. UI / UX requerido
6.1 Formulario de Cliente (existente)

NO mezclar reglas de contrato aquí

Agregar:

Botón: “Configurar contrato”

6.2 Modal: Configuración de contrato

Campos dinámicos según TipoCobro:

Tipo de cobro

Vigente desde

Valor quincenal (solo FIJO)

Horas incluidas

Valor hora

Valor hora extra

Observaciones

Al guardar:

Cerrar config anterior (si existe)

Crear nueva configuración

6.3 Formulario: Reporte de servicio

Empresa

Fecha

Descripción

Horas invertidas

(Sin cronómetro obligatorio)

7. Reporte PDF quincenal

El PDF debe incluir:

Datos de la empresa

Periodo (quincena)

Tipo de contrato

Tabla de servicios:

Fecha

Descripción

Horas

Resumen:

Total horas

Horas normales

Horas extra

Total a pagar

Debe generarse desde un cierre quincenal.

8. Restricciones técnicas

No recalcular históricos

No editar configuraciones pasadas

Mantener compatibilidad con backend existente

Usar Google Sheets como persistencia

Apps Script como lógica

9. Resultado esperado

Un módulo funcional que permita:

Configurar contratos por empresa

Reportar horas manualmente

Controlar consumo vs contrato

Generar reportes quincenales en PDF

Escalar a múltiples empresas sin refactor futuro