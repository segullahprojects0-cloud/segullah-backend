# PayFast Payment Server

Backend API server for handling PayFast payment integration.

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Edit the `.env` file with your actual PayFast credentials:

```env
# Get these from your PayFast Dashboard (https://www.payfast.co.za)
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase

# Update these URLs with your deployed domain
PAYFAST_NOTIFY_URL=https://segullahprojects.co.za/api/payfast/notify
PAYFAST_RETURN_URL=https://segullahprojects.co.za/success
PAYFAST_CANCEL_URL=https://segullahprojects.co.za/cancel

# Server port
PORT=3001

# Set to true for testing, false for production
PAYFAST_SANDBOX=true
```

### 3. Start the Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### 1. Create Payment

**POST** `/api/create-payment`

Creates a signed PayFast payment request.

**Request Body:**
```json
{
  "amount": 250.00,
  "itemName": "Classic T-Shirt x1",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+27123456789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant_id": "...",
    "merchant_key": "...",
    "amount": "250.00",
    "item_name": "Classic T-Shirt x1",
    "signature": "...",
    ...
  },
  "payfastUrl": "https://sandbox.payfast.co.za/eng/process"
}
```

### 2. PayFast ITN Handler

**POST** `/api/payfast/notify`

Receives Instant Transaction Notifications from PayFast.

This endpoint:
- Validates the request is from PayFast
- Verifies the signature
- Validates with PayFast servers
- Processes the payment status

### 3. Health Check

**GET** `/health`

Returns server health status.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "sandbox"
}
```

## Getting PayFast Credentials

1. Sign up at [PayFast](https://www.payfast.co.za)
2. For testing, use the [PayFast Sandbox](https://sandbox.payfast.co.za)
3. Get your credentials from the dashboard:
   - Merchant ID
   - Merchant Key
   - Set a Passphrase in Settings > Integration

### Sandbox Test Credentials

For testing, PayFast provides sandbox credentials:
- Merchant ID: `10000100`
- Merchant Key: `46f0cd694581a`
- No passphrase needed for sandbox

## Deployment

### Deploy to Production Server

1. Choose a hosting provider (DigitalOcean, AWS, Heroku, etc.)
2. Upload the `server` folder
3. Install dependencies: `npm install`
4. Set environment variables on your server
5. Start the server: `npm start`
6. Ensure your server is accessible via HTTPS
7. Update PayFast dashboard with your notify URL

### Important Notes

- **HTTPS Required**: PayFast requires HTTPS for production
- **Notify URL**: Must be publicly accessible for PayFast to send ITN
- **Firewall**: Ensure port is open for PayFast IPs
- **Keep Secrets Safe**: Never commit `.env` to version control

## Testing

### Test Payment Flow

1. Start the server: `npm run dev`
2. Start the frontend: `cd .. && npm run dev`
3. Add items to cart and proceed to checkout
4. Fill in billing information
5. Click "Pay Now"
6. You'll be redirected to PayFast sandbox
7. Use sandbox test cards to complete payment

### Test Cards (Sandbox)

PayFast sandbox provides test card numbers for different scenarios.

## Troubleshooting

### Port Already in Use
```bash
# Change PORT in .env to a different value
PORT=3002
```

### CORS Errors
- Ensure frontend URL is allowed in CORS configuration
- Check browser console for detailed error messages

### Signature Mismatch
- Verify passphrase matches exactly (no extra spaces)
- Check that all data fields are included in signature generation
- Ensure data is URL-encoded correctly

### ITN Not Received
- Verify notify URL is publicly accessible
- Check server logs for incoming requests
- Ensure firewall allows PayFast IPs
- For local testing, use ngrok or similar tunneling service

## Security Checklist

- [ ] Never commit `.env` to version control
- [ ] Use HTTPS in production
- [ ] Validate all PayFast notifications
- [ ] Keep dependencies updated
- [ ] Use strong passphrase (min 16 characters)
- [ ] Implement rate limiting for production
- [ ] Add request logging and monitoring
- [ ] Validate IP addresses in production

## Support

For PayFast support: [https://www.payfast.co.za/support](https://www.payfast.co.za/support)

For Segullah support: info@segullah.co.za
