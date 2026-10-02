const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const { createHmac, randomUUID } = require("crypto");

module.exports = async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const orderId = req.query.order_id;
    const paymentId = req.query.payment_id;
    const signature = req.query.signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        error: "Payment verification details are required"
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "Supabase is not configured"
      });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        error: "Razorpay is not configured"
      });
    }

    /* Verify Razorpay signature */

    const expectedSignature =
      createHmac(
        "sha256",
        RAZORPAY_KEY_SECRET
      )
        .update(
          orderId + "|" + paymentId
        )
        .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature"
      });
    }

    /* Razorpay authentication */

    const auth =
      Buffer
        .from(
          `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
        )
        .toString("base64");

    /* Get order */

    const orderResponse =
      await fetch(
        `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Basic ${auth}`,
            Accept:
              "application/json"
          }
        }
      );

    const orderText =
      await orderResponse.text();

    if (!orderResponse.ok) {
      console.error(
        "Razorpay order error:",
        orderText
      );

      return res.status(500).json({
        success: false,
        error: "Unable to verify Razorpay order"
      });
    }

    const order =
      JSON.parse(orderText);

    /* Get payments */

    const paymentsResponse =
      await fetch(
        `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Basic ${auth}`,
            Accept:
              "application/json"
          }
        }
      );

    const paymentsText =
      await paymentsResponse.text();

    if (!paymentsResponse.ok) {
      console.error(
        "Razorpay payment error:",
        paymentsText
      );

      return res.status(500).json({
        success: false,
        error: "Unable to verify payment"
      });
    }

    const paymentsData =
      JSON.parse(paymentsText);

    const successfulPayment =
      (paymentsData.items || []).find(
        payment =>
          payment.id === paymentId &&
          payment.status === "captured"
      );

    if (!successfulPayment) {

      return res.status(200).json({
        success: true,
        status: "FAILED"
      });

    }

    /* Find registration */

    const registrationResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/registration?cashfree_order_id=eq.${encodeURIComponent(orderId)}&select=*`,
        {
          method: "GET",
          headers: {
            apikey:
              SUPABASE_SECRET_KEY,
            Authorization:
              `Bearer ${SUPABASE_SECRET_KEY}`
          }
        }
      );

    const registrationText =
      await registrationResponse.text();

    if (!registrationResponse.ok) {
      console.error(
        "Registration lookup error:",
        registrationText
      );

      return res.status(500).json({
        success: false,
        error: "Unable to find registration"
      });
    }

    const registrations =
      JSON.parse(
        registrationText
      );

    if (
      !registrations ||
      registrations.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error: "Registration not found"
      });
    }

    const registration =
      registrations[0];

    /* Verify amount */

    const expectedAmount =
      Number(registration.amount) * 100;

    if (
      Number(order.amount) !==
      expectedAmount
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment amount does not match registration amount"
      });
    }

    /* Ticket already generated */

    if (
      registration.payment_status === "paid" &&
      registration.ticket_id
    ) {

      return res.status(200).json({

        success: true,

        status: "PAID",

        ticketId:
          registration.ticket_id,

        qrToken:
          registration.qr_token,

        registration:
          registration

      });

    }

    /* Generate ticket */

    const ticketId =
      "RZ26-" +
      Date.now()
        .toString(36)
        .toUpperCase() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();

    const qrToken =
      randomUUID();

    /* Update registration */

    const updateResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/registration?id=eq.${registration.id}`,
        {
          method: "PATCH",

          headers: {
            apikey:
              SUPABASE_SECRET_KEY,

            Authorization:
              `Bearer ${SUPABASE_SECRET_KEY}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation"
          },

          body:
            JSON.stringify({

              payment_status:
                "paid",

              ticket_id:
                ticketId,

              qr_token:
                qrToken

            })
        }
      );

    const updateText =
      await updateResponse.text();

    if (!updateResponse.ok) {

      console.error(
        "Supabase update error:",
        updateText
      );

      return res.status(500).json({
        success: false,
        error:
          "Payment verified but ticket could not be generated"
      });

    }

    const updatedRegistration =
      JSON.parse(updateText);

    return res.status(200).json({

      success: true,

      status: "PAID",

      ticketId:
        ticketId,

      qrToken:
        qrToken,

      transactionId:
        paymentId,

      registration:
        updatedRegistration[0]

    });

  } catch (error) {

    console.error(
      "Payment status error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Server error"
    });

  }

};
