import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const shopify = useAppBridge();
  const fetcher = useFetcher();
  const [orderName, setOrderName] = useState("#1001");

  // --- UPDATED LOGIC FOR TOASTS ONLY ---
  useEffect(() => {
    if (fetcher.data) {
      // Check for "status === 'success'" as defined in your backend
      if (fetcher.data.status === "success") {
        shopify.toast.show(fetcher.data.message || "Order Fulfilled Successfully!");
      } 
      // Check for ".error" as defined in your backend
      else if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [fetcher.data, shopify]);

  const handleFulfill = () => {
    fetcher.submit({ invoiceNumber: orderName }, { method: "POST", action: "/api/updateAdaptDetails" });
  };

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", backgroundColor: "#f6f6f7", minHeight: "100vh" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <h1 style={{ fontSize: "22px", marginBottom: "10px" }}>Order Fulfillment Tester</h1>
        <p style={{ color: "#6d7175", marginBottom: "25px" }}>Type an Order Number from your store to trigger the fulfillment API.</p>
        
        <div style={{ display: "flex", gap: "10px" }}>
          <input 
            type="text" 
            value={orderName} 
            onChange={(e) => setOrderName(e.target.value)}
            style={{ flex: 1, padding: "12px", borderRadius: "4px", border: "1px solid #babfc3", fontSize: "16px" }}
          />
          <button 
            onClick={handleFulfill}
            disabled={fetcher.state !== "idle"}
            style={{ padding: "12px 24px", backgroundColor: "#008060", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}
          >
            {fetcher.state !== "idle" ? "Wait..." : "Fulfill Order"}
          </button>
        </div>

        {/* --- REMOVED THE VISIBLE SERVER RESPONSE BLOCK HERE --- */}
        {/* Only the toasts will show now */}
      </div>
    </div>
  );
}