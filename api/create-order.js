const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      fullName,
      studentRegNo,
      mobile,
      email,
      quantity
    } = req.body;

    if (
      !fullName ||
      !studentRegNo ||
      !mobile ||
      !email ||
      !quantity
    ) {
      return res.status(400).json({
        success: false,
        error: "Please fill all required fields"
      });
    }

    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty < 1 || qty > 5) {
      return res.status(400).json({
        success: false,
        error: "Invalid ticket quantity"
      });
    }

    const amount = qty * 399;

    const orderId =
      "RZ2K26_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substring(2, 8);

    const response = await fetch(
      "https://sandbox.cashfree.com/pg/orders",
      {
        method: "POST",
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": "2025-01-01",
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          order_amount: amount,
          order_currency: "INR",
          order_id: orderId,

          customer_details: {
            customer_id: studentRegNo,
            customer_name: fullName,
            customer_email: email,
            customer_phone: mobile
          },

          order_meta: {
            return_url:
              "https://rangrez-garba-2k26.vercel.app/?payment=success&order_id={order_id}"
          }
        })
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: text
      });
    }

    const data = JSON.parse(text);

    return res.status(200).json({
      success: true,
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
};
