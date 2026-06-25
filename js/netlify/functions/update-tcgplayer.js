// Base para futura integración TCGplayer
// Aquí se obtendrán automáticamente imágenes y precios
exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Pendiente de conectar TCGplayer"
    })
  };
};
