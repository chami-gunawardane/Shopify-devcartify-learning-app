import { authenticate, unauthenticated } from "../shopify.server";
import { json } from "@remix-run/node";

async function handleRequest(args) {
  const { request } = args;
  let shopDomain = null;
  let invoiceNo = null;

  // 1. AUTHENTICATION (Internal Session OR External API Key)
  try {
    const { session } = await authenticate.admin(request);
    shopDomain = session.shop;
  } catch (e) {
    const authHeader = request.headers.get("X-Adapt-Key");
    if (authHeader !== process.env.X_ADAPT_KEY) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. DATA PARSING
  try {
    const url = new URL(request.url);
    invoiceNo = url.searchParams.get("invoiceNo") || url.searchParams.get("invoiceNumber");
    if (!shopDomain) shopDomain = url.searchParams.get("shop");

    if (request.method !== "GET") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await request.json();
        invoiceNo = invoiceNo || body.invoiceNumber || body.invoiceNo;
        if (!shopDomain) shopDomain = body.shop;
      } else {
        const formData = await request.formData();
        invoiceNo = invoiceNo || formData.get("invoiceNumber") || formData.get("invoiceNo");
        if (!shopDomain) shopDomain = formData.get("shop");
      }
    }
  } catch (err) {
    console.error("⚠️ Parser Error:", err.message);
  }

  if (!invoiceNo || !shopDomain) {
    return json({ error: "Invoice Number is required" }, { status: 400 });
  }

  // 3. SHOPIFY FULFILLMENT LOGIC
  try {
    const { admin } = await unauthenticated.admin(shopDomain);
    const searchQuery = invoiceNo.startsWith("#") ? invoiceNo : `#${invoiceNo}`;

    const orderResponse = await admin.graphql(
      `#graphql
      query getOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              fulfillmentOrders(first: 5, displayable: true) {
                edges { node { id status } }
              }
            }
          }
        }
      }`,
      { variables: { query: `name:${searchQuery}` } },
    );

    const orderData = await orderResponse.json();
    const orderNode = orderData?.data?.orders?.edges?.[0]?.node;

    if (!orderNode) {
      return json({ error: `Order ${searchQuery} not found` }, { status: 404 });
    }

    const openFulfillments = orderNode.fulfillmentOrders.edges
      .filter((edge) => edge.node.status === "OPEN")
      .map((edge) => ({ fulfillmentOrderId: edge.node.id }));

    if (openFulfillments.length === 0) {
      return json({ status: "info", message: "Order is already fulfilled" });
    }

    const fulfillMutation = await admin.graphql(
      `#graphql
      mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id }
          userErrors { message }
        }
      }`,
      { variables: { fulfillment: { lineItemsByFulfillmentOrder: openFulfillments } } },
    );

    const result = await fulfillMutation.json();
    const finalId = result.data?.fulfillmentCreate?.fulfillment?.id;

    if (!finalId) {
      return json({ error: "Shopify fulfillment failed", details: result.data?.fulfillmentCreate?.userErrors }, { status: 400 });
    } 
    
    // SUCCESS LOG FOR FLY LOGS
    console.log(`✅ Success: ${searchQuery} fulfilled.`);

    // THIS IS THE SUCCESS DATA
    return json({ 
      status: "success", 
      message: `Order ${searchQuery} fulfilled successfully!`,
      fulfillment_id: finalId 
    });

  } catch (error) {
    console.error("🔥 Server Error:", error.message);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function loader(args) { return handleRequest(args); }
export async function action(args) { return handleRequest(args); }