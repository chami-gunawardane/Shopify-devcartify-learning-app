import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export async function action({ request }) {
  console.log("Received request to update Adapt details");
  
  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.json();
    const invoiceNumber = body.invoiceNumber;

    console.log("Adapt details received:", body);

    // Query to find the order by invoice number
    const orderQuery = `
      query {
        orders(first: 1, query: "name:${invoiceNumber}") {
          edges {
            node {
              id
              name
              fulfillmentOrders(first: 10, query: "status:OPEN OR status:SCHEDULED") {
                edges {
                  node {
                    id
                    status
                    lineItems(first: 10) {
                      edges {
                        node {
                          id
                          quantity
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const orderResponse = await admin.graphql(orderQuery);
    const orderData = await orderResponse.json();

    console.log("Order query response:", JSON.stringify(orderData, null, 2));

    if (orderData.errors) {
      return json({ error: orderData.errors }, { status: 400 });
    }

    if (!orderData.data?.orders?.edges?.length) {
      return json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderData.data.orders.edges[0].node;
    const fulfillmentOrders = order.fulfillmentOrders.edges;

    if (!fulfillmentOrders.length) {
      return json({ error: "No fulfillment orders found" }, { status: 400 });
    }

    // Build the fulfillment input
    const fulfillmentInput = fulfillmentOrders.map(({ node }) => ({
      id: node.id,
      lineItems: node.lineItems.edges.map((edge) => ({
        id: edge.node.id,
        quantity: edge.node.quantity,
      })),
    }));

    // Create fulfillment mutation
    const fulfillmentMutation = `
      mutation fulfillOrders($fulfillmentOrders: [FulfillmentOrderInput!]!) {
        fulfillmentOrdersFulfill(fulfillmentOrders: $fulfillmentOrders) {
          fulfillmentOrders {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fulfillmentResponse = await admin.graphql(fulfillmentMutation, {
      variables: {
        fulfillmentOrders: fulfillmentInput,
      },
    });
    
    const fulfillmentData = await fulfillmentResponse.json();

    console.log("Fulfillment response:", JSON.stringify(fulfillmentData, null, 2));

    if (fulfillmentData.errors) {
      return json({ error: fulfillmentData.errors }, { status: 400 });
    }

    if (fulfillmentData.data?.fulfillmentOrdersFulfill?.userErrors?.length) {
      return json({ error: fulfillmentData.data.fulfillmentOrdersFulfill.userErrors }, { status: 400 });
    }

    console.log("Order fulfilled successfully:", fulfillmentData.data.fulfillmentOrdersFulfill.fulfillmentOrders);

    return json({ 
      success: true,
      data: fulfillmentData.data.fulfillmentOrdersFulfill 
    });
  } catch (error) {
    console.error("Error fulfilling order:", error);
    
    // Check if it's an auth error
    if (error.status === 410 || error.message?.includes("410")) {
      return json(
        { error: "Unauthorized - Please make this request from within the Shopify app" }, 
        { status: 401 }
      );
    }
    
    return json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
