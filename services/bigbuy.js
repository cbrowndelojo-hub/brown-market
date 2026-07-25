"use strict";

const BIGBUY_API_BASE = process.env.BIGBUY_API_BASE || "https://api.bigbuy.eu";
const BIGBUY_API_KEY = process.env.BIGBUY_API_KEY || "";

// Catálogo curado a mano desde el catálogo público de BigBuy (precios de distribuidor
// reales a fecha de hoy), mientras no haya BIGBUY_API_KEY configurada para sincronizar
// automáticamente. Los pedidos de estos productos se gestionan manualmente en BigBuy.
const PRODUCTOS_CURADOS = [
    { id: "auriculares", nombre: "Auriculares Bluetooth Blackfire BFX-40", precio: 34.99, imagen: "images/auriculares.svg", categoria: "electronica" },
    { id: "altavoz", nombre: "Altavoz Bluetooth Medion (Reacondicionado)", precio: 69.99, imagen: "images/altavoz.svg", categoria: "electronica" },
    { id: "zapatillas", nombre: "Zapatillas Deportivas Munich Break", precio: 79.99, imagen: "images/zapatillas.svg", categoria: "calzado" },
    { id: "mochila", nombre: "Mochila Escolar Benetton Damero", precio: 21.99, imagen: "images/mochila.svg", categoria: "accesorios" },
    { id: "funda", nombre: "Funda de Móvil iPhone Just in Case", precio: 12.99, imagen: "images/funda.svg", categoria: "accesorios" },
    { id: "puzzle", nombre: "Puzzle Animales To Go", precio: 4.99, imagen: "images/puzzle.svg", categoria: "juguetes" },
    { id: "conjunto", nombre: "Conjunto Deportivo Infantil Champion", precio: 29.99, imagen: "images/conjunto.svg", categoria: "juguetes" },
    { id: "piscina", nombre: "Piscina Infantil Bestway Dinosaurios", precio: 36.99, imagen: "images/piscina.svg", categoria: "casa jardin" },
    { id: "silla", nombre: "Silla Plegable Aluminio Marbueno", precio: 38.99, imagen: "images/silla.svg", categoria: "mobiliario" },
];

function mapearProductoBigBuy(item) {
    return {
        id: String(item.id ?? item.sku ?? ""),
        nombre: item.name ?? item.title ?? "Producto sin nombre",
        precio: Number(item.retailPrice ?? item.wholesalePrice ?? item.price ?? 0),
        imagen: item.images?.[0]?.url ?? item.image ?? "images/mochila.svg",
        categoria: item.category?.name ?? item.taxonomy ?? "general",
    };
}

async function obtenerProductosBigBuy(limite) {
    // Nota: el endpoint/campos exactos de la API de BigBuy pueden requerir ajustes
    // una vez se pruebe con una cuenta y API key reales.
    const url = `${BIGBUY_API_BASE}/rest/catalog/products.json?isoCode=es&pageSize=${limite}`;

    const respuesta = await fetch(url, {
        headers: {
            Authorization: `Bearer ${BIGBUY_API_KEY}`,
            Accept: "application/json",
        },
    });

    if (!respuesta.ok) {
        throw new Error(`BigBuy respondió ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    const items = Array.isArray(datos) ? datos : datos.products ?? [];
    return items.slice(0, limite).map(mapearProductoBigBuy);
}

async function obtenerProductos(limite = 20) {
    if (!BIGBUY_API_KEY) {
        return { origen: "manual", productos: PRODUCTOS_CURADOS.slice(0, limite) };
    }

    try {
        const productos = await obtenerProductosBigBuy(limite);
        return { origen: "bigbuy", productos };
    } catch (error) {
        console.error("Error consultando la API de BigBuy, usando catálogo de ejemplo:", error.message);
        return { origen: "manual", productos: PRODUCTOS_CURADOS.slice(0, limite) };
    }
}

function bigbuyActivo() {
    return Boolean(BIGBUY_API_KEY);
}

async function crearPedidoBigBuy(pedido) {
    // Nota: estructura orientativa según la documentación pública de la API de pedidos
    // de BigBuy (POST /rest/order/create.json). Es muy probable que necesite ajustes
    // de campos una vez se pruebe contra una cuenta real.
    if (!bigbuyActivo()) {
        console.log("[BigBuy] Modo demo: no se envía el pedido (falta BIGBUY_API_KEY).", pedido);
        return { enviado: false, motivo: "bigbuy-no-configurado" };
    }

    const cuerpo = {
        order: {
            internalReference: pedido.referencia,
            language: "es",
            paymentMethod: "moneybox", // pago con el saldo/monedero de la cuenta BigBuy
            carriers: [{ name: "standard" }],
            products: pedido.productos.map((p) => ({ reference: p.id, quantity: p.cantidad })),
            shippingAddress: {
                firstName: pedido.envio.nombre,
                phone: pedido.envio.telefono,
                email: pedido.email,
                address: pedido.envio.direccion1,
                postcode: pedido.envio.codigoPostal,
                town: pedido.envio.ciudad,
                country: pedido.envio.pais,
            },
        },
    };

    const respuesta = await fetch(`${BIGBUY_API_BASE}/rest/order/create.json`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${BIGBUY_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(cuerpo),
    });

    if (!respuesta.ok) {
        const texto = await respuesta.text();
        throw new Error(`BigBuy respondió ${respuesta.status}: ${texto}`);
    }

    return { enviado: true, datos: await respuesta.json() };
}

module.exports = { obtenerProductos, bigbuyActivo, crearPedidoBigBuy };
