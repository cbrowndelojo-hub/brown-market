"use strict";

require("dotenv").config();
const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const session = require("express-session");
const { obtenerProductos, bigbuyActivo, crearPedidoBigBuy } = require("./services/bigbuy");
const { stripeActivo, webhookActivo, verificarWebhook, crearSesionPago } = require("./services/stripe");
const { googleActivo, obtenerUrlAutenticacion, obtenerPerfilDesdeCodigo } = require("./services/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// El webhook de Stripe necesita el cuerpo sin procesar para verificar la firma,
// así que esta ruta va antes del express.json() general.
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    let evento;
    try {
        evento = verificarWebhook(req.body, req.headers["stripe-signature"]);
    } catch (error) {
        console.error("Firma de webhook de Stripe inválida:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (evento.type === "checkout.session.completed") {
        const session = evento.data.object;
        try {
            const carrito = JSON.parse(session.metadata?.carrito || "[]");
            const envio = session.shipping_details?.address || session.customer_details?.address || {};

            const resultado = await crearPedidoBigBuy({
                referencia: session.id,
                email: session.customer_details?.email,
                productos: carrito,
                envio: {
                    nombre: session.shipping_details?.name || session.customer_details?.name,
                    telefono: session.customer_details?.phone,
                    direccion1: envio.line1,
                    direccion2: envio.line2,
                    ciudad: envio.city,
                    codigoPostal: envio.postal_code,
                    pais: envio.country,
                },
            });

            console.log(`Pedido ${session.id}: ${resultado.enviado ? "enviado a BigBuy" : "no enviado (" + resultado.motivo + ")"}`);
        } catch (error) {
            console.error(`Error enviando el pedido ${session.id} a BigBuy:`, error.message);
        }
    }

    res.json({ recibido: true });
});

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
