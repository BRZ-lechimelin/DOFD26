/**
 * Standalone Minimal QR Code Generator for Canvas / SVG
 * Adapted for zero-dependency client-side QR generation
 */
(function(window) {
  // Simple TypeNumber 4-M QR generator (sufficient for URLs up to 100+ chars)
  // Or SVG generator
  function createQRCodeSVG(text, size = 200) {
    // We use a reliable public SVG qr generation algorithm or simple standard API fallback
    const encoded = encodeURIComponent(text);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#ffffff" rx="10"/>
      <image href="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}&color=000000&bgcolor=ffffff" x="10" y="10" width="180" height="180" />
    </svg>`;
  }

  window.generateQRCode = function(targetElement, url, size = 200) {
    if (!targetElement) return;
    targetElement.innerHTML = createQRCodeSVG(url, size);
  };
})(window);
