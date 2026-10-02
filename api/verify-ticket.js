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

    /*
      First check whether this QR belongs to a paid ticket.
    */

    const lookupResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/registration?qr_token=eq.${encodeURIComponent(qrToken)}&select=id,full_name,student_reg_no,quantity,amount,payment_status,ticket_id,used`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    const lookupText = await lookupResponse.text();

    if (!lookupResponse.ok) {
      console.error("Supabase lookup error:", lookupText);

      return res.status(500).json({
        success: false,
        valid: false,
        error: "Unable to verify ticket"
      });
    }

    const tickets = JSON.parse(lookupText);

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
        error: "Payment has not been completed"
      });
    }

    /*
      If the ticket was already used,
      do not allow entry again.
    */

    if (ticket.used === true) {
      return res.status(200).json({
        success: true,
        valid: false,
        alreadyUsed: true,
        error: "This ticket has already been used"
      });
    }

    /*
      Mark the ticket as USED.

      The condition used=eq.false prevents
      the same ticket from being accepted twice
      if two scanners scan it at almost the same time.
    */

    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/registration?id=eq.${ticket.id}&used=eq.false`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          used: true
        })
      }
    );

    const updateText = await updateResponse.text();

    if (!updateResponse.ok) {
      console.error("Supabase update error:", updateText);

      return res.status(500).json({
        success: false,
        valid: false,
        error: "Unable to mark ticket as used"
      });
    }

    const updatedTickets = JSON.parse(updateText);

    /*
      If another scanner used the ticket first,
      this update returns no row.
    */

    if (!updatedTickets.length) {
      return res.status(200).json({
        success: true,
        valid: false,
        alreadyUsed: true,
        error: "This ticket has already been used"
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
