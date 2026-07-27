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

// Envío gratis a partir de este importe de carrito; por debajo, gastos fijos.
const ENVIO_GRATIS_DESDE = 49;
const GASTOS_ENVIO_CENTIMOS = 499; // 4,99 €

function calcularOpcionesEnvio(carrito) {
    const subtotal = carrito.reduce((suma, item) => suma + Number(item.precio) * item.cantidad, 0);
    const esGratis = subtotal >= ENVIO_GRATIS_DESDE;

    return [
        {
            shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: esGratis ? 0 : GASTOS_ENVIO_CENTIMOS, currency: "eur" },
                display_name: esGratis ? "Envío gratis" : "Envío estándar",
                delivery_estimate: {
                    minimum: { unit: "business_day", value: 3 },
                    maximum: { unit: "business_day", value: 10 },
                },
            },
        },
    ];
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
        shipping_options: calcularOpcionesEnvio(carrito),
        phone_number_collection: { enabled: true },
        metadata: { carrito: JSON.stringify(carritoResumido) },
        success_url: `${SITE_URL}/gracias.html`,
        cancel_url: `${SITE_URL}/productos.html`,
    });

    return session.url;
}

module.exports = { stripeActivo, webhookActivo, verificarWebhook, crearSesionPago };
