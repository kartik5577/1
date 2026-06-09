import Razorpay from 'razorpay';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, currency = 'INR', receipt } = req.body;
  
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  const checkDemoMode = !keyId || 
                        keyId === 'rzp_test_placeholder' || 
                        !keySecret || 
                        keySecret === 'placeholder_secret';

  if (checkDemoMode) {
    console.log('[Razorpay Vercel] Using Demo Sandbox mode. Mocking order response.');
    return res.status(200).json({
      id: 'order_demo_' + Math.random().toString(36).substring(2, 11),
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt: String(receipt || `rcpt_${Date.now()}`),
      status: 'created',
      key_id: 'rzp_test_placeholder',
      isDemo: true
    });
  }

  try {
    const RazorpayConstructor = Razorpay.default || Razorpay;
    const razorpay = new RazorpayConstructor({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: Math.round(Number(amount) * 100), // amount in smallest currency unit (paise)
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({
      ...order,
      key_id: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID,
      isDemo: false
    });
  } catch (error) {
    console.error('Razorpay Order Creation Error:', error);
    console.log('[Razorpay Vercel] Falling back to Demo order token simulation due to API error');
    res.status(200).json({
      id: 'order_demo_' + Math.random().toString(36).substring(2, 11),
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt: String(receipt || `rcpt_${Date.now()}`),
      status: 'created',
      key_id: 'rzp_test_placeholder',
      isDemo: true,
      fallbackMessage: error.description || error.message || 'Sandbox fallback triggered'
    });
  }
}
