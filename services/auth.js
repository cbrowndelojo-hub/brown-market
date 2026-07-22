"use strict";

const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const REDIRECT_URI = `${SITE_URL}/auth/google/callback`;

function googleActivo() {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function crearClienteOAuth() {
    return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

function obtenerUrlAutenticacion() {
    const client = crearClienteOAuth();
    return client.generateAuthUrl({
        access_type: "online",
        scope: ["openid", "email", "profile"],
        prompt: "select_account",
    });
}

async function obtenerPerfilDesdeCodigo(code) {
    const client = crearClienteOAuth();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    return {
        nombre: payload.name,
        email: payload.email,
        foto: payload.picture,
    };
}

module.exports = { googleActivo, obtenerUrlAutenticacion, obtenerPerfilDesdeCodigo };
