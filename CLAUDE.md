# 3AmigosBiscuits website

Static HTML/CSS/JS site + small PHP scripts, hosted on Hostinger web hosting.
Hostinger auto-deploys the `main` branch into `public_html`, so every push goes live within about a minute.

## Layout
- `index.html`, `products.html`, `about.html`, `contact.html`, `cart.html`, `policies.html` - pages (each repeats the same header/footer; change all of them when editing nav or footer)
- `css/style.css` - all styling (Bootstrap 5 + Font Awesome + Google Fonts load from CDNs)
- `js/script.js` - cart (localStorage), checkout, contact/newsletter forms. `STRIPE_PAYMENT_LINK` setting at top.
- `config.php` - owner email, FROM email, shipping, and the PRODUCT CATALOG used to price orders
- `order.php` - receives checkout, re-prices from config.php, emails owner + customer, logs to data/orders.log
- `contact.php` - contact form + newsletter signups
- `data/` - server-side logs, blocked from the web by data/.htaccess; never commit its contents

## Rules for changes
- **Prices live in three places and must match:** the visible price on products.html (and index.html for products 1-4), the `data-price` on the Add to Cart button, and `$PRODUCTS` in config.php. Also update the comparison table on products.html.
- Product ids: 1 = 10 oz $9.99, 2 = 16 oz $14.99, 3 = 32 oz $24.99, 4 = 3-Pack $25.00, 5 = Recipe PDF $199.99 (digital, no shipping).
- Changes to prices, checkout, order.php or config.php: show James the diff and get his OK before pushing.
- Small text, image, or styling changes: can be pushed directly.
- Before pushing: run `php -l` on any changed PHP file, and check the page renders with no console errors.
- Commit messages should say plainly what changed on the site.
