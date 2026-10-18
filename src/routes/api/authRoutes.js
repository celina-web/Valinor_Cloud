const express = require("express");
const { requiereLogin } = require("../../middlewares/auth");
const { login, logout, usuarioActual } = require("../../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/logout", requiereLogin, logout);
router.get("/yo", requiereLogin, usuarioActual);

module.exports = router;
