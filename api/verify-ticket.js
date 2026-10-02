const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const qrToken = req.query.qr_token;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: "QR token is required"
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/registration?qr_token=eq.${encodeURIComponent(qrToken)}&select=id,full_name,student_reg_no,quantity,amount,payment_status,ticket_id,qr_token`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("Supabase verification error:", text);

      return res.status(500).json({
        success: false,
        valid: false,
        error: "Unable to verify ticket"
      });
    }

    const tickets = JSON.parse(text);

    if (!tickets.length) {
      return res.status(200).json({
        success: true,
        valid: false,
        error: "Invalid ticket"
      });
    }

    const ticket = tickets[0];

    if (ticket.payment_status !== "paid") {
      return res.status(200).json({
        success: true,
        valid: false,
        error: "Payment not completed"
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      ticket: {
        ticketId: ticket.ticket_id,
        name: ticket.full_name,
        studentRegNo: ticket.student_reg_no,
        quantity: ticket.quantity,
        amount: ticket.amount
      }
    });

  } catch (error) {
    console.error("Ticket verification error:", error);

    return res.status(500).json({
      success: false,
      valid: false,
      error: "Server error"
    });
  }
};
