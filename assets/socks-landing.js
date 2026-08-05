(() => {
  const root = document.querySelector("[data-socks-landing]");
  if (!root) return;
  const route = window.Shopify?.routes?.root || "/";
  const formatMoney = (cents) => new Intl.NumberFormat(document.documentElement.lang || "en", { style: "currency", currency: window.Shopify?.currency?.active || "USD" }).format(cents / 100);
  const gallery = document.querySelector("[data-sock-gallery]");
  let galleryImages = [], galleryIndex = 0;
  const showGallery = () => { gallery.querySelector("[data-gallery-image]").src = galleryImages[galleryIndex]; };

  root.querySelectorAll("[data-sock-card]").forEach((card) => {
    const thumbs = [...card.querySelectorAll("[data-sock-thumb]")];
    thumbs.forEach((thumb) => thumb.addEventListener("click", () => {
      card.querySelector("[data-card-main]").src = thumb.dataset.src;
      thumbs.forEach((item) => item.classList.toggle("is-active", item === thumb));
    }));
    card.querySelector("[data-sock-gallery-open]").addEventListener("click", () => {
      galleryImages = thumbs.map((thumb) => thumb.dataset.src); galleryIndex = 0; showGallery(); gallery.showModal();
    });
    card.querySelector("[data-sock-add]").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!card.dataset.productId) return;
      button.disabled = true;
      try {
        const response = await fetch(`${route}cart/add.js`, { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ items: [{ id: Number(card.dataset.productId), quantity: 1 }] }) });
        if (!response.ok) throw new Error((await response.json()).description || "Unable to add this pair.");
        if (typeof openCartDrawer === "function") await openCartDrawer(button);
      } catch (error) { button.textContent = error.message; } finally { button.disabled = false; }
    });
  });
  gallery?.querySelector("[data-gallery-close]")?.addEventListener("click", () => gallery.close());
  gallery?.querySelector("[data-gallery-prev]")?.addEventListener("click", () => { galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length; showGallery(); });
  gallery?.querySelector("[data-gallery-next]")?.addEventListener("click", () => { galleryIndex = (galleryIndex + 1) % galleryImages.length; showGallery(); });

  const builder = root.querySelector("#txs-builder");
  const colours = [...builder.querySelectorAll("[data-colour-name]")].map((button) => ({ name: button.dataset.colourName, slug: button.dataset.colourSlug, button }));
  const state = { count: 3, selected: [], size: "", product: null, variant: null, active: 0 };
  const parseProduct = (count) => { try { return JSON.parse(builder.dataset[`bundle${count}`] || "null"); } catch (_) { return null; } };
  const assetFor = (slug) => colours.find((item) => item.slug === slug)?.button.closest(".txs")?.querySelector(`[data-colour-slug="${CSS.escape(slug)}"]`)?.dataset.colourSlug;
  const imageURL = (slug) => {
    const sample = root.querySelector(`.txs-card[data-name="${CSS.escape(colours.find(c => c.slug === slug)?.name || "")}"] [data-card-main]`);
    return sample?.src || "";
  };
  const render = () => {
    builder.querySelector("[data-selection-count]").textContent = `${state.selected.length} of ${state.count} selected`;
    colours.forEach((colour) => { const qty = state.selected.filter((name) => name === colour.name).length; colour.button.classList.toggle("is-selected", qty > 0); colour.button.querySelector("b").textContent = qty ? `×${qty}` : ""; });
    const activeName = state.selected[state.active] || state.selected[0];
    const activeColour = colours.find((colour) => colour.name === activeName) || colours[0];
    builder.querySelector("[data-active-pair]").innerHTML = `<img src="${imageURL(activeColour.slug)}" alt="${activeColour.name} X1 socks">`;
    const thumbs = builder.querySelector("[data-pair-thumbs]"); thumbs.style.setProperty("--count", state.count);
    thumbs.innerHTML = Array.from({ length: state.count }, (_, index) => { const name = state.selected[index]; if (!name) return "<div></div>"; const colour = colours.find((item) => item.name === name); return `<button type="button" data-pair="${index}" class="${index === state.active ? "is-active" : ""}"><img src="${imageURL(colour.slug)}" alt="${name}"></button>`; }).join("");
    builder.querySelector("[data-bundle-add]").disabled = !state.variant || !state.size || state.selected.length !== state.count || !state.variant.available;
  };
  const chooseBundle = (count) => {
    state.count = count; state.product = parseProduct(count); state.size = ""; state.active = 0;
    state.selected = count === 6 ? colours.map((colour) => colour.name) : colours.slice(0, 3).map((colour) => colour.name);
    builder.querySelector("[data-bundle-count]").textContent = `${count}-pair bundle.`;
    const sizes = builder.querySelector("[data-sizes]");
    if (state.product?.variants?.length) {
      sizes.innerHTML = state.product.variants.map((variant) => `<button type="button" data-variant-id="${variant.id}" data-price="${variant.price}" ${variant.available ? "" : "disabled"}>${variant.title}</button>`).join("");
      builder.querySelector("[data-bundle-price]").textContent = formatMoney(state.product.price);
    } else {
      sizes.innerHTML = "<p>Choose this bundle product in the theme editor.</p>";
      builder.querySelector("[data-bundle-price]").textContent = "—";
    }
    render(); builder.scrollIntoView({ behavior: "smooth" });
  };
  root.querySelectorAll("[data-choose-bundle]").forEach((button) => button.addEventListener("click", () => chooseBundle(Number(button.dataset.chooseBundle))));
  colours.forEach((colour) => colour.button.addEventListener("click", () => { if (state.selected.length < state.count) { state.selected.push(colour.name); state.active = state.selected.length - 1; } else { const index = state.selected.lastIndexOf(colour.name); if (index >= 0) { state.selected.splice(index, 1); state.active = Math.max(0, state.selected.length - 1); } } render(); }));
  builder.querySelector("[data-pair-thumbs]").addEventListener("click", (event) => { const pair = event.target.closest("[data-pair]"); if (pair) { state.active = Number(pair.dataset.pair); render(); } });
  builder.querySelector("[data-sizes]").addEventListener("click", (event) => { const button = event.target.closest("[data-variant-id]"); if (!button) return; builder.querySelectorAll("[data-variant-id]").forEach((item) => item.classList.toggle("is-selected", item === button)); state.variant = state.product.variants.find((variant) => variant.id === Number(button.dataset.variantId)); state.size = state.variant.title; builder.querySelector("[data-bundle-price]").textContent = formatMoney(state.variant.price); render(); });
  builder.querySelector("[data-bundle-add]").addEventListener("click", async (event) => {
    const button = event.currentTarget, status = builder.querySelector("[data-bundle-status]"); button.disabled = true; status.textContent = "Adding your bundle…";
    const properties = { "Bundle": `${state.count} pairs`, "Size": state.size }; state.selected.forEach((colour, index) => { properties[`Pair ${index + 1}`] = colour; });
    try {
      const response = await fetch(`${route}cart/add.js`, { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ items: [{ id: state.variant.id, quantity: 1, properties }] }) });
      if (!response.ok) throw new Error((await response.json()).description || "Unable to add this bundle.");
      status.textContent = "Bundle added to your bag."; if (typeof openCartDrawer === "function") await openCartDrawer(button);
    } catch (error) { status.textContent = error.message; } finally { render(); }
  });
  chooseBundle(3);
})();
