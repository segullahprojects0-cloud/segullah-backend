import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Generate MD5 signature for PayFast
 * @param {Object} data - Payment data object
 * @param {string} passphrase - PayFast passphrase
 * @returns {string} - MD5 signature
 */
function generateSignature(data, passphrase = null) {
  let pfParamString = '';

  // Sort the data by key
  const sortedData = {};
  Object.keys(data).sort().forEach(key => {
    sortedData[key] = data[key];
  });

  // Create parameter string
  for (const key in sortedData) {
    if (sortedData.hasOwnProperty(key) && sortedData[key] !== '') {
      pfParamString += `${key}=${encodeURIComponent(sortedData[key].toString().trim()).replace(/%20/g, '+')}&`;
    }
  }

  // Remove last ampersand
  pfParamString = pfParamString.slice(0, -1);

  // Add passphrase if provided
  if (passphrase !== null) {
    pfParamString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }

  // Generate MD5 hash
  return crypto.createHash('md5').update(pfParamString).digest('hex');
}

/**
 * Validate IP address is from PayFast
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid PayFast IP
 */
function isValidPayFastIP(ip) {
  const validHosts = [
    'www.payfast.co.za',
    'sandbox.payfast.co.za',
    'w1w.payfast.co.za',
    'w2w.payfast.co.za'
  ];

  // For sandbox testing, we'll be more lenient
  if (process.env.PAYFAST_SANDBOX === 'true') {
    return true;
  }

  // In production, validate the IP properly
  // You would need to implement DNS lookup here
  return true;
}

/**
 * POST /api/create-payment
 * Generate signed PayFast payment data
 */
app.post('/api/create-payment', (req, res) => {
  try {
    const { amount, itemName, customerName, customerEmail, customerPhone } = req.body;

    // Validate required fields
    if (!amount || !itemName) {
      return res.status(400).json({
        success: false,
        error: 'Amount and item name are required'
      });
    }

    // Prepare PayFast data
    const paymentData = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY,
      return_url: process.env.PAYFAST_RETURN_URL,
      cancel_url: process.env.PAYFAST_CANCEL_URL,
      notify_url: process.env.PAYFAST_NOTIFY_URL,
      name_first: customerName ? customerName.split(' ')[0] : 'Customer',
      name_last: customerName ? customerName.split(' ').slice(1).join(' ') || 'Name' : 'Name',
      email_address: customerEmail || 'noreply@segullah.co.za',
      cell_number: customerPhone || '',
      m_payment_id: `ORDER_${Date.now()}`,
      amount: parseFloat(amount).toFixed(2),
      item_name: itemName,
      item_description: `Payment for ${itemName}`,
      custom_str1: customerEmail || '',
      custom_str2: customerPhone || ''
    };

    // Generate signature
    const signature = generateSignature(paymentData, process.env.PAYFAST_PASSPHRASE);

    // Add signature to payment data
    paymentData.signature = signature;

    // Determine PayFast URL based on environment
    const payfastUrl = process.env.PAYFAST_SANDBOX === 'true'
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    console.log('Payment created:', {
      m_payment_id: paymentData.m_payment_id,
      amount: paymentData.amount,
      item_name: paymentData.item_name
    });

    res.json({
      success: true,
      data: paymentData,
      payfastUrl
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
});

/**
 * POST /api/payfast/notify
 * Handle PayFast ITN (Instant Transaction Notification)
 */
app.post('/api/payfast/notify', async (req, res) => {
  try {
    console.log('PayFast ITN received:', req.body);

    const pfData = req.body;

    // Step 1: Verify that the request is from PayFast
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!isValidPayFastIP(clientIp)) {
      console.error('Invalid IP address:', clientIp);
      return res.status(403).send('Invalid IP');
    }

    // Step 2: Verify signature
    const pfSignature = pfData.signature;
    delete pfData.signature;

    const calculatedSignature = generateSignature(pfData, process.env.PAYFAST_PASSPHRASE);

    if (calculatedSignature !== pfSignature) {
      console.error('Signature mismatch');
      return res.status(400).send('Invalid signature');
    }

    // Step 3: Validate data with PayFast server
    try {
      const payfastValidateUrl = process.env.PAYFAST_SANDBOX === 'true'
        ? 'https://sandbox.payfast.co.za/eng/query/validate'
        : 'https://www.payfast.co.za/eng/query/validate';

      const validation = await axios.post(
        payfastValidateUrl,
        new URLSearchParams(pfData).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (validation.data !== 'VALID') {
        console.error('PayFast validation failed:', validation.data);
        return res.status(400).send('Validation failed');
      }

      console.log('PayFast validation successful');

    } catch (validationError) {
      console.error('Error validating with PayFast:', validationError.message);
      // In sandbox mode, we can be more lenient
      if (process.env.PAYFAST_SANDBOX !== 'true') {
        return res.status(500).send('Validation error');
      }
    }

    // Step 4: Process the payment
    const paymentStatus = pfData.payment_status;
    const merchantPaymentId = pfData.m_payment_id;
    const amountGross = pfData.amount_gross;

    console.log('Payment processed:', {
      m_payment_id: merchantPaymentId,
      payment_status: paymentStatus,
      amount_gross: amountGross
    });

    // Here you would typically:
    // 1. Update your database with the payment status
    // 2. Send confirmation emails
    // 3. Update order status
    // 4. Trigger any post-payment workflows

    if (paymentStatus === 'COMPLETE') {
      console.log(`Payment ${merchantPaymentId} completed successfully`);
      // TODO: Update database, send confirmation email, etc.
    } else {
      console.log(`Payment ${merchantPaymentId} status: ${paymentStatus}`);
    }

    // Always respond with 200 OK to acknowledge receipt
    res.status(200).send('OK');

  } catch (error) {
    console.error('Error processing ITN:', error);
    res.status(500).send('Internal error');
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.PAYFAST_SANDBOX === 'true' ? 'sandbox' : 'production'
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Segullah PayFast Payment Server',
    version: '1.0.0',
    endpoints: [
      'POST /api/create-payment',
      'POST /api/payfast/notify',
      'GET /health'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 PayFast Payment Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.PAYFAST_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUCTION'}`);
  console.log(`🔗 Server URL: http://localhost:${PORT}\n`);
});
