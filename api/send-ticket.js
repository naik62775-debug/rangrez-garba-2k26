module.exports = async function handler(req, res) {
  return res.status(410).json({
    success: false,
    message: "This email endpoint is not enabled yet."
  });
};
