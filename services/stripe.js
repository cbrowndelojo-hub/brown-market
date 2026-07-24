"use strict";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

function stripeActivo() {
    return Boolean(STRIPE_SECRET_KEY);
}

function webhookActivo() {
    return Boolean(STRIPE_WEBHOOK_SECRET);
}

// Convierte el cuerpo firmado que envía Stripe en un evento verificado.
// Sin STRIPE_WEBHOOK_SECRET configurada (aún no se ha dado de alta el webhook
// en el panel de Stripe) se interpreta el JSON directamente, sin comprobar la
// firma — válido solo para pruebas en local, nunca en producción.
function verificarWebhook(payloadCrudo, firma) {
    const stripe = require("stripe")(STRIPE_SECRET_KEY);

    if (!webhookActivo()) {
        return JSON.parse(payloadCrudo);
    }

    return stripe.webhooks.constructEvent(payloadCrudo, firma, STRIPE_WEBHOOK_SECRET);
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

    // Guardamos id + cantidad en metadata para poder reconstruir el pedido
    // y enviarlo a BigBuy cuando llegue el webhook de pago confirmado.
    const carritoResumido = carrito.map((item) => ({ id: item.id, cantidad: item.cantidad }));

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        shipping_address_collection: { allowed_countries: ["ES", "PT", "FR"] },
        phone_number_collection: { enabled: true },
        metadata: { carrito: JSON.stringify(carritoResumido) },
        success_url: `${SITE_URL}/gracias.html`,
        cancel_url: `${SITE_URL}/productos.html`,
    });

    return session.url;
}

module.exports = { stripeActivo, webhookActivo, verificarWebhook, crearSesionPago };
