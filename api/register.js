const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

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

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "Database is not configured"
      });
    }

    const amount = qty * 399;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/registrations`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          full_name: fullName,
          student_reg_no: studentRegNo,
          mobile: mobile,
          email: email,
          quantity: qty,
          amount: amount,
          payment_status: "pending"
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
      registration: data[0]
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
};
