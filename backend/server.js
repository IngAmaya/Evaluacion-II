/**
 * ============================================================================
 * SERVIDOR BACKEND - CASO DE NEGOCIO: FOOD DEI S.A. de R.L.
 * Evaluación II - Programación Web (Ciclo 02, 2026)
 * Tecnologías: Node.js, Express, JavaScript (ES Modules)
 * ============================================================================
 *
 * Requisitos Técnicos Cubiertos en este Backend:
 * - Uso de let y const
 * - Uso de Funciones y Métodos
 * - Tipos de datos: string, number, boolean, object
 * - Estructuras con arreglos (arrays) y métodos iteradores (.map, .find, .filter, .reduce, .some)
 * - Uso correcto del patrón REST (GET, POST, PUT, DELETE y códigos HTTP 200, 400, 404)
 * - Uso correcto de Promesas (new Promise, async/await)
 */

import express from "express";
import cors from "cors";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Configuración de rutas de directorio para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUTA_MENU_JSON = join(__dirname, "data", "menu.json");

// 1. Inicialización de la aplicación Express
const app = express();
const PUERTO = process.env.PORT || 3000;

// 2. Middlewares
// cors(): Permite la comunicación entre el Frontend (React/Vite) y el Backend (Express)
app.use(cors());
// express.json(): Permite recibir y parsear cuerpos de petición en formato JSON
app.use(express.json());

/**
 * ============================================================================
 * CONSTANTES Y ESTADO EN MEMORIA (INVENTARIO Y RESERVA DEL USUARIO)
 * ============================================================================
 */

// Presupuesto inicial del cliente (number) y tiempo límite de reserva en segundos (number)
const SALDO_INICIAL_USUARIO = 25.00;
const TIEMPO_LIMITE_SEGUNDOS = 300; // 5 minutos para completar la reserva
const NOMBRE_EMPRESA = "Food DEI S.A. de R.L."; // string

// Arreglo (array) en memoria que almacena el inventario de platillos del día
let inventarioMenu = [];

// Objeto (object) en memoria que almacena el estado de la reserva activa del usuario
let estadoReserva = {
  saldo: SALDO_INICIAL_USUARIO,          // number: Saldo disponible en tiempo real
  saldoInicial: SALDO_INICIAL_USUARIO,   // number: Presupuesto base antes de reservar
  itemsReservados: [],                   // array: Lista de platillos en la bandeja [{ id, cantidad, ... }]
  total: 0.00,                           // number: Costo acumulado de la reserva actual
  reservaActiva: false,                  // boolean: Indica si el usuario tiene platos en su reserva
  reservaConfirmada: false,              // boolean: Indica si la última reserva fue confirmada
  tiempoLimiteSegundos: TIEMPO_LIMITE_SEGUNDOS,
  inicioReservaTimestamp: null           // number | null: Marca de tiempo de inicio de la reserva
};

/**
 * ============================================================================
 * FUNCIONES AUXILIARES Y MANEJO DE PROMESAS
 * ============================================================================
 */

/**
 * Redondea un valor numérico a 2 decimales para evitar imprecisiones de punto flotante en dinero.
 * @param {number} valor - Monto a redondear
 * @returns {number} Monto con 2 decimales exactos
 */
const redondearMoneda = (valor) => Number(Number(valor).toFixed(2));

/**
 * Carga el inventario inicial desde el archivo data/menu.json utilizando Promesas (async/await).
 * @returns {Promise<Array>} Promesa que resuelve con el arreglo de platillos
 */
const cargarInventarioInicial = async () => {
  try {
    const contenidoArchivo = await readFile(RUTA_MENU_JSON, "utf-8");
    const datosParseados = JSON.parse(contenidoArchivo);

    // Uso de .map() para asegurar tipos de datos correctos (number, string, boolean, object)
    return datosParseados.map((plato) => ({
      id: Number(plato.id),
      nombre: String(plato.nombre),
      precio: redondearMoneda(plato.precio),
      stock: Number(plato.stock),
      categoria: String(plato.categoria),
      disponible: Boolean(plato.stock > 0)
    }));
  } catch (error) {
    console.error("[WARN] No se pudo leer menu.json, usando inventario por defecto:", error.message);
    return [
      { id: 101, nombre: "Menú Ejecutivo (Pollo)", precio: 5.50, stock: 12, categoria: "Fuerte", disponible: true },
      { id: 102, nombre: "Pasta Alfredo con Camarones", precio: 6.25, stock: 8, categoria: "Fuerte", disponible: true },
      { id: 103, nombre: "Lasagna Boloñesa Tradicional", precio: 5.75, stock: 5, categoria: "Fuerte", disponible: true },
      { id: 104, nombre: "Ensalada César con Pollo Grillé", precio: 4.25, stock: 10, categoria: "Entrada", disponible: true }
    ];
  }
};

