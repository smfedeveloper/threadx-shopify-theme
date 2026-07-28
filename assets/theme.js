document.documentElement.classList.remove("no-js");

const money = (cents) => {
  const currency = window.Shopify?.currency?.active || "USD";
  return new Intl.NumberFormat(document.documentElement.lang || "en", { style: "currency", currency }).format(cents / 100);
};

function initializeProduct(scope) {
  if (!scope || scope.dataset.initialized === "true") return;
  const json = scope.querySelector("[data-product-json]");
  const form = scope.querySelector("[data-product-form]");
  if (!json || !form) return;
  const variants = JSON.parse(json.textContent);
  const optionInputs = [...form.querySelectorAll('input[name^="options["]')];
  const idInput = form.querySelector("[data-variant-id]");
  const price = scope.querySelector("[data-product-price]");
  const button = form.querySelector("[data-add-to-cart]");

  const updateVariant = () => {
    const selected = [...new Set(optionInputs.map((input) => input.name))].map((name) => form.querySelector(`input[name="${CSS.escape(name)}"]:checked`)?.value);
    const variant = variants.find((item) => item.options.every((value, index) => value === selected[index])) || variants[0];
    if (!variant) return;
    idInput.value = variant.id;
    if (price) price.textContent = money(variant.price);
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
      const cart = await fetch(`${window.Shopify?.routes?.root || "/"}cart.js`).then((result) => result.json());
      document.querySelectorAll("[data-cart-count]").forEach((node) => node.textContent = `(${cart.item_count})`);
      if (message) message.textContent = "Added to your bag.";
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
