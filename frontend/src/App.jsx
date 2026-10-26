import { useState, useEffect } from "react";
import {
  Container, Row, Col, Alert, UncontrolledAlert, Badge,
  Card, CardBody, CardTitle, Button, ButtonGroup, ListGroup, ListGroupItem
} from "reactstrap";

// Dirección del backend (Express)
const API = "http://localhost:3000";


//1) FUNCIONES AUXILIARES

const fondo ={
  minHeight: "100vh",
  color: "#f4f1ff",
  background:
    "radial-gradient(circle at 15% 10%, rgba(255,107,107,0.18), transparent 40%), " +
    "radial-gradient(circle at 85% 20%, rgba(255,176,32,0.15), transparent 40%), " +
    "radial-gradient(circle at 50% 100%, rgba(99,102,241,0.2), transparent 50%), " +
    "#0f0b1e",
  backgroundAttachment: "fixed"
};

// Hace una petición al backend. Devuelve una PROMESA con la respuesta en JSON.
// Si el backend responde con error (400, 404), lanza un Error con su mensaje.
const pedir = async (ruta, metodo = "GET", cuerpo) => {
  const respuesta = await fetch(API + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje);
  }
  return datos;
};

// Convierte un número en texto de dinero: 5.5 -> "$5.50"
const dinero = (numero) => "$" + numero.toFixed(2);

// Convierte segundos en "m:ss": 285 -> "4:45"
const formatearTiempo = (segundos) =>
  Math.floor(segundos / 60) + ":" + String(segundos % 60).padStart(2, "0");

const emojis = {
  101: "🍗", 102: "🍝", 103: "🥘", 104: "🥗",
  105: "🍲", 106: "🐟", 107: "🍰", 108: "🧃"
};

// Estilo de las tarjetas
const estiloCard = {
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  color: "#f4f1ff"
};


//2) COMPONENTE: tarjeta de un plato del menú
   
function PlatoCard({ plato, onAgregar, deshabilitado }) {
  return (
    <Card className="mb-3 shadow-sm" style={estiloCard}>
      <CardBody className="text-center">
        <div style={{ fontSize: "3.5rem" }}>{emojis[plato.id] ?? "🍴"}</div>
        <CardTitle tag="h5">{plato.nombre}</CardTitle>
        <p className="text-white-50 mb-1">{plato.categoria}</p>
        <p className="mb-2">
          <Badge color="success" className="fs-6">{dinero(plato.precio)}</Badge>
          <span className="ms-2">Stock: {plato.stock}</span>
        </p>

        {plato.stock === 0 ? (
          <Button color="secondary" disabled>Agotado</Button>
        ) : (
          <Button color="primary" disabled={deshabilitado} onClick={() => onAgregar(plato.id)}>
            Añadir a la Reserva
          </Button>
        )}
      </CardBody>
    </Card>
  );
}


  //3) COMPONENTE: una fila del carrito (bandeja de reserva)

function ItemReserva({ item, onCambiar, onQuitar, deshabilitado }) {
  return (
    <ListGroupItem>
      <div className="fw-bold">{item.nombre}</div>
      <small className="text-muted">Subtotal: {dinero(item.subtotal)}</small>

      <div className="d-flex justify-content-between align-items-center mt-2">
        <ButtonGroup size="sm">
          <Button outline disabled={deshabilitado} onClick={() => onCambiar(item.id, item.cantidad - 1)}>-</Button>
          <Button outline disabled>{item.cantidad}</Button>
          <Button outline disabled={deshabilitado} onClick={() => onCambiar(item.id, item.cantidad + 1)}>+</Button>
        </ButtonGroup>

        <Button color="danger" outline size="sm" disabled={deshabilitado} onClick={() => onQuitar(item.id)}>
          Quitar
        </Button>
      </div>
    </ListGroupItem>
  );
}

// Estilo de la barra de saldo: oscura, con borde dorado y un brillo suave
const estiloBarra = {
  background: "rgba(30, 24, 60, 0.92)",       // casi opaco, para que no se transparente el contenido al hacer scroll
  border: "1px solid rgba(255, 176, 32, 0.6)", // borde dorado
  color: "#f4f1ff",                            // texto claro
  borderRadius: "16px",                        // esquinas redondeadas
  boxShadow: "0 0 20px rgba(255, 176, 32, 0.2)" // brillo suave alrededor
};

  //4) COMPONENTE PRINCIPAL

