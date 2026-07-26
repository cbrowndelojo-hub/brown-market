"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const SCRATCH_DIR = "C:\\Users\\34643\\AppData\\Local\\Temp\\claude\\C--Users-34643-OneDrive-Documentos-Brownmarket\\c992f725-8bb0-4976-adbc-42870182288c\\scratchpad";
const IMAGENES_DIR = path.join(__dirname, "..", "images", "productos");
const SALIDA = path.join(__dirname, "..", "services", "catalogo-productos.json");

const CATEGORIAS = {
    "belleza.json": "belleza",
    "electronica.json": "electronica",
    "hogar.json": "hogar",
    "mascotas.json": "mascotas",
    "iluminacion.json": "hogar",
    "deportes.json": "deportes",
    "juguetes.json": "juguetes",
    "bebe.json": "bebe",
    "joyeria.json": "joyeria",
    "oficina.json": "oficina",
    "ropa.json": "moda",
};

function quitarAcentos(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function slugify(nombre, indice) {
    let base = quitarAcentos(nombre)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    if (!base) base = "producto";
    return `${base}-${indice}`;
}

function precioVenta(precioDist) {
    let mult;
    if (precioDist < 3) mult = 3.2;
    else if (precioDist < 8) mult = 2.5;
    else if (precioDist < 20) mult = 2.05;
    else if (precioDist < 50) mult = 1.75;
    else if (precioDist < 100) mult = 1.55;
    else mult = 1.4;

    let precio = precioDist * mult;
    precio = Math.ceil(precio) - 0.01;
    if (precio < 2.99) precio = 2.99;
    return Math.round(precio * 100) / 100;
}

function descargarImagen(url, destino) {
    return new Promise((resolve) => {
        const opciones = {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        };
        const archivo = fs.createWriteStream(destino);
        const peticion = https.get(url, opciones, (respuesta) => {
            if (respuesta.statusCode !== 200) {
                archivo.close();
                fs.unlink(destino, () => {});
                resolve(false);
                return;
            }
            respuesta.pipe(archivo);
            archivo.on("finish", () => {
                archivo.close();
                resolve(true);
            });
        });
        peticion.on("error", () => {
            archivo.close();
            fs.unlink(destino, () => {});
            resolve(false);
        });
        peticion.setTimeout(15000, () => {
            peticion.destroy();
        });
    });
}

async function descargarConLimite(tareas, limite) {
    const resultados = [];
    let indice = 0;
    async function trabajador() {
        while (indice < tareas.length) {
            const miIndice = indice++;
            resultados[miIndice] = await tareas[miIndice]();
        }
    }
    const trabajadores = Array.from({ length: limite }, trabajador);
    await Promise.all(trabajadores);
    return resultados;
}

async function main() {
    if (!fs.existsSync(IMAGENES_DIR)) fs.mkdirSync(IMAGENES_DIR, { recursive: true });

    const productos = [];
    let contadorGlobal = 0;

    for (const [archivo, categoria] of Object.entries(CATEGORIAS)) {
        const rutaArchivo = path.join(SCRATCH_DIR, archivo);
        if (!fs.existsSync(rutaArchivo)) {
            console.warn(`Aviso: no existe ${rutaArchivo}, se omite.`);
            continue;
        }
        const items = JSON.parse(fs.readFileSync(rutaArchivo, "utf8"));
        for (const item of items) {
            if (!item.nombre || !item.imagen || item.precioDist == null) continue;
            contadorGlobal++;
            const id = slugify(item.nombre, contadorGlobal);
            const ext = ".jpg";
            const nombreArchivoImagen = `${id}${ext}`;
            productos.push({
                id,
                nombre: item.nombre,
                precio: precioVenta(item.precioDist),
                imagenUrl: item.imagen,
                imagenLocal: `images/productos/${nombreArchivoImagen}`,
                categoria,
            });
        }
    }

    console.log(`Total de productos a procesar: ${productos.length}`);

    const tareas = productos.map((p) => async () => {
        const destino = path.join(IMAGENES_DIR, path.basename(p.imagenLocal));
        if (fs.existsSync(destino) && fs.statSync(destino).size > 0) return true;
        const ok = await descargarImagen(p.imagenUrl, destino);
        return ok;
    });

    const resultados = await descargarConLimite(tareas, 10);

    let exitos = 0;
    const productosFinales = [];
    productos.forEach((p, i) => {
        if (resultados[i]) {
            exitos++;
            p.imagen = p.imagenLocal;
            delete p.imagenUrl;
            delete p.imagenLocal;
            productosFinales.push(p);
        }
        // Si la descarga falla (ej. imagen eliminada del catálogo de BigBuy), se descarta
        // el producto en vez de enlazar a una URL remota rota.
    });

    console.log(`Imágenes descargadas correctamente: ${exitos}`);
    console.log(`Productos descartados por imagen no disponible: ${productos.length - exitos}`);

    fs.writeFileSync(SALIDA, JSON.stringify(productosFinales, null, 2), "utf8");
    console.log(`Catálogo escrito en ${SALIDA} (${productosFinales.length} productos)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
