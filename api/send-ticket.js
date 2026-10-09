const { Resend } = require("resend");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const { email, ticketId } = req.body || {};

  if (!email || !ticketId) {
    return res.status(400).json({
      success: false,
      error: "Email and ticket ID are required"
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "Email service is not configured"
    });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: "Rangrez Tickets <onboarding@resend.dev>",
      to: [email],
      subject: "Your Rangrez Garba Night 2K26 Ticket",
      html: `
        <h2>Rangrez – The Garba Night 2K26</h2>
        <p>Your ticket ID is:</p>
        <h3>${ticketId}</h3>
        <p>Keep this ticket ID for reference.</p>
        <p>Event date: 14 October 2026</p>
        <p>Venue: Shree Devi Institution, Kenjar</p>
      `
    });

    if (result.error) {
      return res.status(502).json({
        success: false,
        error: "Unable to send email"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email sent"
    });
  } catch (error) {
    console.error("Email error:", error);
    return res.status(500).json({
      success: false,
      error: "Email sending failed"
    });
  }
};
