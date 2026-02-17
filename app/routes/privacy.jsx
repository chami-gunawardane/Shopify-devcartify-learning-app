export default function Privacy() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Privacy Policy for SnapFill</h1>
      <p>Last Updated: February 17, 2026</p>
      <h2>1. Data Collection</h2>
      <p>We collect store domains and order names to facilitate automated fulfillment via our API. We do not collect customer names, emails, or physical addresses.</p>
      <h2>2. Data Usage</h2>
      <p>Data is used strictly to trigger the fulfillment process within the Shopify API. We do not sell or share your data with third parties.</p>
      <h2>3. Data Storage</h2>
      <p>We store encrypted access tokens in a secure database to maintain the connection between your store and our automation service.</p>
    </div>
  );
}