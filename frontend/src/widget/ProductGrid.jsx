/**
 * Renders a "products" flow node: a grid of Admin-configured cards
 * (image, title, description, redirect button), plus a Continue/Done
 * button that moves the conversation on to `node.productsNext` (or ends
 * it, falling back to the legacy contact form, if there isn't one).
 */
export default function ProductGrid({ node, onContinue }) {
  const products = node.products || [];

  return (
    <div className="widget-products">
      <div className="widget-product-grid">
        {products.map((p, i) => (
          <div className="widget-product-card" key={i}>
            {p.image ? (
              <img src={p.image} alt={p.title} className="widget-product-img" loading="lazy" />
            ) : (
              <div className="widget-product-img widget-product-img-placeholder">No image</div>
            )}
            <div className="widget-product-body">
              <div className="widget-product-title">{p.title}</div>
              {p.description && <div className="widget-product-desc">{p.description}</div>}
              {p.redirectUrl && (
                <button
                  className="widget-product-btn"
                  onClick={() => window.open(p.redirectUrl, "_blank", "noopener,noreferrer")}
                >
                  {p.buttonText || "View"} →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="option-btn widget-product-continue" onClick={() => onContinue(node.productsNext)}>
        {node.productsNext ? "Continue" : "Done"}
      </button>
    </div>
  );
}
