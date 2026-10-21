// 3AmigosBiscuits - site script
// Works on any static host; the forms post to the PHP files (order.php, contact.php),
// which run on Hostinger web hosting.

// ---------- Settings ----------
// Optional: paste a Stripe Payment Link here (https://buy.stripe.com/...) to show a
// "Pay now with card" button after an order is placed. Leave empty to skip it.
const STRIPE_PAYMENT_LINK = '';
const SHIPPING_FLAT = 5.00;
const DIGITAL_ITEMS = ['5']; // product ids that don't ship (recipe PDF)

// ---------- Cart storage ----------
function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem('cart'));
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        return [];
    }
}

let cart = loadCart();

function saveCart() {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) { /* private mode */ }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
    return '$' + Number(n).toFixed(2);
}

// ---------- Header count ----------
function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });
}

// ---------- Toast (replaces alert pop-ups) ----------
let toastTimer;
function showToast(html) {
    let toast = document.querySelector('.cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'cart-toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.innerHTML = html;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---------- Cart actions ----------
function addToCart(id, name, price, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += qty;
    } else {
        cart.push({ id: id, name: name, price: parseFloat(price), quantity: qty });
    }
    saveCart();
    updateCartCount();
    showToast(`${escapeHtml(name)} added to cart <a href="cart.html">View cart</a>`);
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    refreshCartPage();
}

function updateQuantity(id, newQuantity) {
    newQuantity = parseInt(newQuantity, 10);
    if (!newQuantity || newQuantity <= 0) {
        removeFromCart(id);
        return;
    }
    const item = cart.find(item => item.id === id);
    if (item) {
        item.quantity = Math.min(newQuantity, 99);
        saveCart();
        refreshCartPage();
    }
}

function cartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const needsShipping = cart.some(item => !DIGITAL_ITEMS.includes(item.id));
    const shipping = needsShipping ? SHIPPING_FLAT : 0;
    return { subtotal, shipping, total: subtotal + shipping, needsShipping };
}

