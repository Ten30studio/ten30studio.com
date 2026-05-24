const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize Stripe with secret key from environment
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { product_name, price, success_url, cancel_url } = req.body;

    // Validate required fields
    if (!product_name || !price) {
      return res.status(400).json({ error: 'Missing product_name or price' });
    }

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product_name,
            },
            unit_amount: Math.round(price), // price arg is already in cents (per /ai page buyProduct calls)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url || 'https://ten30studio.com?payment=success',
      cancel_url: cancel_url || 'https://ten30studio.com?payment=cancelled',
    });

    // Return the checkout session URL
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
