import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite: habilita React (JSX) y fija el puerto del frontend
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 }
});
