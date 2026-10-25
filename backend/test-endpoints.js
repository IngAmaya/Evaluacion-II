/**
 * ============================================================================
 * SCRIPT DE PRUEBAS AUTOMATIZADAS DEL BACKEND - FOOD DEI S.A. de R.L.
 * Verifica los 5 Endpoints Obligatorios y las Validaciones de Reglas de Negocio
 * ============================================================================
 */

const URL_BASE = process.env.API_URL || "http://localhost:3000";

const ejecutarPruebas = async () => {
  console.log("==================================================================");
  console.log(" INICIANDO PRUEBAS DE INTEGRACIÓN DEL BACKEND (FOOD DEI)");
  console.log("==================================================================\n");

  let pruebasExitosas = 0;
  let pruebasFallidas = 0;

  const verificar = (condicion, descripcion, detalle = "") => {
    if (condicion) {
      pruebasExitosas += 1;
      console.log(`✅ [PASS] ${descripcion}`);
    } else {
      pruebasFallidas += 1;
      console.error(`❌ [FAIL] ${descripcion} ${detalle}`);
    }
  };

  try {
    // 0. Restaurar estado inicial antes de probar
    await fetch(`${URL_BASE}/api/sistema/reset-total`, { method: "POST" });

    // 1. Prueba de GET /api/menu
    console.log("\n--- 1. Probando GET /api/menu ---");
    const resMenu = await fetch(`${URL_BASE}/api/menu`);
    const dataMenu = await resMenu.json();
    verificar(resMenu.status === 200, "GET /api/menu responde con código 200");
    verificar(Array.isArray(dataMenu) && dataMenu.length > 0, "GET /api/menu devuelve un arreglo de platillos");
    const plato101 = dataMenu.find((p) => p.id === 101);
    verificar(
      plato101 && plato101.nombre === "Menú Ejecutivo (Pollo)" && plato101.precio === 5.5 && plato101.stock === 12,
      "Estructura del plato 101 coincide con la guía ({ id: 101, nombre: 'Menú Ejecutivo (Pollo)', precio: 5.50, stock: 12, categoria: 'Fuerte' })"
    );

    // 2. Prueba de GET /api/reserva (estado inicial)
    console.log("\n--- 2. Probando GET /api/reserva (Estado Inicial) ---");
    const resReservaIni = await fetch(`${URL_BASE}/api/reserva`);
    const dataReservaIni = await resReservaIni.json();
    verificar(resReservaIni.status === 200, "GET /api/reserva responde con código 200");
    verificar(
      dataReservaIni.saldo === 25.0 && Array.isArray(dataReservaIni.itemsReservados) && dataReservaIni.total === 0,
      "Estado inicial tiene saldo: 25.00, itemsReservados: [], total: 0.00"
    );

    // 3. Prueba de POST /api/reserva/agregar (Caso exitoso)
    console.log("\n--- 3. Probando POST /api/reserva/agregar (Caso Exitoso) ---");
    const resAgregar = await fetch(`${URL_BASE}/api/reserva/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alimentoId: 101, cantidad: 2 })
    });
    const dataAgregar = await resAgregar.json();
    verificar(resAgregar.status === 200, "POST /api/reserva/agregar responde con código 200 al agregar 2 porciones del ID 101");
    verificar(
      dataAgregar.total === 11.0 && dataAgregar.saldo === 14.0,
      "Actualiza total a $11.00 y descuenta saldo a $14.00 en tiempo real"
    );

    // Verificar que el stock en /api/menu disminuyó de 12 a 10
    const resMenuDespues = await fetch(`${URL_BASE}/api/menu`);
    const dataMenuDespues = await resMenuDespues.json();
    const plato101Despues = dataMenuDespues.find((p) => p.id === 101);
    verificar(plato101Despues.stock === 10, "Stock del plato 101 disminuyó de 12 a 10 en el inventario");

    // 4. Prueba de POST /api/reserva/agregar (Validación: Stock insuficiente)
    console.log("\n--- 4. Probando POST /api/reserva/agregar (Validación: Stock insuficiente) ---");
    const resStockInsuficiente = await fetch(`${URL_BASE}/api/reserva/agregar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alimentoId: 101, cantidad: 99 })
    });
    const dataStockInsuficiente = await resStockInsuficiente.json();
    verificar(
      resStockInsuficiente.status === 400 && dataStockInsuficiente.mensaje === "Stock insuficiente",
      "POST /api/reserva/agregar rechaza con 400 Bad Request y mensaje 'Stock insuficiente'"
    );

    // 5. Prueba de PUT /api/reserva/actualizar-porciones/:id (Subir y bajar porciones)
    console.log("\n--- 5. Probando PUT /api/reserva/actualizar-porciones/:id ---");
    const resPutSubir = await fetch(`${URL_BASE}/api/reserva/actualizar-porciones/101`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: 3 })
    });
    const dataPutSubir = await resPutSubir.json();
    verificar(
      resPutSubir.status === 200 && dataPutSubir.total === 16.5 && dataPutSubir.saldo === 8.5,
      "PUT /api/reserva/actualizar-porciones/101 sube cantidad a 3 (total: $16.50, saldo: $8.50)"
    );

    // Validación Didáctica: Superar el saldo disponible al subir porciones
    const resPutSaldoInsuficiente = await fetch(`${URL_BASE}/api/reserva/actualizar-porciones/101`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: 6 }) // 6 * 5.50 = 33.00 > 25.00
    });
    const dataPutSaldoInsuficiente = await resPutSaldoInsuficiente.json();
    verificar(
      resPutSaldoInsuficiente.status === 400 &&
        dataPutSaldoInsuficiente.mensaje === "Saldo insuficiente para esta cantidad",
      "PUT /api/reserva/actualizar-porciones/:id rechaza con 400 y mensaje 'Saldo insuficiente para esta cantidad'"
    );

    // Bajar porciones de 3 a 1
    const resPutBajar = await fetch(`${URL_BASE}/api/reserva/actualizar-porciones/101`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: 1 })
    });
    const dataPutBajar = await resPutBajar.json();
    verificar(
      resPutBajar.status === 200 && dataPutBajar.total === 5.5 && dataPutBajar.saldo === 19.5 && dataPutBajar.platoActualizado.stock === 11,
      "PUT /api/reserva/actualizar-porciones/101 baja cantidad a 1 y devuelve 2 unidades al stock (stock: 11)"
    );

    // 6. Prueba de DELETE /api/reserva/eliminar/:id
    console.log("\n--- 6. Probando DELETE /api/reserva/eliminar/:id ---");
    const resDelete = await fetch(`${URL_BASE}/api/reserva/eliminar/101`, {
      method: "DELETE"
    });
    const dataDelete = await resDelete.json();
    verificar(
      resDelete.status === 200 &&
        dataDelete.itemsReservados.length === 0 &&
        dataDelete.total === 0 &&
        dataDelete.saldo === 25.0 &&
        dataDelete.platoActualizado.stock === 12,
      "DELETE /api/reserva/eliminar/101 elimina el platillo, restaura saldo a $25.00 y devuelve stock a 12"
    );

    console.log("\n==================================================================");
    console.log(` RESULTADO FINAL: ${pruebasExitosas} exitosas, ${pruebasFallidas} fallidas`);
    console.log("==================================================================");

    if (pruebasFallidas > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error ejecutando las pruebas:", error.message);
    process.exit(1);
  }
};

ejecutarPruebas();