/**
 * Simula una verificación asíncrona en cocina/inventario mediante una Promesa explícita.
 * Cumple con el requisito técnico: "Uso correcto de promesas en cualquiera de sus formas de manejo".
 * @param {Function} operacionValidacion - Función que evalúa reglas de negocio
 * @returns {Promise<Object>} Resultado de la validación
 */
const verificarReglasNegocioAsync = (operacionValidacion) => {
  return new Promise((resolve, reject) => {
    try {
      const resultado = operacionValidacion();
      if (!resultado.valido) {
        reject(resultado);
      } else {
        resolve(resultado);
      }
    } catch (err) {
      reject({
        valido: false,
        codigo: 500,
        mensaje: "Error interno al procesar la reserva"
      });
    }
  });
};

/**
 * Recalcula el total de la reserva y actualiza las banderas de estado utilizando .reduce() y .map().
 */
const recalcularEstadoReserva = () => {
  // Uso de .map() para asegurar que cada item tenga su subtotal actualizado
  estadoReserva.itemsReservados = estadoReserva.itemsReservados.map((item) => ({
    ...item,
    subtotal: redondearMoneda(item.precio * item.cantidad)
  }));

  // Uso de .reduce() sobre el arreglo itemsReservados para calcular el costo total
  const nuevoTotal = estadoReserva.itemsReservados.reduce(
    (acumulador, item) => acumulador + item.precio * item.cantidad,
    0
  );

  estadoReserva.total = redondearMoneda(nuevoTotal);
  estadoReserva.saldo = redondearMoneda(estadoReserva.saldoInicial - estadoReserva.total);
  estadoReserva.reservaActiva = estadoReserva.itemsReservados.length > 0;

  if (!estadoReserva.reservaActiva) {
    estadoReserva.inicioReservaTimestamp = null;
  }
};

/**
 * Calcula los segundos restantes del límite de tiempo si hay una reserva activa.
 * @returns {number} Segundos restantes
 */
const obtenerTiempoRestanteSegundos = () => {
  if (!estadoReserva.inicioReservaTimestamp || !estadoReserva.reservaActiva) {
    return TIEMPO_LIMITE_SEGUNDOS;
  }
  const transcurridoSegundos = Math.floor((Date.now() - estadoReserva.inicioReservaTimestamp) / 1000);
  const restante = TIEMPO_LIMITE_SEGUNDOS - transcurridoSegundos;
  return restante > 0 ? restante : 0;
};

/**
 * Busca un platillo en el inventario por su ID utilizando el método .find() de arreglos.
 * @param {number|string} idBuscado - ID del platillo
 * @returns {Object|undefined} Platillo encontrado o undefined
 */
const buscarPlatilloEnMenu = (idBuscado) => {
  const idNumerico = Number(idBuscado);
  return inventarioMenu.find((plato) => plato.id === idNumerico);
};

/**
 * Busca un platillo dentro de la reserva activa del usuario utilizando .find().
 * @param {number|string} idBuscado - ID del platillo
 * @returns {Object|undefined} Item reservado o undefined
 */
const buscarItemEnReserva = (idBuscado) => {
  const idNumerico = Number(idBuscado);
  return estadoReserva.itemsReservados.find((item) => item.id === idNumerico);
};

// Inicializamos el inventario al arrancar el módulo
inventarioMenu = await cargarInventarioInicial();

/**
 * ============================================================================
 * ENDPOINTS DE LA API REST
 * ============================================================================
 */

