# Backend - Caso de Negocio: Food DEI S.A. de R.L.

API REST desarrollada con **Node.js** y **Express** para la **Evaluación II de Programación Web (Ciclo 02, 2026)**.

## Requisitos e Instalación

```bash
cd backend
npm install
```

### Ejecución del Servidor

- **Modo desarrollo (con recarga automática):**
  ```bash
  npm run dev
  ```
- **Modo producción:**
  ```bash
  npm start
  ```
- **Ejecutar pruebas automatizadas de los 5 endpoints (con el servidor encendido):**
  ```bash
  npm run test:api
  ```

El servidor se ejecuta por defecto en: `http://localhost:3000`

---

## Los 5 Endpoints Obligatorios

### 1. `GET /api/menu`
Devuelve la lista completa de alimentos disponibles hoy con su precio y stock.

**Respuesta (`200 OK`):**
```json
[
  {
    "id": 101,
    "nombre": "Menú Ejecutivo (Pollo)",
    "precio": 5.5,
    "stock": 12,
    "categoria": "Fuerte",
    "disponible": true
  }
]
```

### 2. `GET /api/reserva`
Devuelve los detalles de la reserva activa del usuario y su saldo disponible en tiempo real.

**Respuesta (`200 OK`):**
```json
{
  "saldo": 14.0,
  "itemsReservados": [
    {
      "id": 101,
      "alimentoId": 101,
      "nombre": "Menú Ejecutivo (Pollo)",
      "precio": 5.5,
      "categoria": "Fuerte",
      "cantidad": 2,
      "subtotal": 11.0
    }
  ],
  "total": 11.0,
  "saldoInicial": 25.0,
  "reservaActiva": true,
  "reservaConfirmada": false,
  "tiempoLimiteSegundos": 300,
  "tiempoRestanteSegundos": 285
}
```

### 3. `POST /api/reserva/agregar`
Añade temporalmente un platillo a la reserva del usuario y descuenta el stock y el saldo disponible en tiempo real.

**Cuerpo de la petición (`Body JSON`):**
```json
{
  "alimentoId": 101,
  "cantidad": 1
}
```

**Validaciones (`400 Bad Request`):**
- Si el stock es menor a la cantidad solicitada: `{ "mensaje": "Stock insuficiente" }`
- Si el costo supera el saldo disponible del usuario: `{ "mensaje": "Saldo insuficiente para esta cantidad" }`

### 4. `PUT /api/reserva/actualizar-porciones/:id`
Permite subir o bajar la cantidad de porciones de un platillo desde el carrito lateral.

**Cuerpo de la petición (`Body JSON`):**
```json
{
  "cantidad": 3
}
```
*(También acepta `nuevaCantidad`, `porciones` o `{ "accion": "incrementar" | "decrementar" }`).*

**Validaciones (`400 Bad Request`):**
- Si al subir las porciones el costo supera el saldo del usuario: `{ "mensaje": "Saldo insuficiente para esta cantidad" }`
- Si al subir las porciones no hay suficiente stock: `{ "mensaje": "Stock insuficiente" }`

### 5. `DELETE /api/reserva/eliminar/:id`
Elimina por completo el platillo de la reserva del usuario, restaura el saldo correspondiente y devuelve las unidades al stock general del restaurante.

---

## Endpoints Complementarios del Caso de Negocio

- **`POST /api/reserva/confirmar`**: Confirma la reserva actual, bloqueando definitivamente el stock seleccionado.
- **`POST /api/reserva/expirar`** (o **`POST /api/reserva/reiniciar`**): Cierra la reserva no completada cuando vence el tiempo límite, devolviendo las porciones al stock general del restaurante.
- **`POST /api/sistema/reset-total`**: Restaura todo el inventario original y el saldo a `$25.00`.
