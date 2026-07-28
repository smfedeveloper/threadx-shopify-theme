document.documentElement.classList.remove("no-js");

const money = (cents) => {
  const currency = window.Shopify?.currency?.active || "USD";
  return new Intl.NumberFormat(document.documentElement.lang || "en", { style: "currency", currency }).format(cents / 100);
};

const cartDrawer = document.querySelector("#CartDrawer");
const cartItems = cartDrawer?.querySelector("[data-cart-items]");
const cartFooter = cartDrawer?.querySelector("[data-cart-footer]");
const cartStatus = cartDrawer?.querySelector("[data-cart-status]");
let cartDrawerTrigger = null;

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
})[character]);

async function getCart() {
  const response = await fetch(`${window.Shopify?.routes?.root || "/"}cart.js`, {
    headers: { "X-Requested-With": "XMLHttpRequest" }
  });
  if (!response.ok) throw new Error("Your shopping bag could not be loaded.");
  return response.json();
}

function renderCart(cart) {
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = `(${cart.item_count})`;
  });
  cartDrawer?.querySelectorAll("[data-cart-drawer-count]").forEach((node) => {
    node.textContent = `(${cart.item_count})`;
  });
  if (!cartItems || !cartFooter) return;

  if (!cart.items.length) {
    cartItems.innerHTML = '<div class="cart-drawer__empty"><p>Your shopping bag is empty.</p><button class="underlined" type="button" data-cart-close>Continue shopping</button></div>';
    cartFooter.hidden = true;
    return;
  }

  cartItems.innerHTML = cart.items.map((item) => {
    const options = item.options_with_values
      .filter((option) => option.value !== "Default Title")
      .map((option) => `<span>${escapeHTML(option.name)}: ${escapeHTML(option.value)}</span>`)
      .join("");
    const image = item.image
      ? `<a href="${escapeHTML(item.url)}"><img src="${escapeHTML(item.image)}&width=240" width="120" height="150" alt="${escapeHTML(item.product_title)}"></a>`
      : "";
    return `
      <article class="cart-drawer__item" data-cart-line data-line-key="${escapeHTML(item.key)}">
        ${image}
        <div class="cart-drawer__item-details">
          <a href="${escapeHTML(item.url)}"><strong>${escapeHTML(item.product_title)}</strong></a>
          <div class="cart-drawer__options">${options}</div>
          <div class="cart-drawer__item-actions">
            <label>
              <span class="visually-hidden">Quantity for ${escapeHTML(item.product_title)}</span>
              <input type="number" min="0" value="${item.quantity}" inputmode="numeric" data-cart-quantity>
            </label>
            <button type="button" data-cart-remove>Remove</button>
          </div>
        </div>
        <strong class="cart-drawer__line-price">${money(item.final_line_price)}</strong>
      </article>`;
  }).join("");
  cartDrawer.querySelector("[data-cart-subtotal]").textContent = money(cart.total_price);
  cartFooter.hidden = false;
}

async function openCartDrawer(trigger) {
  if (!cartDrawer) return;
  cartDrawerTrigger = trigger || document.activeElement;
  if (cartStatus) cartStatus.textContent = "Loading your shopping bag.";
  if (!cartDrawer.open) cartDrawer.showModal();
  document.body.classList.add("cart-drawer-open");
  try {
    renderCart(await getCart());
    if (cartStatus) cartStatus.textContent = "";
  } catch (error) {
    if (cartStatus) cartStatus.textContent = error.message;
  }
}

function closeCartDrawer() {
  if (!cartDrawer?.open) return;
  cartDrawer.close();
  document.body.classList.remove("cart-drawer-open");
  cartDrawerTrigger?.focus();
}

async function changeCartLine(key, quantity) {
  if (cartStatus) cartStatus.textContent = "Updating your shopping bag.";
  cartDrawer?.classList.add("is-loading");
  try {
    const response = await fetch(`${window.Shopify?.routes?.root || "/"}cart/change.js`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({ id: key, quantity })
    });
    const cart = await response.json();
    if (!response.ok) throw new Error(cart.description || "Your shopping bag could not be updated.");
    renderCart(cart);
    if (cartStatus) cartStatus.textContent = "Shopping bag updated.";
  } catch (error) {
    if (cartStatus) cartStatus.textContent = error.message;
    try {
      renderCart(await getCart());
    } catch (_) {
      // Keep the original cart error visible.
    }
  } finally {
    cartDrawer?.classList.remove("is-loading");
  }
}

document.addEventListener("click", (event) => {
  const openTrigger = event.target.closest("[data-cart-open]");
  if (openTrigger && cartDrawer) {
    event.preventDefault();
    openCartDrawer(openTrigger);
    return;
  }
  if (event.target.closest("[data-cart-close]")) closeCartDrawer();
  const removeButton = event.target.closest("[data-cart-remove]");
  if (removeButton) {
    const line = removeButton.closest("[data-cart-line]");
    changeCartLine(line.dataset.lineKey, 0);
  }
});

cartDrawer?.addEventListener("change", (event) => {
  const quantityInput = event.target.closest("[data-cart-quantity]");
  if (!quantityInput) return;
  const line = quantityInput.closest("[data-cart-line]");
  changeCartLine(line.dataset.lineKey, Math.max(0, Number(quantityInput.value) || 0));
});
cartDrawer?.addEventListener("click", (event) => {
  if (event.target === cartDrawer) closeCartDrawer();
});
cartDrawer?.addEventListener("close", () => document.body.classList.remove("cart-drawer-open"));

