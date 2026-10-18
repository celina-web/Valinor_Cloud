const mongoose = require("mongoose");

const conectarDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/turnoflex";
  mongoose.set("sanitizeFilter", true);
  await mongoose.connect(uri);
  console.log(`MongoDB conectado: ${mongoose.connection.name}`);
};

module.exports = conectarDB;
