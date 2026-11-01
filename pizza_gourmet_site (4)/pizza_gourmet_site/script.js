/* ===== CONFIGURAÇÃO ===== */
// Número do WhatsApp da pizzaria: código do país + DDD + número, somente dígitos. Ex.: 5561999999999
const WHATSAPP_NUMBER = "5500000000000";

const SIZES = { "Pequena": 20, "Média": 28, "Grande": 40 };
const EDGE_PRICE = 4;
const STORAGE_KEY = "pizza-gourmet-pedido";

const PIZZAS = {
  "portuguesa":      { name: "Portuguesa",          img: "assets/pizza1.webp" },
  "moda-da-casa":    { name: "À Moda da Casa",      img: "assets/pizza2.webp" },
  "frango-milho":    { name: "Frango com Milho",    img: "assets/pizza3.webp" },
  "frango-catupiry": { name: "Frango com Catupiry", img: "assets/pizza4.webp" }
};

/* ===== ESTADO ===== */
let cart = loadCart();
let current = null;   // pizza aberta na janela
let qty = 1;

const $ = id => document.getElementById(id);
const dialog = $("pizzaDialog");
const form = $("pizzaForm");

/* ===== UTILIDADES ===== */
const money = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const unitPrice = i => SIZES[i.size] + (i.edge ? EDGE_PRICE : 0);
const plural = n => `${n} ${n === 1 ? "item" : "itens"}`;

function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data.filter(i => PIZZAS[i.pizzaId] && SIZES[i.size] && i.qty > 0) : [];
  } catch (e) { return []; }
}
function saveCart() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* ignora */ }
}

let toastTimer;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ===== JANELA DE ESCOLHA ===== */
document.querySelectorAll(".pizza-pick").forEach(btn => {
  btn.addEventListener("click", () => openPizza(btn.dataset.pizza));
});

function openPizza(id) {
  current = id;
  qty = 1;
  const p = PIZZAS[id];
  $("dlgName").textContent = p.name;
  $("dlgImg").src = p.img;
  $("dlgImg").alt = `Pizza ${p.name}`;
  form.querySelector('input[name="size"][value="Pequena"]').checked = true;
  form.querySelector('input[name="edge"][value=""]').checked = true;
  $("obs").value = "";
  refreshDialog();
  dialog.showModal();
}

function dialogItem() {
  return {
    size: form.querySelector('input[name="size"]:checked').value,
    edge: form.querySelector('input[name="edge"]:checked').value
  };
}
function refreshDialog() {
  const { size, edge } = dialogItem();
  $("qtyVal").textContent = qty;
  tween($("dlgTotal"), (SIZES[size] + (edge ? EDGE_PRICE : 0)) * qty);
}
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const shown = new WeakMap();
function tween(el, to) {
  const from = shown.get(el) ?? to;
  shown.set(el, to);
  if (reduce || from === to) { el.textContent = money(to); return; }
  const t0 = performance.now(), dur = 380;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = money(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
form.addEventListener("change", refreshDialog);
$("qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); refreshDialog(); });
$("qtyPlus").addEventListener("click", () => { qty = Math.min(20, qty + 1); refreshDialog(); });
$("dlgClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

form.addEventListener("submit", e => {
  e.preventDefault();
  const { size, edge } = dialogItem();
  const obs = $("obs").value.trim();
  const same = cart.find(i => i.pizzaId === current && i.size === size && i.edge === edge && i.obs === obs);
  if (same) same.qty = Math.min(50, same.qty + qty);
  else cart.push({ id: Date.now() + Math.random(), pizzaId: current, size, edge, obs, qty });
  saveCart();
  const from = $("dlgImg").getBoundingClientRect();
  const src = PIZZAS[current].img;
  dialog.close();
  render();
  flyToCart(src, from);
  toast(`${PIZZAS[current].name} adicionada ao pedido`);
});

/* ===== PEDIDO ===== */
function render() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + unitPrice(i) * i.qty, 0);

  $("headerCount").textContent = count;
  $("itemCount").textContent = plural(count);
  const totalEl = $("cartTotal");
  if (shown.get(totalEl) !== total) {
    tween(totalEl, total);
    totalEl.classList.remove("tick"); void totalEl.offsetWidth; totalEl.classList.add("tick");
  }
  $("floatCount").textContent = plural(count);
  $("floatTotal").textContent = money(total);
  $("checkout").disabled = count === 0;
  $("floatCart").hidden = count === 0;

  // selo de quantidade em cada pizza do cardápio
  document.querySelectorAll(".pizza-pick").forEach(btn => {
    const n = cart.filter(i => i.pizzaId === btn.dataset.pizza).reduce((s, i) => s + i.qty, 0);
    const badge = btn.querySelector(".pick-badge");
    badge.hidden = n === 0;
    badge.textContent = n;
  });

  const list = $("cartItems");
  if (!cart.length) {
    list.innerHTML = '<p class="empty-cart">Seu pedido está vazio. <a href="#cardapio">Escolher uma pizza</a></p>';
    return;
  }
  list.innerHTML = cart.map(i => `
    <div class="cart-row">
      <div>
        <strong>${esc(PIZZAS[i.pizzaId].name)}</strong>
        <small>${i.size}${i.edge ? ` · borda ${esc(i.edge)}` : ""}</small>
        ${i.obs ? `<small>Obs.: ${esc(i.obs)}</small>` : ""}
      </div>
      <span class="row-price">${money(unitPrice(i) * i.qty)}</span>
      <div class="row-actions">
        <div class="mini-qty">
          <button type="button" data-act="dec" data-id="${i.id}" aria-label="Diminuir quantidade">&minus;</button>
          <b>${i.qty}</b>
          <button type="button" data-act="inc" data-id="${i.id}" aria-label="Aumentar quantidade">+</button>
        </div>
        <button type="button" class="remove-item" data-act="del" data-id="${i.id}">Remover</button>
      </div>
    </div>`).join("");
}

$("cartItems").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const item = cart.find(i => String(i.id) === b.dataset.id);
  if (!item) return;
  if (b.dataset.act === "inc") item.qty = Math.min(50, item.qty + 1);
  if (b.dataset.act === "dec") item.qty -= 1;
  if (b.dataset.act === "del" || item.qty <= 0) cart = cart.filter(i => i !== item);
  saveCart();
  render();
});

