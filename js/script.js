(function () {
    "use strict";

    const CLAVE_CARRITO = "brownmarket_carrito";

    function leerCarrito() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || [];
        } catch (e) {
            return [];
        }
    }

    function guardarCarrito(carrito) {
        localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    }

    function formatoEuros(numero) {
        return numero.toFixed(2).replace(".", ",") + " €";
    }

    function mostrarToast(mensaje) {
        const toast = document.getElementById("toast");
        if (!toast) return;
        toast.textContent = mensaje;
        toast.classList.add("visible");
        clearTimeout(mostrarToast._t);
        mostrarToast._t = setTimeout(() => toast.classList.remove("visible"), 2200);
    }

    function agregarAlCarrito(producto) {
        const carrito = leerCarrito();
        const existente = carrito.find((p) => p.id === producto.id);
        if (existente) {
            existente.cantidad += 1;
        } else {
            carrito.push({ ...producto, cantidad: 1 });
        }
        guardarCarrito(carrito);
        renderizarCarrito();
        mostrarToast(`${producto.nombre} añadido al carrito`);
        abrirCarrito();
    }

    function cambiarCantidad(id, delta) {
        let carrito = leerCarrito();
        const item = carrito.find((p) => p.id === id);
        if (!item) return;
        item.cantidad += delta;
        if (item.cantidad <= 0) {
            carrito = carrito.filter((p) => p.id !== id);
        }
        guardarCarrito(carrito);
        renderizarCarrito();
    }

    function quitarDelCarrito(id) {
        const carrito = leerCarrito().filter((p) => p.id !== id);
        guardarCarrito(carrito);
        renderizarCarrito();
    }

    function renderizarCarrito() {
        const carrito = leerCarrito();
        const contenedor = document.getElementById("carrito-items");
        const contador = document.getElementById("carrito-contador");
        const totalEl = document.getElementById("carrito-total");

        const totalUnidades = carrito.reduce((sum, p) => sum + p.cantidad, 0);
        if (contador) contador.textContent = totalUnidades;

        const total = carrito.reduce((sum, p) => sum + p.cantidad * p.precio, 0);
        if (totalEl) totalEl.textContent = formatoEuros(total);

        if (!contenedor) return;

        if (carrito.length === 0) {
            contenedor.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío.</p>';
            return;
        }

        contenedor.innerHTML = carrito.map((p) => `
            <div class="carrito-item">
                <img src="${p.imagen}" alt="${p.nombre}">
                <div class="carrito-item-info">
                    <h4>${p.nombre}</h4>
                    <div class="carrito-item-precio">${formatoEuros(p.precio)}</div>
                    <div class="carrito-item-cantidad">
                        <button data-accion="restar" data-id="${p.id}">−</button>
                        <span>${p.cantidad}</span>
                        <button data-accion="sumar" data-id="${p.id}">+</button>
                    </div>
                    <button class="carrito-item-quitar" data-accion="quitar" data-id="${p.id}">Quitar</button>
                </div>
            </div>
        `).join("");
    }

    function abrirCarrito() {
        document.getElementById("carrito-overlay")?.classList.add("abierto");
        document.getElementById("carrito-panel")?.classList.add("abierto");
    }

    function cerrarCarrito() {
        document.getElementById("carrito-overlay")?.classList.remove("abierto");
        document.getElementById("carrito-panel")?.classList.remove("abierto");
    }

    function inicializarCarrito() {
        renderizarCarrito();

        document.getElementById("btn-abrir-carrito")?.addEventListener("click", abrirCarrito);
        document.getElementById("btn-cerrar-carrito")?.addEventListener("click", cerrarCarrito);
        document.getElementById("carrito-overlay")?.addEventListener("click", cerrarCarrito);

        document.getElementById("btn-finalizar")?.addEventListener("click", async () => {
            const carrito = leerCarrito();
            if (carrito.length === 0) {
                mostrarToast("Tu carrito está vacío");
                return;
            }

            try {
                const respuesta = await fetch("/api/crear-sesion-pago", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ carrito }),
                });
                const datos = await respuesta.json();

                if (datos.url) {
                    window.location.href = datos.url;
                    return;
                }

                if (datos.demo) {
                    guardarCarrito([]);
                    renderizarCarrito();
                    mostrarToast("¡Gracias por tu compra! (demo, sin pago real — configura STRIPE_SECRET_KEY en .env)");
                    cerrarCarrito();
                    return;
                }

                mostrarToast(datos.error || "No se pudo iniciar el pago");
            } catch (error) {
                mostrarToast("No se pudo conectar con el servidor");
            }
        });

        document.getElementById("carrito-items")?.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-accion]");
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.dataset.accion === "sumar") cambiarCantidad(id, 1);
            if (btn.dataset.accion === "restar") cambiarCantidad(id, -1);
            if (btn.dataset.accion === "quitar") quitarDelCarrito(id);
        });

        // Delegación: los productos se cargan de forma asíncrona desde /api/productos,
        // así que los botones "Comprar" aún no existen en este punto.
        document.getElementById("productos-grid")?.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-id]");
            if (!btn) return;
            agregarAlCarrito({
                id: btn.dataset.id,
                nombre: btn.dataset.nombre,
                precio: parseFloat(btn.dataset.precio),
                imagen: btn.dataset.imagen,
            });
        });
    }

    function tarjetaProductoHTML(producto) {
        const claves = `${producto.nombre} ${producto.categoria || ""}`.toLowerCase();
        return `
            <div class="producto" data-nombre="${claves}">
                <img src="${producto.imagen}" alt="${producto.nombre}">
                <h3>${producto.nombre}</h3>
                <p class="precio">${formatoEuros(producto.precio)}</p>
                <button data-id="${producto.id}" data-nombre="${producto.nombre}" data-precio="${producto.precio}" data-imagen="${producto.imagen}">Comprar</button>
            </div>
        `;
    }

    async function cargarProductos() {
        const grid = document.getElementById("productos-grid");
        if (!grid) return;

        const avisoMock = document.getElementById("aviso-mock");
        const limite = grid.dataset.limite ? Number(grid.dataset.limite) : 20;

        try {
            const respuesta = await fetch(`/api/productos?limite=${limite}`);
            const { origen, productos } = await respuesta.json();

            grid.innerHTML = productos.map(tarjetaProductoHTML).join("");
            if (avisoMock) avisoMock.hidden = origen !== "mock";
        } catch (error) {
            grid.innerHTML = '<p class="cargando-productos">No se pudieron cargar los productos. ¿Está el servidor en marcha?</p>';
        }

        document.dispatchEvent(new CustomEvent("productos-cargados"));
    }

    function inicializarBuscador() {
        const input = document.getElementById("buscador");
        if (!input) return;

        const sinResultados = document.getElementById("sin-resultados");

        function filtrar() {
            const texto = input.value.trim().toLowerCase();
            const productos = Array.from(document.querySelectorAll("#productos-grid .producto"));
            let visibles = 0;

            productos.forEach((producto) => {
                const claves = producto.dataset.nombre || producto.querySelector("h3")?.textContent.toLowerCase() || "";
                const coincide = claves.toLowerCase().includes(texto);
                producto.style.display = coincide ? "" : "none";
                if (coincide) visibles++;
            });

            if (sinResultados) {
                sinResultados.style.display = visibles === 0 ? "block" : "none";
            }
        }

        const params = new URLSearchParams(window.location.search);
        const q = params.get("q");
        if (q) input.value = q;

        input.addEventListener("input", filtrar);
        document.addEventListener("productos-cargados", filtrar);
    }

    function inicializarBuscadorHeader() {
        const form = document.getElementById("buscador-header-form");
        const inputHeader = document.getElementById("buscador-header");
        if (!form || !inputHeader) return;

        const params = new URLSearchParams(window.location.search);
        const q = params.get("q");
        if (q) inputHeader.value = q;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const valor = inputHeader.value.trim();
            const inputPagina = document.getElementById("buscador");

            if (inputPagina) {
                inputPagina.value = valor;
                inputPagina.dispatchEvent(new Event("input"));
                inputPagina.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                window.location.href = `productos.html?q=${encodeURIComponent(valor)}`;
            }
        });
    }

    async function cargarUsuario() {
        const area = document.getElementById("usuario-area");
        if (!area) return;

        try {
            const respuesta = await fetch("/api/usuario");
            const { usuario, googleActivo } = await respuesta.json();

            if (usuario) {
                area.innerHTML = `
                    <img class="usuario-avatar" src="${usuario.foto}" alt="${usuario.nombre}">
                    <span class="usuario-nombre">${usuario.nombre}</span>
                    <a href="/auth/logout" class="usuario-salir">Salir</a>
                `;
            } else if (googleActivo) {
                area.innerHTML = `<a href="/auth/google" class="btn-login-google">Iniciar sesión con Google</a>`;
            }
        } catch (error) {
            // Sin backend disponible (ej. abriendo el HTML como archivo local): no mostramos nada.
        }
    }

    function inicializarNewsletter() {
        const form = document.getElementById("form-newsletter");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = document.getElementById("newsletter-email");
            const email = input.value.trim();

            try {
                const respuesta = await fetch("/api/newsletter", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                const datos = await respuesta.json();

                if (datos.ok) {
                    mostrarToast("¡Gracias por suscribirte! 🎉");
                    form.reset();
                } else {
                    mostrarToast(datos.error || "No se pudo completar la suscripción");
                }
            } catch (error) {
                mostrarToast("No se pudo conectar con el servidor");
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        inicializarCarrito();
        inicializarBuscador();
        inicializarBuscadorHeader();
        inicializarNewsletter();
        cargarProductos();
        cargarUsuario();
    });
})();