/**
 * RUTA INFORMATIVA RAÍZ: GET /
 * Propósito: Verificar que el servidor de Food DEI S.A. de R.L. está activo.
 */
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    empresa: NOMBRE_EMPRESA,
    mensaje: "API Backend del Caso de Negocio funcionando correctamente.",
    endpointsObligatorios: [
      "GET /api/menu",
      "GET /api/reserva",
      "POST /api/reserva/agregar",
      "PUT /api/reserva/actualizar-porciones/:id",
      "DELETE /api/reserva/eliminar/:id"
    ],
    endpointsAdicionales: [
      "POST /api/reserva/confirmar",
      "POST /api/reserva/expirar",
      "POST /api/reserva/reiniciar"
    ]
  });
});

/**
 * ----------------------------------------------------------------------------
 * ENDPOINT OBLIGATORIO 1: GET /api/menu
 * Propósito: Devuelve la lista completa de alimentos disponibles hoy con su precio y stock.
 * Estructura requerida:
 * [{ id: 101, nombre: "Menú Ejecutivo (Pollo)", precio: 5.50, stock: 12, categoria: "Fuerte" }, ...]
 * ----------------------------------------------------------------------------
 */
app.get("/api/menu", (req, res) => {
  // Actualizamos el booleano 'disponible' de cada plato usando .map()
  const menuActualizado = inventarioMenu.map((plato) => ({
    id: plato.id,
    nombre: plato.nombre,
    precio: plato.precio,
    stock: plato.stock,
    categoria: plato.categoria,
    disponible: plato.stock > 0
  }));

  return res.status(200).json(menuActualizado);
});

/**
 * ----------------------------------------------------------------------------
 * ENDPOINT OBLIGATORIO 2: GET /api/reserva
 * Propósito: Devuelve los detalles de la reserva activa del usuario y su saldo disponible.
 * Estructura requerida:
 * { saldo: 25.00, itemsReservados: [{ id: 101, cantidad: 2 }], total: 11.00 }
 * ----------------------------------------------------------------------------
 */
app.get("/api/reserva", (req, res) => {
  recalcularEstadoReserva();

  return res.status(200).json({
    saldo: estadoReserva.saldo,
    itemsReservados: estadoReserva.itemsReservados,
    total: estadoReserva.total,
    saldoInicial: estadoReserva.saldoInicial,
    reservaActiva: estadoReserva.reservaActiva,
    reservaConfirmada: estadoReserva.reservaConfirmada,
    tiempoLimiteSegundos: estadoReserva.tiempoLimiteSegundos,
    tiempoRestanteSegundos: obtenerTiempoRestanteSegundos()
  });
});

/**
 * ----------------------------------------------------------------------------
 * ENDPOINT OBLIGATORIO 3: POST /api/reserva/agregar
 * Propósito: Recibe { alimentoId: 101, cantidad: 1 } en el cuerpo.
 *            Añade temporalmente el plato a la reserva.
 * Validación: Si el stock del backend es menor a la cantidad solicitada, debe
 *             responder con un 400 Bad Request y el mensaje "Stock insuficiente".
 *             Si el costo supera el saldo disponible, responde con 400 y
 *             "Saldo insuficiente para esta cantidad".
 * ----------------------------------------------------------------------------
 */
