const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

const CASHFREE_API =
  "https://sandbox.cashfree.com/pg/orders";

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
    } = req.body || {};


    /* =========================
       VALIDATION
    ========================= */

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


    if (
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 5
    ) {

      return res.status(400).json({
        success: false,
        error: "Invalid ticket quantity"
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
       CHECK AVAILABLE TICKETS
    ========================= */

    const countResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/registration?select=quantity&payment_status=eq.paid`,
        {
          method: "GET",

          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization:
              `Bearer ${SUPABASE_SECRET_KEY}`
          }
        }
      );


    const countText =
      await countResponse.text();


    if (!countResponse.ok) {

      return res.status(500).json({
        success: false,
        error:
          "Unable to check ticket availability"
      });

    }


    const paidRegistrations =
      JSON.parse(countText);


    const sold =
      paidRegistrations.reduce(
        (total, item) =>
          total +
          Number(item.quantity || 0),
        0
      );


    const capacity = 369;

    const remaining =
      Math.max(
        capacity - sold,
        0
      );


    if (remaining < qty) {

      return res.status(400).json({
        success: false,
        error:
          `Only ${remaining} ticket(s) are currently available.`
      });

    }


    /* =========================
       AMOUNT
    ========================= */

    const amount =
      qty * 399;


    /* =========================
       CREATE UNIQUE ORDER ID
    ========================= */

    const orderId =
      "RZ2K26_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 8);


    /* =========================
       CREATE CASHFREE ORDER
    ========================= */

    const cashfreeResponse =
      await fetch(
        CASHFREE_API,
        {
          method: "POST",

          headers: {

            "x-client-id":
              CASHFREE_APP_ID,

            "x-client-secret":
              CASHFREE_SECRET_KEY,

            "x-api-version":
              "2025-01-01",

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              order_amount:
                amount,

              order_currency:
                "INR",

              order_id:
                orderId,


              customer_details: {

                customer_id:
                  studentRegNo,

                customer_name:
                  fullName,

                customer_email:
                  email,

                customer_phone:
                  mobile

              },


              order_meta: {

                return_url:
                  "https://rangrez-garba-2k26.vercel.app/?payment=success&order_id={order_id}"

              },


              order_note:
                "Rangrez Garba Night 2K26"

            })

        }
      );


    const cashfreeText =
      await cashfreeResponse.text();


    if (!cashfreeResponse.ok) {

      console.error(
        "Cashfree error:",
        cashfreeText
      );

      return res.status(
        cashfreeResponse.status
      ).json({

        success: false,

        error:
          cashfreeText

      });

    }


    const cashfreeData =
      JSON.parse(
        cashfreeText
      );


    /* =========================
       SAVE PENDING REGISTRATION
    ========================= */

    const supabaseResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/registration`,
        {
          method: "POST",

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

              full_name:
                fullName,

              student_reg_no:
                studentRegNo,

              mobile:
                mobile,

              email:
                email,

              quantity:
                qty,

              amount:
                amount,

              payment_status:
                "pending",

              cashfree_order_id:
                orderId

            })

        }
      );


    const supabaseText =
      await supabaseResponse.text();


    if (!supabaseResponse.ok) {

      console.error(
        "Supabase error:",
        supabaseText
      );

      return res.status(500).json({

        success: false,

        error:
          "Payment order created, but registration could not be saved."

      });

    }


    const registrationData =
      JSON.parse(
        supabaseText
      );


    /* =========================
       RETURN PAYMENT SESSION
    ========================= */

    return res.status(200).json({

      success: true,

      orderId:
        cashfreeData.order_id,

      paymentSessionId:
        cashfreeData.payment_session_id,

      registration:
        registrationData[0]

    });


  }

  catch (error) {

    console.error(
      "Create order error:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        "Server error"

    });

  }

};
