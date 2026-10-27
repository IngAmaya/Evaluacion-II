import React from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css"; // estilos de Bootstrap (los usa Reactstrap)
import App from "./App.jsx";

// Dibuja el componente <App /> dentro del <div id="root"> de index.html
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