// ---------- Cart page ----------
function renderCartItems() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-bone fa-2x mb-2" style="color: var(--accent);"></i>
                <p class="mb-3">Your cart is empty.</p>
                <a href="products.html" class="btn btn-primary">Shop Biscuits</a>
            </div>`;
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item" data-id="${escapeHtml(item.id)}">
            <img src="https://placehold.co/80x80/F5F5DC/D2691E?text=${encodeURIComponent(item.name)}" alt="${escapeHtml(item.name)}">
            <div class="cart-details">
                <h5>${escapeHtml(item.name)}</h5>
                <p class="mb-0">${money(item.price)} each &middot; <strong>${money(item.price * item.quantity)}</strong></p>
            </div>
            <div class="cart-actions">
                <button class="quantity-btn" data-action="dec" aria-label="Decrease quantity">-</button>
                <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="99" aria-label="Quantity">
                <button class="quantity-btn" data-action="inc" aria-label="Increase quantity">+</button>
                <button class="remove-btn" data-action="remove" aria-label="Remove item"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function updateCartTotal() {
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    if (!subtotalEl || !shippingEl || !totalEl) return;

    const t = cartTotals();
    subtotalEl.textContent = money(t.subtotal);
    shippingEl.textContent = money(t.shipping);
    totalEl.textContent = money(t.total);

    // Address only needed when something physical ships
    const addressGroup = document.getElementById('address-group');
    const address = document.getElementById('co-address');
    if (addressGroup && address) {
        addressGroup.style.display = t.needsShipping ? '' : 'none';
        address.required = t.needsShipping;
    }
    const box = document.getElementById('checkout-box');
    if (box && !box.dataset.done) box.style.display = cart.length ? '' : 'none';
}

function refreshCartPage() {
    updateCartCount();
    renderCartItems();
    updateCartTotal();
}

// ---------- Form helpers ----------
function setStatus(form, message, ok) {
    const status = form.querySelector('.form-status');
    if (!status) return;
    status.className = 'form-status ' + (ok ? 'ok' : 'err');
    status.textContent = message;
}

async function postForm(form, extra) {
    const data = new FormData(form);
    if (extra) Object.entries(extra).forEach(([k, v]) => data.append(k, v));
    const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
    });
    let json = {};
    try { json = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Something went wrong. Please email us at hello@3amigosbiscuits.com.');
    }
    return json;
}

function wireSimpleForm(form, successMessage) {
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        setStatus(form, 'Sending...', true);
        try {
            await postForm(form);
            form.reset();
            setStatus(form, successMessage, true);
        } catch (err) {
            setStatus(form, err.message, false);
        } finally {
            btn.disabled = false;
        }
    });
}

// ---------- Page setup ----------
document.addEventListener('DOMContentLoaded', function () {
    updateCartCount();
    document.querySelectorAll('.year').forEach(el => { el.textContent = new Date().getFullYear(); });

    // Product page +/- quantity pickers
    document.querySelectorAll('.product-info .quantity-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const input = this.parentElement.querySelector('.quantity-input');
            if (!input) return;
            const step = this.textContent.trim() === '+' ? 1 : -1;
            input.value = Math.min(99, Math.max(1, (parseInt(input.value, 10) || 1) + step));
        });
    });

    // Add to Cart buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function () {
            const qtyInput = this.parentElement.querySelector('.quantity-input');
            addToCart(this.dataset.id, this.dataset.name, this.dataset.price, qtyInput ? qtyInput.value : 1);
            if (qtyInput) qtyInput.value = 1;
        });
    });

    // Cart page
    const cartItems = document.getElementById('cart-items');
    if (cartItems) {
        refreshCartPage();

        cartItems.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const row = btn.closest('.cart-item');
            const item = cart.find(i => i.id === row.dataset.id);
            if (!item) return;
            if (btn.dataset.action === 'inc') updateQuantity(item.id, item.quantity + 1);
            if (btn.dataset.action === 'dec') updateQuantity(item.id, item.quantity - 1);
            if (btn.dataset.action === 'remove') removeFromCart(item.id);
        });
        cartItems.addEventListener('change', function (e) {
            if (!e.target.classList.contains('quantity-input')) return;
            const row = e.target.closest('.cart-item');
            updateQuantity(row.dataset.id, e.target.value);
        });
    }

    // Checkout
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (cart.length === 0) {
                setStatus(checkoutForm, 'Your cart is empty.', false);
                return;
            }
            if (!checkoutForm.checkValidity()) {
                checkoutForm.reportValidity();
                return;
            }
            const btn = document.getElementById('checkout-btn');
            btn.disabled = true;
            setStatus(checkoutForm, 'Placing your order...', true);
            try {
                const result = await postForm(checkoutForm, {
                    cart: JSON.stringify(cart.map(i => ({ id: i.id, quantity: i.quantity })))
                });
                cart = [];
                saveCart();
                refreshCartPage();
                const box = document.getElementById('checkout-box');
                box.dataset.done = '1';
                box.style.display = '';
                const payBtn = STRIPE_PAYMENT_LINK
                    ? `<a href="${STRIPE_PAYMENT_LINK}" class="btn btn-primary mt-3" target="_blank" rel="noopener">Pay ${money(result.total)} now with card</a>`
                    : '';
                box.innerHTML = `
                    <div class="order-success">
                        <i class="fas fa-circle-check mb-2"></i>
                        <h4>Thank you! Order #${escapeHtml(result.orderId)} received.</h4>
                        <p class="mb-0">Your total is <strong>${money(result.total)}</strong>. We've sent a confirmation to your email and will be in touch shortly with payment details.</p>
                        ${payBtn}
                    </div>`;
            } catch (err) {
                setStatus(checkoutForm, err.message, false);
                btn.disabled = false;
            }
        });
    }

    // Contact + newsletter forms
    const contactForm = document.getElementById('contact-form');
    if (contactForm) wireSimpleForm(contactForm, "Thanks! Your message was sent - we'll get back to you soon.");
    document.querySelectorAll('.newsletter-form').forEach(f => wireSimpleForm(f, "You're subscribed!"));
});
