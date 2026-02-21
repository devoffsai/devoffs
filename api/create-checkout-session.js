export default async function handler(req, res) {
  return res.status(410).json({ error: 'Payments have been removed. Devoffs is completely free.' });

  // 1. Method Check
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Environment Variable Check
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("CRITICAL: STRIPE_SECRET_KEY is missing in environment variables.");
    return res.status(500).json({ 
      error: "Server configuration error: Payment provider key is not configured." 
    });
  }

  // 3. Initialize Stripe
  const stripe = new Stripe(stripeSecretKey);

  try {
    const { userId, email, returnUrl, type, plan } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing required parameter: userId" });
    }
    
    // Dynamic Configuration based on Type and Plan
    // Prices are enforced server-side for security
    let productName = 'Professional Certification Exam';
    let amount = 5000; // $50.00
    let description = 'High-Stakes Skill Verification Exam Access';
    let mode = 'payment'; // Default for one-time
    
    if (type === 'subscription') {
      productName = 'PSN Verified Membership';
      if (plan === 'yearly') {
          amount = 30000; // $300.00
          description = 'Yearly PSN Verified Pro Membership';
      } else {
          amount = 2900; // $29.00
          description = 'Monthly PSN Verified Pro Membership';
      }
      // Note: For real subscriptions you'd use mode: 'subscription', 
      // but here we are using 'payment' for a fixed-term access credits approach as per existing UI.
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: description,
              images: ['https://cdn-icons-png.flaticon.com/512/2921/2921222.png'], 
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: mode,
      success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment_canceled=true`,
      metadata: {
        userId: userId,
        productType: type || "exam",
        plan: plan || 'one_time_entry'
      },
      customer_email: email || undefined,
    });

    // Return the session URL for client-side redirection
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("Stripe Checkout Error:", e.message);
    return res.status(500).json({ error: `Checkout process failed: ${e.message}` });
  }
}