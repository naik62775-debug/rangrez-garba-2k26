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
    const { studentRegNo, email, mobile } = req.body || {};

    if (!studentRegNo || !email || !mobile) {
      return res.status(400).json({
        success: false,
        error: "Registration number, email and mobile are required"
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "Server configuration error"
      });
    }

    const url = new URL(
      `${SUPABASE_URL}/rest/v1/registration`
    );

    url.searchParams.set("student_reg_no", `eq.${studentRegNo.trim()}`);
    url.searchParams.set("email", `eq.${email.trim().toLowerCase()}`);
    url.searchParams.set("mobile", `eq.${mobile.trim()}`);
    url.searchParams.set("payment_status", "eq.paid");
    url.searchParams.set("select", "id,student_reg_no,email,mobile,payment_status,ticket_id,qr_token,used");
    url.searchParams.set("limit", "2");

    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });

    if (!response.ok) {
      console.error("Recovery lookup failed:", await response.text());
      return res.status(500).json({
        success: false,
        error: "Unable to check the booking"
      });
    }

    const rows = await response.json();

    if (
      rows.length !== 1 ||
      !rows[0].ticket_id ||
      !rows[0].qr_token
    ) {
      return res.status(404).json({
        success: false,
        error: "No recoverable paid ticket found. Please contact the event helpline."
      });
    }

    // Identity verification must be completed before returning any QR token.
    return res.status(200).json({
      success: true,
      found: true,
      message: "A paid booking was found. Complete identity verification to recover the ticket."
    });

  } catch (error) {
    console.error("Recovery error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
};