app.post("/api/reserva/agregar", async (req, res) => {
  // Soportamos alimentoId (estándar de la guía) o id (por compatibilidad con Frontend)
  const idRecibido = req.body.alimentoId ?? req.body.id;
  const cantidadRecibida = req.body.cantidad !== undefined ? Number(req.body.cantidad) : 1;

  // Validación de parámetros básicos
  if (idRecibido === undefined || idRecibido === null || Number.isNaN(Number(idRecibido))) {
    return res.status(400).json({
      ok: false,
      mensaje: "Debe proporcionar un alimentoId válido",
      message: "Debe proporcionar un alimentoId válido",
      error: "Debe proporcionar un alimentoId válido"
    });
  }

  if (Number.isNaN(cantidadRecibida) || !Number.isInteger(cantidadRecibida) || cantidadRecibida <= 0) {
    return res.status(400).json({
      ok: false,
      mensaje: "La cantidad solicitada debe ser un número entero mayor a 0",
      message: "La cantidad solicitada debe ser un número entero mayor a 0",
      error: "La cantidad solicitada debe ser un número entero mayor a 0"
    });
  }

  const plato = buscarPlatilloEnMenu(idRecibido);

  if (!plato) {
    return res.status(404).json({
      ok: false,
      mensaje: "El alimento solicitado no existe en el menú",
      message: "El alimento solicitado no existe en el menú",
      error: "El alimento solicitado no existe en el menú"
    });
  }

  try {
    // Validación mediante Promesa de las reglas de negocio (Stock y Saldo)
    await verificarReglasNegocioAsync(() => {
      // 1. Validación obligatoria de Stock
      if (plato.stock < cantidadRecibida) {
        return {
          valido: false,
          codigo: 400,
          mensaje: "Stock insuficiente"
        };
      }

      // 2. Validación de Saldo disponible del cliente
      const costoAdicional = redondearMoneda(plato.precio * cantidadRecibida);
      if (costoAdicional > estadoReserva.saldo) {
        return {
          valido: false,
          codigo: 400,
          mensaje: "Saldo insuficiente para esta cantidad"
        };
      }

      return { valido: true };
    });

    // Si pasa las validaciones, descontamos el stock temporalmente del inventario
    plato.stock -= cantidadRecibida;
    plato.disponible = plato.stock > 0;

    // Si es el primer platillo agregado, iniciamos el contador de tiempo de la reserva
    if (estadoReserva.itemsReservados.length === 0) {
      estadoReserva.inicioReservaTimestamp = Date.now();
      estadoReserva.reservaConfirmada = false;
    }

    // Verificamos con .some() si el plato ya estaba en la bandeja de reserva
    const existeEnReserva = estadoReserva.itemsReservados.some((item) => item.id === plato.id);

    if (existeEnReserva) {
      const itemExistente = buscarItemEnReserva(plato.id);
      itemExistente.cantidad += cantidadRecibida;
      itemExistente.subtotal = redondearMoneda(itemExistente.cantidad * plato.precio);
    } else {
      estadoReserva.itemsReservados.push({
        id: plato.id,
        alimentoId: plato.id,
        nombre: plato.nombre,
        precio: plato.precio,
        categoria: plato.categoria,
        cantidad: cantidadRecibida,
        subtotal: redondearMoneda(plato.precio * cantidadRecibida)
      });
    }

    // Recalculamos total y saldo disponible en tiempo real
    recalcularEstadoReserva();

    return res.status(200).json({
      ok: true,
      mensaje: "Platillo añadido a la reserva",
      saldo: estadoReserva.saldo,
      itemsReservados: estadoReserva.itemsReservados,
      total: estadoReserva.total,
      platoActualizado: plato
    });
  } catch (errorValidacion) {
    const codigoEstado = errorValidacion.codigo || 400;
    return res.status(codigoEstado).json({
      ok: false,
      mensaje: errorValidacion.mensaje,
      message: errorValidacion.mensaje,
      error: errorValidacion.mensaje
    });
  }
});

/**
 * ----------------------------------------------------------------------------
 * ENDPOINT OBLIGATORIO 4: PUT /api/reserva/actualizar-porciones/:id
 * Propósito: Recibe el id del alimento en la URL y la nueva cantidad en el cuerpo.
 *            Permite al usuario subir o bajar la cantidad de porciones desde su carrito.
 * Validación Didáctica: Si al subir las porciones el costo total supera el saldo
 *                       del usuario, el backend responde con un 400 y el mensaje
 *                       "Saldo insuficiente para esta cantidad".
 *                       Si supera el stock disponible, responde con un 400 y el
 *                       mensaje "Stock insuficiente".
 * ----------------------------------------------------------------------------
 */