/* ===== DADOS DO CLIENTE ===== */
const addressField = $("addressField");
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", () => {
  addressField.hidden = r.value === "Retirada" && r.checked;
}));

function showError(msg, field) {
  const el = $("formMsg");
  el.textContent = msg;
  el.hidden = false;
  document.querySelectorAll(".field.invalid").forEach(f => f.classList.remove("invalid"));
  if (field) { field.closest(".field").classList.add("invalid"); field.focus(); }
}

$("checkoutForm").addEventListener("submit", e => {
  e.preventDefault();
  $("formMsg").hidden = true;
  if (!cart.length) return;

  const name = $("custName").value.trim();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const address = $("custAddress").value.trim();
  const pay = $("custPay").value;

  if (!name) return showError("Informe seu nome para continuar.", $("custName"));
  if (mode === "Entrega" && !address) return showError("Informe o endereço de entrega.", $("custAddress"));

  if (WHATSAPP_NUMBER === "5500000000000") {
    return showError("O número de WhatsApp da pizzaria ainda não foi configurado no arquivo script.js.");
  }

  const total = cart.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const lines = cart.map((i, n) =>
    `${n + 1}. ${i.qty}x ${PIZZAS[i.pizzaId].name} (${i.size})` +
    `${i.edge ? `\n   Borda: ${i.edge} (+ ${money(EDGE_PRICE)} cada)` : ""}` +
    `${i.obs ? `\n   Obs.: ${i.obs}` : ""}` +
    `\n   ${money(unitPrice(i) * i.qty)}`);

  const message =
    `Olá! Gostaria de fazer um pedido:\n\n${lines.join("\n\n")}\n\n` +
    `*Total dos itens: ${money(total)}*\n\n` +
    `Nome: ${name}\n` +
    (mode === "Entrega" ? `Entrega: ${address}\n` : "Retirada no local\n") +
    `Pagamento: ${pay}`;

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
});

/* ===== BARRA FLUTUANTE ===== */
const floatCart = $("floatCart");
floatCart.addEventListener("click", () => $("pedido").scrollIntoView({ behavior: "smooth" }));
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => floatCart.classList.toggle("away", entry.isIntersecting), { threshold: 0.15 })
    .observe($("pedido"));
}

/* ===== MENU MOBILE ===== */
const menuToggle = $("menuToggle");
const nav = $("nav");
menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));

render();

/* ===== MOVIMENTO ===== */
function flyToCart(src, r) {
  const target = document.querySelector(".cart-pill");
  const pill = target.getBoundingClientRect();
  target.classList.remove("bump"); void target.offsetWidth;
  if (reduce || !r.width) { target.classList.add("bump"); return; }
  const img = document.createElement("img");
  img.className = "fly"; img.src = src; img.alt = "";
  Object.assign(img.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  document.body.appendChild(img);
  const dx = pill.left + pill.width / 2 - (r.left + r.width / 2);
  const dy = pill.top + pill.height / 2 - (r.top + r.height / 2);
  const a = img.animate([
    { transform: "translate(0,0) scale(1)", opacity: 1 },
    { transform: `translate(${dx * .6}px,${dy * .6 - 60}px) scale(.35)`, opacity: .95, offset: .55 },
    { transform: `translate(${dx}px,${dy}px) scale(.04)`, opacity: .2 }
  ], { duration: 780, easing: "cubic-bezier(.5,0,.2,1)" });
  a.onfinish = () => { img.remove(); target.classList.add("bump"); };
}

// aparecer ao rolar
const revealEls = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  revealEls.forEach(el => io.observe(el));
} else revealEls.forEach(el => el.classList.add("in"));

// inclinação 3D e brilho nas pizzas (só com mouse)
if (!reduce && matchMedia("(hover:hover)").matches) {
  document.querySelectorAll(".pizza-pick").forEach(btn => {
    const pic = btn.querySelector(".pic");
    btn.addEventListener("pointermove", e => {
      const r = pic.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      btn.classList.add("tracking");
      pic.style.setProperty("--ry", ((x - .5) * 9).toFixed(2) + "deg");
      pic.style.setProperty("--rx", ((.5 - y) * 7).toFixed(2) + "deg");
      pic.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      pic.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    });
    btn.addEventListener("pointerleave", () => {
      btn.classList.remove("tracking");
      pic.style.setProperty("--rx", "0deg"); pic.style.setProperty("--ry", "0deg");
    });
  });
}

// rolagem: progresso, cabeçalho, paralaxe
const topbar = document.querySelector(".topbar");
const progress = $("progress");
const heroLogo = document.querySelector(".hero-logo");
let lastY = scrollY, ticking = false;
function onScroll() {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
  if (!nav.classList.contains("open")) topbar.classList.toggle("hide", y > lastY && y > 240);
  lastY = y;
  if (!reduce) {
    heroLogo.style.setProperty("--py", Math.min(y, 800) * -0.12 + "px");
  }
  ticking = false;
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();
