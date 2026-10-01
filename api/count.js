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
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "Database is not configured"
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/registration?select=quantity&payment_status=eq.paid`,
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
      return res.status(response.status).json({
        success: false,
        error: text
      });
    }

    const registrations = JSON.parse(text);

    const sold = registrations.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );

    const capacity = 369;
    const remaining = Math.max(capacity - sold, 0);

    return res.status(200).json({
      success: true,
      capacity,
      sold,
      remaining,
      soldOut: remaining === 0
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
};