app.put("/api/reserva/actualizar-porciones/:id", async (req, res) => {
  const idAlimento = Number(req.params.id);

  if (Number.isNaN(idAlimento)) {
    return res.status(400).json({
      ok: false,
      mensaje: "El ID del alimento en la URL no es válido",
      message: "El ID del alimento en la URL no es válido",
      error: "El ID del alimento en la URL no es válido"
    });
  }

  const itemReservado = buscarItemEnReserva(idAlimento);
  const platoEnMenu = buscarPlatilloEnMenu(idAlimento);

  if (!platoEnMenu) {
    return res.status(404).json({
      ok: false,
      mensaje: "El platillo no existe en el menú general",
      message: "El platillo no existe en el menú general",
      error: "El platillo no existe en el menú general"
    });
  }

  if (!itemReservado) {
    return res.status(404).json({
      ok: false,
      mensaje: "El platillo no se encuentra en la reserva activa del usuario",
      message: "El platillo no se encuentra en la reserva activa del usuario",
      error: "El platillo no se encuentra en la reserva activa del usuario"
    });
  }

  // Determinamos la nueva cantidad solicitada (soportando 'cantidad', 'nuevaCantidad' o 'porciones')
  let nuevaCantidad = req.body.cantidad ?? req.body.nuevaCantidad ?? req.body.porciones;

  // También soportamos si el frontend envía { accion: "incrementar" | "decrementar" }
  if (nuevaCantidad === undefined && req.body.accion) {
    if (req.body.accion === "incrementar" || req.body.accion === "+") {
      nuevaCantidad = itemReservado.cantidad + 1;
    } else if (req.body.accion === "decrementar" || req.body.accion === "-") {
      nuevaCantidad = itemReservado.cantidad - 1;
    }
  }

  nuevaCantidad = Number(nuevaCantidad);

  if (Number.isNaN(nuevaCantidad) || !Number.isInteger(nuevaCantidad) || nuevaCantidad < 0) {
    return res.status(400).json({
      ok: false,
      mensaje: "Debe enviar una nueva cantidad entera válida en el cuerpo de la petición",
      message: "Debe enviar una nueva cantidad entera válida en el cuerpo de la petición",
      error: "Debe enviar una nueva cantidad entera válida en el cuerpo de la petición"
    });
  }

  // Caso especial: Si la nueva cantidad baja a 0, eliminamos el plato de la reserva y devolvemos stock
  if (nuevaCantidad === 0) {
    platoEnMenu.stock += itemReservado.cantidad;
    platoEnMenu.disponible = platoEnMenu.stock > 0;
    estadoReserva.itemsReservados = estadoReserva.itemsReservados.filter(
      (item) => item.id !== idAlimento
    );
    recalcularEstadoReserva();

    return res.status(200).json({
      ok: true,
      mensaje: "Platillo eliminado de la reserva al llegar a 0 porciones",
      saldo: estadoReserva.saldo,
      itemsReservados: estadoReserva.itemsReservados,
      total: estadoReserva.total,
      platoActualizado: platoEnMenu
    });
  }

  // Calculamos la diferencia de porciones respecto a lo que el usuario ya tiene en su carrito
  const diferenciaPorciones = nuevaCantidad - itemReservado.cantidad;

  // Si la cantidad es idéntica a la actual, devolvemos el estado sin cambios
  if (diferenciaPorciones === 0) {
    return res.status(200).json({
      ok: true,
      mensaje: "La cantidad de porciones se mantiene sin cambios",
      saldo: estadoReserva.saldo,
      itemsReservados: estadoReserva.itemsReservados,
      total: estadoReserva.total,
      platoActualizado: platoEnMenu
    });
  }

  try {
    // Si el usuario está SUBIENDO las porciones (diferenciaPorciones > 0), validamos Saldo y Stock
    if (diferenciaPorciones > 0) {
      await verificarReglasNegocioAsync(() => {
        const costoPorcionesExtra = redondearMoneda(diferenciaPorciones * platoEnMenu.precio);

        // Validación Didáctica Obligatoria: ¿El costo adicional supera el saldo disponible del usuario?
        if (costoPorcionesExtra > estadoReserva.saldo) {
          return {
            valido: false,
            codigo: 400,
            mensaje: "Saldo insuficiente para esta cantidad"
          };
        }

        // Validación de Stock en cocina: ¿Hay suficientes porciones disponibles en el menú?
        if (platoEnMenu.stock < diferenciaPorciones) {
          return {
            valido: false,
            codigo: 400,
            mensaje: "Stock insuficiente"
          };
        }

        return { valido: true };
      });

      // Descontamos las porciones adicionales del stock del menú
      platoEnMenu.stock -= diferenciaPorciones;
    } else {
      // Si el usuario está BAJANDO las porciones (diferenciaPorciones < 0), devolvemos unidades al stock
      const porcionesDevueltas = Math.abs(diferenciaPorciones);
      platoEnMenu.stock += porcionesDevueltas;
    }

    platoEnMenu.disponible = platoEnMenu.stock > 0;
    itemReservado.cantidad = nuevaCantidad;
    itemReservado.subtotal = redondearMoneda(nuevaCantidad * platoEnMenu.precio);

    // Recalculamos el total de la reserva y el saldo del usuario en tiempo real
    recalcularEstadoReserva();

    return res.status(200).json({
      ok: true,
      mensaje: "Porciones actualizadas correctamente",
      saldo: estadoReserva.saldo,
      itemsReservados: estadoReserva.itemsReservados,
      total: estadoReserva.total,
      platoActualizado: platoEnMenu
    });
  } catch (errorValidacion) {
    const codigoEstado = errorValidacion.codigo || 400;
    return res.status(codigoEstado).json({
      ok: false,
      mensaje: errorValidacion.mensaje,
      message: errorValidacion.mensaje,
      error: errorValidacion.mensaje
    });
  }
});

