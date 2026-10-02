const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const RAZORPAY_API = "https://api.razorpay.com/v1/orders";

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
      !RAZORPAY_KEY_ID ||
      !RAZORPAY_KEY_SECRET
    ) {
      return res.status(500).json({
        success: false,
        error: "Razorpay is not configured"
      });
    }

    /* Check remaining tickets */

    const countResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/registration?select=quantity&payment_status=eq.paid`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    const countText =
      await countResponse.text();

    if (!countResponse.ok) {
      return res.status(500).json({
        success: false,
        error: "Unable to check ticket availability"
      });
    }

    const paidRegistrations =
      JSON.parse(countText);

    const sold =
      paidRegistrations.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
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

    /* Ticket amount */

    const amount =
      qty * 399;

    /* Razorpay uses paise */

    const amountInPaise =
      amount * 100;

    /* Create unique order ID */

    const orderId =
      "RZ2K26_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 8);


    /* Razorpay authentication */

    const auth =
      Buffer
        .from(
          `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
        )
        .toString("base64");


    /* Create Razorpay order */

    const razorpayResponse =
      await fetch(
        RAZORPAY_API,
        {
          method: "POST",

          headers: {
            "Authorization":
              `Basic ${auth}`,

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body:
            JSON.stringify({

              amount:
                amountInPaise,

              currency:
                "INR",

              receipt:
                orderId,

              notes: {

                event:
                  "Rangrez Garba Night 2K26",

                student_reg_no:
                  studentRegNo,

                quantity:
                  String(qty)

              }

            })
        }
      );


    const razorpayText =
      await razorpayResponse.text();


    if (!razorpayResponse.ok) {

      console.error(
        "Razorpay error:",
        razorpayText
      );

      return res.status(
        razorpayResponse.status
      ).json({

        success: false,

        error:
          razorpayText

      });

    }


    const razorpayData =
      JSON.parse(
        razorpayText
      );


    /* Save registration */

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
                razorpayData.id

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


    return res.status(200).json({

      success:
        true,

      orderId:
        razorpayData.id,

      amount:
        amount,

      amountInPaise:
        amountInPaise,

      keyId:
        RAZORPAY_KEY_ID,

      registration:
        registrationData[0]

    });


  } catch (error) {

    console.error(
      "Create Razorpay order error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        "Server error"

    });

  }

};
