"use strict";

require("dotenv").config();
const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const session = require("express-session");
const { obtenerProductos } = require("./services/bigbuy");
const { stripeActivo, crearSesionPago } = require("./services/stripe");
const { googleActivo, obtenerUrlAutenticacion, obtenerPerfilDesdeCodigo } = require("./services/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || "brownmarket-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(express.static(__dirname));

app.get("/api/productos", async (req, res) => {
    const limite = Number(req.query.limite) || 20;
    const resultado = await obtenerProductos(limite);
    res.json(resultado);
});

app.post("/api/crear-sesion-pago", async (req, res) => {
    const carrito = req.body.carrito;
    if (!Array.isArray(carrito) || carrito.length === 0) {
        return res.status(400).json({ error: "El carrito está vacío" });
    }

    if (!stripeActivo()) {
        return res.json({ demo: true });
    }

    try {
        const url = await crearSesionPago(carrito);
        res.json({ url });
    } catch (error) {
        console.error("Error creando la sesión de pago de Stripe:", error.message);
        res.status(500).json({ error: "No se pudo iniciar el pago" });
    }
});

const RUTA_SUSCRIPTORES = path.join(__dirname, "data", "suscriptores.json");

async function guardarSuscriptor(email) {
    let lista = [];
    try {
        lista = JSON.parse(await fs.readFile(RUTA_SUSCRIPTORES, "utf-8"));
    } catch (error) {
        // Todavía no existe el archivo: se creará ahora.
    }
    if (!lista.includes(email)) lista.push(email);
    await fs.mkdir(path.dirname(RUTA_SUSCRIPTORES), { recursive: true });
    await fs.writeFile(RUTA_SUSCRIPTORES, JSON.stringify(lista, null, 2));
}

app.post("/api/newsletter", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailValido) {
        return res.status(400).json({ error: "Ese email no parece válido" });
    }

    try {
        await guardarSuscriptor(email);
        res.json({ ok: true });
    } catch (error) {
        console.error("Error guardando suscriptor:", error.message);
        res.status(500).json({ error: "No se pudo guardar la suscripción" });
    }
});

app.get("/api/usuario", (req, res) => {
    res.json({ usuario: req.session.usuario || null, googleActivo: googleActivo() });
});

app.get("/auth/google", (req, res) => {
    if (!googleActivo()) {
        return res.redirect("/?error=google-no-configurado");
    }
    res.redirect(obtenerUrlAutenticacion());
});

app.get("/auth/google/callback", async (req, res) => {
    try {
        const perfil = await obtenerPerfilDesdeCodigo(req.query.code);
        req.session.usuario = perfil;
        res.redirect("/");
    } catch (error) {
        console.error("Error en el login con Google:", error.message);
        res.redirect("/?error=login-fallido");
    }
});

app.get("/auth/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => {
    console.log(`Brown Market escuchando en http://localhost:${PORT}`);
});