/**
 * ----------------------------------------------------------------------------
 * ENDPOINT OBLIGATORIO 5: DELETE /api/reserva/eliminar/:id
 * Propósito: Elimina por completo ese platillo de la reserva del usuario y
 *            devuelve las unidades al stock del menú general del restaurante.
 * ----------------------------------------------------------------------------
 */
app.delete("/api/reserva/eliminar/:id", (req, res) => {
  const idAlimento = Number(req.params.id);

  if (Number.isNaN(idAlimento)) {
    return res.status(400).json({
      ok: false,
      mensaje: "El ID del alimento no es válido",
      message: "El ID del alimento no es válido",
      error: "El ID del alimento no es válido"
    });
  }

  const itemReservado = buscarItemEnReserva(idAlimento);

  if (!itemReservado) {
    return res.status(404).json({
      ok: false,
      mensaje: "El platillo no se encuentra en la reserva del usuario",
      message: "El platillo no se encuentra en la reserva del usuario",
      error: "El platillo no se encuentra en la reserva del usuario"
    });
  }

  // Devolvemos todas las unidades reservadas de este platillo al stock general del restaurante
  const platoEnMenu = buscarPlatilloEnMenu(idAlimento);
  if (platoEnMenu) {
    platoEnMenu.stock += itemReservado.cantidad;
    platoEnMenu.disponible = platoEnMenu.stock > 0;
  }

  // Eliminamos el platillo del arreglo itemsReservados usando .filter()
  estadoReserva.itemsReservados = estadoReserva.itemsReservados.filter(
    (item) => item.id !== idAlimento
  );

  // Recalculamos el total de la reserva y restauramos el saldo correspondiente
  recalcularEstadoReserva();

  return res.status(200).json({
    ok: true,
    mensaje: "Platillo eliminado de la reserva y unidades devueltas al stock",
    saldo: estadoReserva.saldo,
    itemsReservados: estadoReserva.itemsReservados,
    total: estadoReserva.total,
    platoActualizado: platoEnMenu || null
  });
});

/**
 * ============================================================================
 * ENDPOINTS COMPLEMENTARIOS DEL CASO DE NEGOCIO (CONFIRMACIÓN Y TIEMPO LÍMITE)
 * ============================================================================
 */

/**
 * RUTA: POST /api/reserva/confirmar
 * Propósito: Permite al usuario confirmar su reserva actual (bloqueando definitivamente el stock
 *            y descontando el total de su presupuesto para futuras reservas de la sesión).
 */
