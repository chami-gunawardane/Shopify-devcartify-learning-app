import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // FIX: Read as formData instead of json
  const formData = await request.formData();
  const invoiceNumber = formData.get("invoiceNumber");

  console.log("Processing fulfillment for order:", invoiceNumber);

  if (!invoiceNumber) {
    return json({ error: "No order number provided" }, { status: 400 });
  }

  try {
    // 1. Get the Fulfillment Order ID for this Order Name
    const orderResponse = await admin.graphql(
      `#graphql
      query getOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              fulfillmentOrders(first: 5, displayable: true) {
                edges {
                  node {
                    id
                    status
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: { query: `name:${invoiceNumber}` } }
    );

    const orderData = await orderResponse.json();
    const orderNode = orderData.data?.orders?.edges[0]?.node;

    if (!orderNode) {
      return json({ error: `Order ${invoiceNumber} not found. Ensure you include the # (e.g. #1001)` }, { status: 404 });
    }

    const openFulfillmentOrders = orderNode.fulfillmentOrders.edges
      .filter(edge => edge.node.status === "OPEN")
      .map(edge => ({ fulfillmentOrderId: edge.node.id }));

    if (openFulfillmentOrders.length === 0) {
      return json({ error: "This order is already fulfilled or has no open fulfillment orders." });
    }

    // 2. Fulfill the Order
    const fulfillMutation = await admin.graphql(
      `#graphql
      mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id }
          userErrors { message }
        }
      }`,
      { variables: { fulfillment: { lineItemsByFulfillmentOrder: openFulfillmentOrders } } }
    );

    const result = await fulfillMutation.json();
    
    if (result.data?.fulfillmentCreate?.userErrors?.length > 0) {
        return json({ error: result.data.fulfillmentCreate.userErrors[0].message }, { status: 400 });
    }

    return json({ success: true, details: result.data });

  } catch (error) {
    console.error("Fulfillment Logic Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}