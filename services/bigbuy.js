"use strict";

const BIGBUY_API_BASE = process.env.BIGBUY_API_BASE || "https://api.bigbuy.eu";
const BIGBUY_API_KEY = process.env.BIGBUY_API_KEY || "";

// Catálogo de ejemplo, usado mientras no haya BIGBUY_API_KEY configurada en .env
const PRODUCTOS_MOCK = [
    { id: "auriculares", nombre: "Auriculares Bluetooth", precio: 39.99, imagen: "images/auriculares.svg", categoria: "electronica" },
    { id: "reloj", nombre: "Reloj Inteligente", precio: 59.99, imagen: "images/reloj.svg", categoria: "electronica" },
    { id: "zapatillas", nombre: "Zapatillas Deportivas", precio: 49.99, imagen: "images/zapatillas.svg", categoria: "calzado" },
    { id: "mochila", nombre: "Mochila Antirrobo", precio: 34.99, imagen: "images/mochila.svg", categoria: "accesorios" },
    { id: "altavoz", nombre: "Altavoz Bluetooth", precio: 27.99, imagen: "images/altavoz.svg", categoria: "electronica" },
    { id: "gafas", nombre: "Gafas de Sol Polarizadas", precio: 19.99, imagen: "images/gafas.svg", categoria: "accesorios" },
    { id: "cargador", nombre: "Cargador Inalámbrico", precio: 22.99, imagen: "images/cargador.svg", categoria: "electronica" },
    { id: "funda", nombre: "Funda de Móvil Antigolpes", precio: 14.99, imagen: "images/funda.svg", categoria: "accesorios" },
    { id: "puzzle", nombre: "Puzzle 1000 Piezas", precio: 12.99, imagen: "images/puzzle.svg", categoria: "juguetes" },
    { id: "dron", nombre: "Dron con Cámara para Niños", precio: 34.99, imagen: "images/dron.svg", categoria: "juguetes" },
    { id: "maceta", nombre: "Maceta Autorriego", precio: 16.99, imagen: "images/maceta.svg", categoria: "casa jardin" },
    { id: "herramientas", nombre: "Set de Herramientas de Jardín", precio: 24.99, imagen: "images/herramientas.svg", categoria: "casa jardin" },
    { id: "silla", nombre: "Silla de Escritorio Ergonómica", precio: 89.99, imagen: "images/silla.svg", categoria: "mobiliario" },
    { id: "estanteria", nombre: "Estantería Modular", precio: 59.99, imagen: "images/estanteria.svg", categoria: "mobiliario" },
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
        return { origen: "mock", productos: PRODUCTOS_MOCK.slice(0, limite) };
    }

    try {
        const productos = await obtenerProductosBigBuy(limite);
        return { origen: "bigbuy", productos };
    } catch (error) {
        console.error("Error consultando la API de BigBuy, usando catálogo de ejemplo:", error.message);
        return { origen: "mock", productos: PRODUCTOS_MOCK.slice(0, limite) };
    }
}

module.exports = { obtenerProductos };
