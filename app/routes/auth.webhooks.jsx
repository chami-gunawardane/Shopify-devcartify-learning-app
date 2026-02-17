import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Handle customer data request
  if (topic === "customers/data_request") {
    const customer = payload;
    console.log(`Processing data request for customer ${customer.id}`);
    
    // Retrieve customer data from database if needed
    // This is where you would gather all customer data for export
    // For now, we acknowledge receipt of the request
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  // Handle customer data redaction/deletion
  if (topic === "customers/redact") {
    const customer = payload;
    console.log(`Processing redaction for customer ${customer.id}`);
    
    // Delete or anonymize customer data from your database
    // Example: await db.customer.delete({ where: { shopifyId: customer.id } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  // Handle shop data redaction/deletion
  if (topic === "shop/redact") {
    console.log(`Processing redaction for shop ${shop}`);
    
    // Delete or anonymize all data associated with this shop
    // Example: await db.session.deleteMany({ where: { shop } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ success: false }), { status: 400 });
};
