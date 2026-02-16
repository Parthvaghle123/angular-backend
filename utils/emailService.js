const SibApiV3Sdk = require("sib-api-v3-sdk");

/**
 * Build HTML body for Starbucks order confirmation
 */
function buildOrderConfirmationHtml(data) {
  const { customerName, orderId, orderDate, paymentMethod, items, totalAmount, address, contactEmail } = data;

  const itemsList = (items || [])
    .map(
      (item) =>
        `• ${item.title || "Item"} (Qty: ${item.quantity || 1}) - ₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`
    )
    .join("<br/>");

  return `
  <div style="max-width:600px; margin:0 auto; background:#fff; padding:30px; border:1px solid #e0e0e0; border-radius:8px;">
    <p style="margin:0 0 16px; color:#000; font-size:16px;">Dear <strong>${customerName || "Customer"}</strong>,</p>
    <p style="margin:0 0 16px; color:#000; font-size:16px;">Thank you for shopping with <strong>Starbucks</strong>! 🎉</p>
    <p style="margin:0 0 24px; color:#000; font-size:16px;">We're happy to let you know that your order has been <strong>successfully placed</strong>.</p>

    <p style="margin:0 0 8px; color:#000; font-size:18px; font-weight:bold; text-align:center;">📦 <strong>Order Details</strong></p>
    <hr style="border:none; border-top:2px dashed #ccc; margin:0 0 16px;">
    <p style="margin:0 0 8px; color:#000; font-size:14px;"><strong>Order ID:</strong> ${orderId || "—"}</p>
    <p style="margin:0 0 8px; color:#000; font-size:14px;"><strong>Order Date:</strong> ${orderDate || "—"}</p>
    <p style="margin:0 0 8px; color:#000; font-size:14px;"><strong>Payment Method:</strong> ${paymentMethod || "—"}</p>
    <p style="margin:0 0 8px; color:#000; font-size:14px;">🛍️ <strong>Items Ordered:</strong></p>
    <p style="margin:0 0 12px 16px; color:#000; font-size:14px;">${itemsList || "—"}</p>
    <p style="margin:0 0 24px; color:#000; font-size:14px;">💰 <strong>Total Amount:</strong> <strong style="color:#0a0;">₹${typeof totalAmount === "number" ? totalAmount.toFixed(2) : totalAmount || "0.00"}</strong></p>

    <p style="margin:0 0 8px; color:#000; font-size:18px; font-weight:bold; text-align:center;">🚚 <strong>Delivery Address</strong></p>
    <hr style="border:none; border-top:2px dashed #ccc; margin:0 0 16px;">
    <div style="background:#f5f5f5; padding:12px 16px; border-radius:6px; margin:0 0 24px;">
      <p style="margin:0; color:#333; font-size:14px;">${address || "—"}</p>
    </div>

    <p style="margin:0 0 16px; color:#000; font-size:14px;">Your order is now being processed, and we'll notify you once it has been shipped.</p>
    <p style="margin:0 0 16px; color:#000; font-size:14px;"><strong>Contact Information:</strong> If you have any questions, feel free to contact us at <a href="mailto:${contactEmail || ""}" style="color:#06c; text-decoration:underline;">${contactEmail || "—"}</a>.</p>
    <p style="margin:0 0 8px; color:#000; font-size:14px;">Thank you for choosing <strong>Starbucks</strong>.</p>
    <p style="margin:0; color:#000; font-size:14px;">We look forward to serving you again! 😊</p>
  </div>
  `;
}

/**
 * Send Email using Brevo API
 */
async function sendOrderConfirmationEmail(order) {
  try {
    const client = SibApiV3Sdk.ApiClient.instance;
    const apiKey = client.authentications["api-key"];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    const createdAt = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");

    const items = order.items || [];
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );

    const htmlContent = buildOrderConfirmationHtml({
      customerName: order.username,
      orderId: order.orderId,
      orderDate: createdAt,
      paymentMethod: order.paymentMethod || "Online Payment",
      items,
      totalAmount,
      address: order.address,
      contactEmail: "support@yourdomain.com",
    });

    const emailData = {
      sender: {
        name: "Starbucks",
        email: "vaghelaparth2005@gmail.com", // verified sender email in Brevo
      },
      to: [
        {
          email: order.email,
          name: order.username,
        },
      ],
      subject: "Order Confirmation - Starbucks",
      htmlContent: htmlContent,
    };

    const response = await emailApi.sendTransacEmail(emailData);

    console.log("Brevo Email Sent:", response.messageId);
    return { success: true };

  } catch (error) {
    console.error("Brevo Email Error:", error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOrderConfirmationEmail };