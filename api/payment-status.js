const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

module.exports = async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const orderId = req.query.order_id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required"
      });
    }


    /* =========================
       CHECK ENVIRONMENT
    ========================= */

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY
    ) {
      return res.status(500).json({
        success: false,
        error: "Supabase is not configured"
      });
    }


    if (
      !CASHFREE_APP_ID ||
      !CASHFREE_SECRET_KEY
    ) {
      return res.status(500).json({
        success: false,
        error: "Cashfree is not configured"
      });
    }


    /* =========================
       GET PAYMENT STATUS
    ========================= */

    const cashfreeResponse =
      await fetch(
        `https://sandbox.cashfree.com/pg/orders/${encodeURIComponent(orderId)}/payments`,
        {
          method: "GET",

          headers: {
            "x-client-id":
              CASHFREE_APP_ID,

            "x-client-secret":
              CASHFREE_SECRET_KEY,

            "x-api-version":
              "2025-01-01",

            "Accept":
              "application/json"
          }
        }
      );


    const cashfreeText =
      await cashfreeResponse.text();


    if (!cashfreeResponse.ok) {

      console.error(
        "Cashfree verification error:",
        cashfreeText
      );

      return res.status(
        cashfreeResponse.status
      ).json({
        success: false,
        error:
          "Unable to verify payment"
      });

    }


    const payments =
      JSON.parse(
        cashfreeText
      );


    /* =========================
       FIND SUCCESSFUL PAYMENT
    ========================= */

    const successfulPayment =
      payments.find(
        payment =>
          payment.payment_status ===
          "SUCCESS"
      );


    if (!successfulPayment) {

      const pendingPayment =
        payments.find(
          payment =>
            payment.payment_status ===
            "PENDING"
        );


      if (pendingPayment) {

        return res.status(200).json({
          success: true,
          status: "PENDING"
        });

      }


      return res.status(200).json({
        success: true,
        status: "FAILED"
      });

    }


    /* =========================
       FIND REGISTRATION
    ========================= */

    const registrationResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/registration?cashfree_order_id=eq.${encodeURIComponent(orderId)}&select=*`,
        {
          method: "GET",

          headers: {
            apikey:
              SUPABASE_SECRET_KEY,

            Authorization:
              `Bearer ${SUPABASE_SECRET_KEY}`,

            "Content-Type":
              "application/json"
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
        error:
          "Unable to find registration"
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
        error:
          "Registration not found"
      });

    }


    const registration =
      registrations[0];


    /* =========================
       ALREADY PAID?
    ========================= */

    if (
      registration.payment_status ===
      "paid" &&
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


    /* =========================
       CREATE TICKET ID
    ========================= */

    const ticketId =
      "RZ26-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();


    /* =========================
       CREATE QR TOKEN
    ========================= */

    const qrToken =
      crypto.randomUUID();


    /* =========================
       UPDATE REGISTRATION
    ========================= */

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
      JSON.parse(
        updateText
      );


    /* =========================
       SUCCESS
    ========================= */

    return res.status(200).json({

      success: true,

      status: "PAID",

      ticketId:
        ticketId,

      qrToken:
        qrToken,

      transactionId:
        successfulPayment.cf_payment_id ||
        successfulPayment.payment_id ||
        null,

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

      error:
        "Server error"

    });

  }

};
