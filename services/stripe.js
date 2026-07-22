"use strict";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

function stripeActivo() {
    return Boolean(STRIPE_SECRET_KEY);
}

async function crearSesionPago(carrito) {
    const stripe = require("stripe")(STRIPE_SECRET_KEY);

    const line_items = carrito.map((item) => ({
        price_data: {
            currency: "eur",
            product_data: { name: item.nombre },
            unit_amount: Math.round(Number(item.precio) * 100),
        },
        quantity: item.cantidad,
    }));

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        success_url: `${SITE_URL}/gracias.html`,
        cancel_url: `${SITE_URL}/productos.html`,
    });

    return session.url;
}

module.exports = { stripeActivo, crearSesionPago };