function initializeProduct(scope) {
  if (!scope || scope.dataset.initialized === "true") return;
  const json = scope.querySelector("[data-product-json]");
  const form = scope.querySelector("[data-product-form]");
  if (!json || !form) return;
  const variants = JSON.parse(json.textContent);
  const optionInputs = [...form.querySelectorAll('input[name^="options["]')];
  const idInput = form.querySelector("[data-variant-id]");
  const price = scope.querySelector("[data-product-price]");
  const comparePrice = scope.querySelector("[data-product-compare-price]");
  const button = form.querySelector("[data-add-to-cart]");

  const updateVariant = () => {
    const selected = [...new Set(optionInputs.map((input) => input.name))].map((name) => form.querySelector(`input[name="${CSS.escape(name)}"]:checked`)?.value);
    const variant = variants.find((item) => item.options.every((value, index) => value === selected[index])) || variants[0];
    if (!variant) return;
    idInput.value = variant.id;
    if (price) price.textContent = money(variant.price);
    if (comparePrice) {
      const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      comparePrice.textContent = onSale ? money(variant.compare_at_price) : "";
      comparePrice.hidden = !onSale;
    }
    button.disabled = !variant.available;
    button.firstChild.textContent = variant.available ? "Add to cart " : "Sold out ";
    if (history.replaceState && scope.classList.contains("main-product")) {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", variant.id);
      history.replaceState({}, "", url);
    }
  };
  optionInputs.forEach((input) => input.addEventListener("change", updateVariant));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector("[data-form-message]");
    button.disabled = true;
    try {
      const response = await fetch(`${window.Shopify?.routes?.root || "/"}cart/add.js`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: new FormData(form)
      });
      if (!response.ok) throw new Error((await response.json()).description || "Unable to add this item.");
      if (message) message.textContent = "Added to your bag.";
      closeQuickView();
      await openCartDrawer(button);
    } catch (error) {
      if (message) message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  scope.dataset.initialized = "true";
}

document.querySelectorAll("[data-product-section]").forEach(initializeProduct);

function initializeGallery(gallery) {
  if (!gallery || gallery.dataset.galleryInitialized === "true") return;
  const slides = [...gallery.querySelectorAll("[data-gallery-slide]")];
  const thumbnails = [...gallery.querySelectorAll("[data-gallery-thumbnail]")];
  if (slides.length < 2) return;
  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.hidden = !active;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.querySelectorAll("video").forEach((video) => {
        if (!active) video.pause();
      });
    });
    thumbnails.forEach((thumbnail, thumbnailIndex) => {
      const active = thumbnailIndex === activeIndex;
      thumbnail.classList.toggle("is-active", active);
      thumbnail.setAttribute("aria-selected", String(active));
      if (active) thumbnail.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  gallery.querySelector("[data-gallery-previous]")?.addEventListener("click", (event) => {
    event.preventDefault();
    showSlide(activeIndex - 1);
  });
  gallery.querySelector("[data-gallery-next]")?.addEventListener("click", (event) => {
    event.preventDefault();
    showSlide(activeIndex + 1);
  });
  thumbnails.forEach((thumbnail) => thumbnail.addEventListener("click", (event) => {
    event.preventDefault();
    showSlide(Number(thumbnail.dataset.slideIndex));
  }));
  gallery.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showSlide(activeIndex - 1);
    if (event.key === "ArrowRight") showSlide(activeIndex + 1);
  });
  showSlide(activeIndex);
  gallery.dataset.galleryInitialized = "true";
}

document.querySelectorAll("[data-product-gallery], [data-card-gallery]").forEach(initializeGallery);

const quickView = document.querySelector("#QuickViewDialog");
const quickViewContent = quickView?.querySelector("[data-quick-view-content]");

document.addEventListener("click", async (event) => {
  const trigger = event.target.closest("[data-quick-view-url]");
  if (!trigger || !quickView) return;
  event.preventDefault();
  quickView.classList.add("is-loading");
  quickViewContent.innerHTML = "";
  quickView.showModal();
  document.body.classList.add("quick-view-open");
  try {
    const url = new URL(trigger.dataset.quickViewUrl, window.location.origin);
    url.searchParams.set("section_id", "quick-view-product");
    const response = await fetch(url);
    if (!response.ok) throw new Error("Quick view could not be loaded.");
    quickViewContent.innerHTML = await response.text();
    initializeProduct(quickViewContent.querySelector("[data-product-section]"));
  } catch (error) {
    quickViewContent.innerHTML = `<p class="quick-view__error">${error.message}</p>`;
  } finally {
    quickView.classList.remove("is-loading");
  }
});

function closeQuickView() {
  if (!quickView?.open) return;
  quickView.close();
  document.body.classList.remove("quick-view-open");
}

quickView?.querySelector("[data-quick-view-close]")?.addEventListener("click", closeQuickView);
quickView?.addEventListener("click", (event) => {
  if (event.target === quickView) closeQuickView();
});
quickView?.addEventListener("close", () => document.body.classList.remove("quick-view-open"));