function App() {
  // ---------- ESTADO (useState): la "memoria" de la pantalla ----------
  const [menu, setMenu] = useState([]);                       // array: platos del menú
  const [reserva, setReserva] = useState({ saldo: 0, total: 0, itemsReservados: [], reservaActiva: false }); // object
  const [segundos, setSegundos] = useState(300);              // number: cuenta regresiva
  const [cargando, setCargando] = useState(false);            // boolean: ¿hay una petición en curso?
  const [error, setError] = useState("");                     // string: mensaje de error del backend
  const [aviso, setAviso] = useState("");                     // string: mensajes de éxito / tiempo agotado

  // Pide menú y reserva al backend (endpoints 1 y 2) y guarda los datos en el estado
  const cargarTodo = async () => {
    const [menuServidor, reservaServidor] = await Promise.all([
      pedir("/api/menu"),
      pedir("/api/reserva")
    ]);
    setMenu(menuServidor);
    setReserva(reservaServidor);
    setSegundos(reservaServidor.tiempoRestanteSegundos);
  };

  // Ejecuta cualquier acción (agregar, quitar...) y luego refresca la pantalla.
  // Si el backend rechaza la petición, el catch guarda el mensaje para mostrarlo.
  const ejecutar = async (accion) => {
    setCargando(true);
    setError("");
    setAviso("");
    try {
      await accion();
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // ---------- EFECTOS (useEffect) ----------

  // Efecto 1: al abrir la página, cargar menú y reserva (el [] significa "una sola vez")
  useEffect(() => {
    cargarTodo().catch((err) => setError(err.message));
  }, []);

  // Efecto 2: mientras haya reserva activa, restar 1 segundo cada segundo
  useEffect(() => {
    if (!reserva.reservaActiva) return;
    const reloj = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(reloj); // limpia el reloj cuando ya no se necesita
  }, [reserva.reservaActiva]);

  // Efecto 3: si el tiempo llega a 0, cerrar la reserva (el backend devuelve el stock)
  useEffect(() => {
    if (reserva.reservaActiva && segundos === 0) {
      ejecutar(async () => {
        await pedir("/api/reserva/expirar", "POST");
        setAviso("⏰ Se acabó el tiempo: tu reserva se cerró. ¡Puedes iniciarla nuevamente!");
      });
    }
  }, [segundos]);

  // ---------- ACCIONES (una por endpoint) ----------
  const agregar = (id) =>
    ejecutar(() => pedir("/api/reserva/agregar", "POST", { alimentoId: id, cantidad: 1 })); // endpoint 3

  const cambiarPorciones = (id, nuevaCantidad) =>
    ejecutar(() => pedir("/api/reserva/actualizar-porciones/" + id, "PUT", { cantidad: nuevaCantidad })); // endpoint 4

  const quitar = (id) =>
    ejecutar(() => pedir("/api/reserva/eliminar/" + id, "DELETE")); // endpoint 5

  const confirmar = () =>
    ejecutar(async () => {
      await pedir("/api/reserva/confirmar", "POST");
      setAviso("✅ ¡Reserva confirmada! Tu stock quedó bloqueado.");
    });

  // ---------- LO QUE SE VE EN PANTALLA ----------
  return (
    <div style={fondo}>
    <Container className="py-3">
    <Container className="py-3">
      {/* Panel superior fijo: saldo y total */}
      <div className="sticky-top">
        <Alert color="info" className="d-flex justify-content-between align-items-center mb-2 px-4 py-3" style={estiloBarra}>
          <span className="fs-5">
          💰 Tu saldo actual:{" "}
          <strong style={{ color: "#4ade80" }}>{dinero(reserva.saldo)}</strong>
          </span>
          <span className="fs-5">
          🧾 Total de tu Reserva:{" "}
          <Badge color="dark" pill style={{ border: "1px solid #ffb020", color: "#ffb020" }}>
          {dinero(reserva.total)}
          </Badge>
          </span>
        </Alert>

        {/* Error del backend (stock o saldo insuficiente) */}
        {error && <UncontrolledAlert color="warning">⚠️ {error}</UncontrolledAlert>}
        {aviso && <Alert color="success">{aviso}</Alert>}
      </div>

     <h1 className="display-3 fw-bold text-center mt-4 mb-1">🍽️ Food DEI</h1>
    <p className="text-center text-white-50" style={{ minHeight: "1.5rem" }}>{cargando && "Cargando..."}</p>

      <Row>
        {/* Zona izquierda: menú del día */}
        <Col xs="12" lg="8">
          <h2 className="h5">Menú del Día</h2>
          <Row>
            {menu.map((plato) => (
              <Col xs="12" md="4" key={plato.id}>
                <PlatoCard plato={plato} onAgregar={agregar} deshabilitado={cargando} />
              </Col>
            ))}
          </Row>
        </Col>

        {/* Zona derecha: bandeja de reserva */}
        <Col xs="12" lg="4">
          <h2 className="h5">Tu Bandeja de Reserva</h2>

          {reserva.reservaActiva && (
            <p className="text-danger">⏱️ Tiempo restante: {formatearTiempo(segundos)}</p>
          )}

          {reserva.itemsReservados.length === 0 ? (
            <p className="text-muted">Aún no has añadido platos.</p>
          ) : (
            <ListGroup className="mb-3">
              {reserva.itemsReservados.map((item) => (
                <ItemReserva
                  key={item.id}
                  item={item}
                  onCambiar={cambiarPorciones}
                  onQuitar={quitar}
                  deshabilitado={cargando}
                />
              ))}
            </ListGroup>
          )}

          <Button
            color="success"
            className="w-100"
            disabled={reserva.itemsReservados.length === 0 || cargando}
            onClick={confirmar}
          >
            Confirmar Reserva
          </Button>
        </Col>
      </Row>
    </Container>
    </Container>
    </div>
  );
}

export default App;