app.post("/api/reserva/confirmar", (req, res) => {
  if (estadoReserva.itemsReservados.length === 0) {
    return res.status(400).json({
      ok: false,
      mensaje: "No hay platillos en la reserva actual para confirmar",
      message: "No hay platillos en la reserva actual para confirmar",
      error: "No hay platillos en la reserva actual para confirmar"
    });
  }

  const resumenConfirmado = {
    itemsConfirmados: [...estadoReserva.itemsReservados],
    totalPagado: estadoReserva.total,
    saldoRestante: estadoReserva.saldo
  };

  // Al confirmar, el nuevo presupuesto base pasa a ser el saldo restante y se limpia el carrito activo
  estadoReserva.saldoInicial = estadoReserva.saldo;
  estadoReserva.itemsReservados = [];
  estadoReserva.total = 0.00;
  estadoReserva.reservaActiva = false;
  estadoReserva.reservaConfirmada = true;
  estadoReserva.inicioReservaTimestamp = null;

  return res.status(200).json({
    ok: true,
    mensaje: "¡Reserva confirmada exitosamente! El stock ha sido bloqueado.",
    resumen: resumenConfirmado,
    saldo: estadoReserva.saldo,
    itemsReservados: estadoReserva.itemsReservados,
    total: estadoReserva.total
  });
});

/**
 * RUTA: POST /api/reserva/expirar (y alias POST /api/reserva/reiniciar)
 * Propósito: Si el usuario no completa la reserva dentro del tiempo límite, se cierra la reserva,
 *            se devuelven los platillos no confirmados al stock general e invita a iniciarla nuevamente.
 */
const cerrarYDevolverReservaNoConfirmada = (req, res) => {
  // Devolvemos al inventario todas las porciones que estaban reservadas temporalmente
  estadoReserva.itemsReservados.forEach((item) => {
    const plato = buscarPlatilloEnMenu(item.id);
    if (plato) {
      plato.stock += item.cantidad;
      plato.disponible = plato.stock > 0;
    }
  });

  // Limpiamos la reserva activa y restauramos el saldo del usuario
  estadoReserva.itemsReservados = [];
  estadoReserva.reservaConfirmada = false;
  recalcularEstadoReserva();

  return res.status(200).json({
    ok: true,
    mensaje: "La reserva actual se ha cerrado y el stock fue liberado. Puede iniciar su reserva nuevamente.",
    saldo: estadoReserva.saldo,
    itemsReservados: estadoReserva.itemsReservados,
    total: estadoReserva.total
  });
};

app.post("/api/reserva/expirar", cerrarYDevolverReservaNoConfirmada);
app.post("/api/reserva/reiniciar", cerrarYDevolverReservaNoConfirmada);

/**
 * RUTA: POST /api/sistema/reset-total
 * Propósito: Restaura tanto el menú original desde el JSON como el saldo inicial ($25.00).
 *            Útil para pruebas o demostraciones durante la defensa.
 */
app.post("/api/sistema/reset-total", async (req, res) => {
  inventarioMenu = await cargarInventarioInicial();
  estadoReserva = {
    saldo: SALDO_INICIAL_USUARIO,
    saldoInicial: SALDO_INICIAL_USUARIO,
    itemsReservados: [],
    total: 0.00,
    reservaActiva: false,
    reservaConfirmada: false,
    tiempoLimiteSegundos: TIEMPO_LIMITE_SEGUNDOS,
    inicioReservaTimestamp: null
  };

  return res.status(200).json({
    ok: true,
    mensaje: "Sistema restaurado a su estado inicial (Menú original y Saldo $25.00).",
    saldo: estadoReserva.saldo,
    itemsReservados: estadoReserva.itemsReservados,
    total: estadoReserva.total,
    menu: inventarioMenu
  });
});

// 3. Encendido del servidor Express
app.listen(PUERTO, () => {
  console.log("==================================================================");
  console.log(` Servidor Backend - ${NOMBRE_EMPRESA}`);
  console.log(` Corriendo en: http://localhost:${PUERTO}`);
  console.log(` Endpoints principales:`);
  console.log(`   - GET    http://localhost:${PUERTO}/api/menu`);
  console.log(`   - GET    http://localhost:${PUERTO}/api/reserva`);
  console.log(`   - POST   http://localhost:${PUERTO}/api/reserva/agregar`);
  console.log(`   - PUT    http://localhost:${PUERTO}/api/reserva/actualizar-porciones/:id`);
  console.log(`   - DELETE http://localhost:${PUERTO}/api/reserva/eliminar/:id`);
  console.log("==================================================================");
});
