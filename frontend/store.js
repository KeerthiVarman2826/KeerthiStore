(() => {
    "use strict";

    const API_URL = "http://localhost:5000/api";
    const PLACEHOLDER_IMAGE = "images/product-placeholder.svg";
    const CURRENCY = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    });

    const getToken = () => {
        try {
            return sessionStorage.getItem("token");
        } catch (error) {
            console.error("Could not read the login session:", error);
            return null;
        }
    };

    const requireToken = () => {
        const token = getToken();
        if (!token) {
            window.location.assign("login.html");
            return null;
        }
        return token;
    };

    const apiRequest = async (path, options = {}) => {
        const { token: includeToken, ...fetchOptions } = options;
        const headers = new Headers(fetchOptions.headers || {});
        const token = includeToken === false ? null : getToken();
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        if (fetchOptions.body !== undefined) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(`${API_URL}${path}`, {
            ...fetchOptions,
            headers,
        });
        let result;
        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            const error = new Error(result.message || `Request failed (${response.status}).`);
            error.status = response.status;
            error.code = result.code;
            throw error;
        }
        return result;
    };

    const showMessage = (element, message, isError = false) => {
        if (!element) return;
        element.textContent = message;
        element.classList.toggle("is-error", isError);
        element.classList.toggle("is-success", Boolean(message) && !isError);
    };

    const makeElement = (tagName, className, text) => {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    };

    const makeImage = (source, alt, className = "") => {
        const image = makeElement("img", className);
        image.src = source || PLACEHOLDER_IMAGE;
        image.alt = alt;
        image.loading = "lazy";
        image.addEventListener("error", () => {
            if (image.dataset.fallbackApplied !== "true") {
                image.dataset.fallbackApplied = "true";
                image.src = PLACEHOLDER_IMAGE;
            }
        });
        return image;
    };

    const stockText = (stock) => (
        stock > 0 ? `${stock} in stock` : "Out of stock"
    );

    const createProductCard = (product) => {
        const card = makeElement("article", "store-product-card");
        const detailLink = makeElement("a", "product-card-image-link");
        detailLink.href = `product.html?id=${encodeURIComponent(product._id)}`;
        detailLink.append(makeImage(product.image, product.name, "product-card-image"));

        const content = makeElement("div", "store-product-content");
        content.append(makeElement("span", "product-category", product.category));
        content.append(makeElement("h3", "product-card-title", product.name));
        content.append(makeElement("p", "product-card-description", product.description));

        const footer = makeElement("div", "product-card-footer");
        footer.append(makeElement("strong", "product-price", CURRENCY.format(product.price)));
        const addButton = makeElement("button", "small-primary-button", "Add to cart");
        addButton.type = "button";
        addButton.dataset.addCart = product._id;
        addButton.disabled = product.stock < 1;
        footer.append(addButton);

        content.append(footer);
        content.append(makeElement("span", "product-stock", stockText(product.stock)));
        const viewLink = makeElement("a", "product-view-link", "View details");
        viewLink.href = detailLink.href;
        content.append(viewLink);
        card.append(detailLink, content);
        return card;
    };

    const addProductToCart = async (productId, button) => {
        const token = requireToken();
        if (!token) return;

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Adding...";
        try {
            await apiRequest("/cart/items", {
                method: "POST",
                body: JSON.stringify({ productId, quantity: 1 }),
            });
            button.textContent = "Added";
            window.setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 1000);
        } catch (error) {
            if (error.status === 401) {
                clearSessionAndRedirect();
                return;
            }
            button.textContent = originalText;
            button.disabled = false;
            window.alert(error.message);
        }
    };

    const clearSessionAndRedirect = () => {
        try {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
        } finally {
            window.location.replace("login.html");
        }
    };

    const updateNavigation = () => {
        const signedIn = Boolean(getToken());
        let isAdmin = false;
        try {
            const user = JSON.parse(sessionStorage.getItem("user") || "null");
            isAdmin = user?.role === "admin";
        } catch (error) {
            console.warn("Could not read the cached account role for navigation:", error);
        }
        document.querySelectorAll("[data-auth-link]").forEach((link) => {
            link.hidden = !signedIn;
        });
        document.querySelectorAll("[data-guest-link]").forEach((link) => {
            link.hidden = signedIn;
        });
        document.querySelectorAll("[data-admin-link]").forEach((link) => {
            link.hidden = !signedIn || !isAdmin;
        });
        document.querySelectorAll("[data-logout-button]").forEach((button) => {
            button.hidden = !signedIn;
            if (!button.dataset.logoutHandlerAttached) {
                button.dataset.logoutHandlerAttached = "true";
                button.addEventListener("click", (event) => {
                    event.preventDefault();
                    clearSessionAndRedirect();
                });
            }
        });
    };

    const initializeProductListing = async (grid, controls = {}) => {
        const message = document.querySelector("#products-message");
        const refresh = async () => {
            const params = new URLSearchParams();
            const search = controls.search?.value.trim();
            const category = controls.category?.value;
            const sort = controls.sort?.value;
            if (search) params.set("search", search);
            if (category) params.set("category", category);
            if (sort) params.set("sort", sort);

            grid.replaceChildren(makeElement("p", "store-loading", "Loading products..."));
            showMessage(message, "");

            try {
                const result = await apiRequest(`/products?${params.toString()}`, { token: false });
                const products = Array.isArray(result.products) ? result.products : null;
                if (!products) throw new Error("The server returned an invalid product list.");
                grid.replaceChildren();

                if (controls.category && Array.isArray(result.categories)) {
                    const selected = controls.category.value;
                    controls.category.replaceChildren(
                        new Option("All categories", ""),
                        ...result.categories
                            .filter((categoryName) => typeof categoryName === "string")
                            .sort((a, b) => a.localeCompare(b))
                            .map((categoryName) => new Option(categoryName, categoryName))
                    );
                    controls.category.value = selected;
                }

                if (products.length === 0) {
                    grid.append(makeElement("p", "store-empty", "No products match your search yet."));
                    return;
                }
                products.forEach((product) => grid.append(createProductCard(product)));
            } catch (error) {
                grid.replaceChildren();
                const errorMessage = error instanceof TypeError
                    ? "Could not reach the store. Start the backend and refresh this page."
                    : error.message;
                if (message) {
                    showMessage(message, errorMessage, true);
                } else {
                    grid.append(makeElement("p", "store-empty", errorMessage));
                }
            }
        };

        let searchTimer;
        controls.search?.addEventListener("input", () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(refresh, 250);
        });
        controls.category?.addEventListener("change", refresh);
        controls.sort?.addEventListener("change", refresh);
        grid.addEventListener("click", (event) => {
            const button = event.target.closest("[data-add-cart]");
            if (button) addProductToCart(button.dataset.addCart, button);
        });
        await refresh();
    };

    const initializeHomeProducts = () => {
        const grid = document.querySelector("#product-list");
        if (grid) {
            initializeProductListing(grid);
        }
    };

    const initializeProductsPage = () => {
        const grid = document.querySelector("#product-grid");
        if (!grid) return;
        initializeProductListing(grid, {
            search: document.querySelector("#product-search"),
            category: document.querySelector("#category-filter"),
            sort: document.querySelector("#product-sort"),
        });
    };

    const initializeProductDetail = async () => {
        const container = document.querySelector("#product-detail");
        if (!container) return;
        const message = document.querySelector("#product-message");
        const productId = new URLSearchParams(window.location.search).get("id");
        if (!productId) {
            showMessage(message, "Choose a product from the catalog to see its details.", true);
            return;
        }

        try {
            const result = await apiRequest(`/products/${encodeURIComponent(productId)}`, { token: false });
            const product = result.product;
            if (!product || typeof product.name !== "string") {
                throw new Error("The server returned an invalid product.");
            }

            const image = makeImage(product.image, product.name, "product-detail-image");
            const content = makeElement("div", "product-detail-content");
            content.append(makeElement("span", "product-category", product.category));
            content.append(makeElement("h1", "product-detail-title", product.name));
            content.append(makeElement("p", "product-detail-description", product.description));
            content.append(makeElement("strong", "product-detail-price", CURRENCY.format(product.price)));
            content.append(makeElement("p", "product-stock", stockText(product.stock)));

            const controls = makeElement("div", "product-detail-controls");
            const quantityLabel = makeElement("label", "quantity-label", "Quantity");
            const quantity = makeElement("input", "quantity-input");
            quantity.type = "number";
            quantity.min = "1";
            quantity.max = String(Math.max(product.stock, 1));
            quantity.value = "1";
            quantity.required = true;
            quantityLabel.append(quantity);

            const addButton = makeElement("button", "primary-button", "Add to cart");
            addButton.type = "button";
            addButton.disabled = product.stock < 1;
            addButton.addEventListener("click", async () => {
                const amount = Number(quantity.value);
                if (!Number.isSafeInteger(amount) || amount < 1 || amount > product.stock) {
                    showMessage(message, `Choose a quantity between 1 and ${product.stock}.`, true);
                    return;
                }
                const token = requireToken();
                if (!token) return;
                addButton.disabled = true;
                try {
                    await apiRequest("/cart/items", {
                        method: "POST",
                        body: JSON.stringify({ productId: product._id, quantity: amount }),
                    });
                    showMessage(message, "Added to your cart.");
                } catch (error) {
                    if (error.status === 401) return clearSessionAndRedirect();
                    showMessage(message, error.message, true);
                } finally {
                    addButton.disabled = product.stock < 1;
                }
            });
            controls.append(quantityLabel, addButton);
            content.append(controls);
            container.replaceChildren(image, content);
        } catch (error) {
            showMessage(
                message,
                error instanceof TypeError
                    ? "Could not reach the store. Start the backend and try again."
                    : error.message,
                true
            );
        }
    };

    const initializeCart = async () => {
        const list = document.querySelector("#cart-items");
        if (!list) return;
        if (!requireToken()) return;
        const message = document.querySelector("#cart-message");
        const subtotal = document.querySelector("#cart-subtotal");
        const checkoutLink = document.querySelector("#checkout-link");

        const refresh = async () => {
            list.setAttribute("aria-busy", "true");
            try {
                const result = await apiRequest("/cart");
                const cart = result.cart;
                if (!cart || !Array.isArray(cart.items) || typeof cart.subtotal !== "number") {
                    throw new Error("The server returned an invalid cart.");
                }
                list.replaceChildren();
                subtotal.textContent = CURRENCY.format(cart.subtotal);
                checkoutLink.classList.toggle("is-disabled", cart.items.length === 0);
                checkoutLink.setAttribute("aria-disabled", String(cart.items.length === 0));

                if (cart.items.length === 0) {
                    list.append(makeElement("p", "store-empty", "Your cart is empty."));
                    const browse = makeElement("a", "secondary-link", "Browse products");
                    browse.href = "products.html";
                    list.append(browse);
                    return;
                }

                cart.items.forEach((item) => {
                    const row = makeElement("article", "cart-item");
                    row.append(makeImage(item.product.image, item.product.name, "cart-item-image"));
                    const info = makeElement("div", "cart-item-info");
                    info.append(makeElement("h2", "", item.product.name));
                    info.append(makeElement("p", "product-stock", stockText(item.product.stock)));
                    info.append(makeElement("strong", "", CURRENCY.format(item.product.price)));

                    const actions = makeElement("div", "cart-item-actions");
                    const quantity = makeElement("input", "cart-quantity");
                    quantity.type = "number";
                    quantity.min = "1";
                    quantity.max = String(item.product.stock);
                    quantity.value = String(item.quantity);
                    quantity.setAttribute("aria-label", `Quantity for ${item.product.name}`);
                    quantity.addEventListener("change", async () => {
                        const nextQuantity = Number(quantity.value);
                        if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 1) {
                            showMessage(message, "Quantity must be at least 1. Use Remove to take it out of your cart.", true);
                            await refresh();
                            return;
                        }
                        try {
                            const pId = item.product.id || item.product._id;
                            await apiRequest(`/cart/items/${encodeURIComponent(pId)}`, {
                                method: "PUT",
                                body: JSON.stringify({ quantity: nextQuantity }),
                            });
                            await refresh();
                        } catch (error) {
                            showMessage(message, error.message, true);
                            await refresh();
                        }
                    });

                    const remove = makeElement("button", "text-button", "Remove");
                    remove.type = "button";
                    remove.addEventListener("click", async () => {
                        try {
                            const pId = item.product.id || item.product._id;
                            await apiRequest(`/cart/items/${encodeURIComponent(pId)}`, {
                                method: "DELETE",
                            });
                            await refresh();
                        } catch (error) {
                            showMessage(message, error.message, true);
                        }
                    });
                    actions.append(quantity, remove);
                    row.append(info, makeElement("strong", "cart-line-total", CURRENCY.format(item.lineTotal)), actions);
                    list.append(row);
                });
            } catch (error) {
                if (error.status === 401) return clearSessionAndRedirect();
                showMessage(
                    message,
                    error instanceof TypeError
                        ? "Could not load your cart. Check that the backend is running."
                        : error.message,
                    true
                );
            } finally {
                list.setAttribute("aria-busy", "false");
            }
        };

        checkoutLink.addEventListener("click", (event) => {
            if (checkoutLink.getAttribute("aria-disabled") === "true") event.preventDefault();
        });
        await refresh();
    };

    const readCartForCheckout = async () => {
        const result = await apiRequest("/cart");
        if (!result.cart || !Array.isArray(result.cart.items) || typeof result.cart.subtotal !== "number") {
            throw new Error("The server returned an invalid cart.");
        }
        return result.cart;
    };

    const initializeCheckout = async () => {
        const form = document.querySelector("#checkout-form");
        if (!form) return;
        if (!requireToken()) return;
        const message = document.querySelector("#checkout-message");
        const summary = document.querySelector("#checkout-summary");
        const total = document.querySelector("#checkout-total");
        const submitButton = form.querySelector('button[type="submit"]');

        try {
            const cart = await readCartForCheckout();
            if (cart.items.length === 0) {
                showMessage(message, "Your cart is empty. Add a product before checkout.", true);
                submitButton.disabled = true;
                return;
            }
            summary.replaceChildren();
            cart.items.forEach((item) => {
                const line = makeElement("div", "checkout-product-line");
                line.append(makeElement("span", "", `${item.product.name} × ${item.quantity}`));
                line.append(makeElement("strong", "", CURRENCY.format(item.lineTotal)));
                summary.append(line);
            });
            total.textContent = CURRENCY.format(cart.subtotal);

            try {
                const cachedUser = JSON.parse(sessionStorage.getItem("user") || "null");
                if (cachedUser && typeof cachedUser.name === "string") form.elements.name.value = cachedUser.name;
                if (cachedUser && typeof cachedUser.email === "string") form.elements.email.value = cachedUser.email;
            } catch (error) {
                console.warn("Could not prefill checkout contact details:", error);
            }
        } catch (error) {
            showMessage(message, error.message, true);
            submitButton.disabled = true;
            return;
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            showMessage(message, "");
            if (!form.reportValidity()) return;

            const customerDetails = Object.fromEntries(new FormData(form).entries());
            submitButton.disabled = true;
            submitButton.textContent = "Placing order...";
            try {
                const result = await apiRequest("/orders", {
                    method: "POST",
                    body: JSON.stringify({ customerDetails }),
                });
                if (!result.order || !result.order._id) {
                    throw new Error("The server did not return order confirmation details.");
                }
                window.location.assign(`order-confirmation.html?id=${encodeURIComponent(result.order._id)}`);
            } catch (error) {
                if (error.status === 401) return clearSessionAndRedirect();
                showMessage(message, error.message, true);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Place order";
            }
        });
    };

    const initializeOrderDetail = async () => {
        const container = document.querySelector("#order-detail");
        if (!container) return;
        if (!requireToken()) return;
        const message = document.querySelector("#order-message");
        const orderId = new URLSearchParams(window.location.search).get("id");
        if (!orderId) {
            showMessage(message, "Order ID is missing.", true);
            return;
        }

        try {
            const result = await apiRequest(`/orders/${encodeURIComponent(orderId)}`);
            const order = result.order;
            if (!order || !Array.isArray(order.products)) {
                throw new Error("The server returned invalid order details.");
            }
            const heading = makeElement("div", "order-success-heading");
            heading.append(makeElement("span", "order-success-icon", "✓"));
            const headingText = makeElement("div");
            headingText.append(makeElement("p", "store-kicker", "ORDER CONFIRMED"));
            headingText.append(makeElement("h1", "", "Thank you for your order!"));
            headingText.append(makeElement("p", "", `Order placed for ${order.customerDetails?.name || "you"}.`));
            headingText.append(makeElement("p", "", `Order ${order._id} · ${new Date(order.createdAt).toLocaleString()}`));
            heading.append(headingText);

            const items = makeElement("div", "order-snapshot-list");
            order.products.forEach((product) => {
                const row = makeElement("div", "order-snapshot-item");
                row.append(makeImage(product.image, product.name, "order-item-image"));
                const detail = makeElement("div");
                detail.append(makeElement("strong", "", product.name));
                detail.append(makeElement("span", "", `${product.quantity} × ${CURRENCY.format(product.price)}`));
                row.append(detail, makeElement("strong", "", CURRENCY.format(product.price * product.quantity)));
                items.append(row);
            });

            const status = makeElement("span", "order-status", order.orderStatus);
            const totalLine = makeElement("div", "summary-line summary-total");
            totalLine.append(makeElement("span", "", "Order total"), makeElement("strong", "", CURRENCY.format(order.totalAmount)));
            const links = makeElement("div", "order-actions");
            const ordersLink = makeElement("a", "primary-link", "View my orders");
            ordersLink.href = "orders.html";
            const productsLink = makeElement("a", "secondary-link", "Continue shopping");
            productsLink.href = "products.html";
            links.append(ordersLink, productsLink);
            container.replaceChildren(heading, makeElement("p", "order-confirmation-copy", "Your order has been placed successfully."), status, items, totalLine, links);
        } catch (error) {
            if (error.status === 401) return clearSessionAndRedirect();
            showMessage(
                message,
                error instanceof TypeError ? "Could not connect to the store. Please try again." : error.message,
                true
            );
        }
    };

    const initializeOrders = async () => {
        const list = document.querySelector("#orders-list");
        if (!list) return;
        if (!requireToken()) return;
        const message = document.querySelector("#orders-message");

        try {
            const result = await apiRequest("/orders/my-orders");
            if (!Array.isArray(result.orders)) throw new Error("The server returned an invalid order list.");
            list.replaceChildren();
            if (result.orders.length === 0) {
                list.append(makeElement("p", "store-empty", "You haven't placed an order yet."));
                const shop = makeElement("a", "primary-link", "Browse products");
                shop.href = "products.html";
                list.append(shop);
                return;
            }

            result.orders.forEach((order) => {
                const card = makeElement("article", "order-list-card");
                const top = makeElement("div", "order-list-top");
                const info = makeElement("div");
                info.append(makeElement("strong", "", `Order ${order._id}`));
                info.append(makeElement("span", "", new Date(order.createdAt).toLocaleDateString()));
                top.append(info, makeElement("span", "order-status", order.orderStatus));
                const productNames = (order.products || []).map((product) => `${product.name} × ${product.quantity}`).join(", ");
                card.append(top, makeElement("p", "order-list-products", productNames));
                const bottom = makeElement("div", "order-list-bottom");
                bottom.append(makeElement("strong", "", CURRENCY.format(order.totalAmount)));
                const details = makeElement("a", "product-view-link", "View order details");
                details.href = `order-confirmation.html?id=${encodeURIComponent(order._id)}`;
                bottom.append(details);
                card.append(bottom);
                list.append(card);
            });
        } catch (error) {
            if (error.status === 401) return clearSessionAndRedirect();
            showMessage(
                message,
                error instanceof TypeError ? "Could not connect to the store. Please try again." : error.message,
                true
            );
        }
    };

    const initializeAdmin = async () => {
        const productForm = document.querySelector("#admin-product-form");
        if (!productForm) return;
        if (!requireToken()) return;

        const message = document.querySelector("#admin-message");
        const productList = document.querySelector("#admin-products");
        const orderList = document.querySelector("#admin-orders");
        const cancelEdit = document.querySelector("#admin-cancel-edit");
        const submitButton = productForm.querySelector('button[type="submit"]');

        try {
            const cachedUser = JSON.parse(sessionStorage.getItem("user") || "null");
            if (cachedUser && cachedUser.role !== "admin") {
                showMessage(message, "Administrator access is required to manage the store.", true);
                productForm.style.display = "none";
                document.querySelector(".admin-products-section")?.style.setProperty("display", "none");
                document.querySelector(".admin-orders-section")?.style.setProperty("display", "none");
                return;
            }
        } catch {
            /* proceed */
        }

        const loadAdminData = async () => {
            try {
                const [productResult, orderResult] = await Promise.all([
                    apiRequest("/products"),
                    apiRequest("/orders"),
                ]);
                if (!Array.isArray(productResult.products) || !Array.isArray(orderResult.orders)) {
                    throw new Error("The server returned invalid administration data.");
                }

                productList.replaceChildren();
                productResult.products.forEach((product) => {
                    const row = makeElement("article", "admin-list-row");
                    row.append(makeImage(product.image, product.name, "admin-product-image"));
                    const detail = makeElement("div", "admin-row-detail");
                    detail.append(makeElement("strong", "", product.name));
                    detail.append(makeElement("span", "", `${CURRENCY.format(product.price)} · ${product.stock} in stock · ${product.category}`));
                    const actions = makeElement("div", "admin-row-actions");
                    const edit = makeElement("button", "secondary-button", "Edit");
                    edit.type = "button";
                    edit.addEventListener("click", () => {
                        productForm.elements.productId.value = product._id;
                        productForm.elements.name.value = product.name;
                        productForm.elements.description.value = product.description;
                        productForm.elements.price.value = product.price;
                        productForm.elements.stock.value = product.stock;
                        productForm.elements.category.value = product.category;
                        productForm.elements.image.value = product.image || "";
                        document.querySelector("#admin-form-title").textContent = "Edit product";
                        submitButton.textContent = "Update product";
                        cancelEdit.hidden = false;
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    });
                    const remove = makeElement("button", "danger-button", "Delete");
                    remove.type = "button";
                    remove.addEventListener("click", async () => {
                        if (!window.confirm(`Delete "${product.name}"?`)) return;
                        try {
                            await apiRequest(`/products/${encodeURIComponent(product._id)}`, { method: "DELETE" });
                            showMessage(message, "Product deleted.");
                            await loadAdminData();
                        } catch (error) {
                            showMessage(message, error.message, true);
                        }
                    });
                    actions.append(edit, remove);
                    row.append(detail, actions);
                    productList.append(row);
                });

                orderList.replaceChildren();
                if (orderResult.orders.length === 0) {
                    orderList.append(makeElement("p", "store-empty", "There are no orders yet."));
                }
                orderResult.orders.forEach((order) => {
                    const row = makeElement("article", "admin-order-row");
                    const detail = makeElement("div", "admin-row-detail");
                    detail.append(makeElement("strong", "", `${order.customerDetails.name} · ${CURRENCY.format(order.totalAmount)}`));
                    detail.append(makeElement("span", "", `Order ${order._id} · ${new Date(order.createdAt).toLocaleDateString()}`));
                    const status = makeElement("select", "admin-status-select");
                    status.setAttribute("aria-label", `Status for order ${order._id}`);
                    ["pending", "processing", "shipped", "delivered", "cancelled"].forEach((value) => {
                        status.add(new Option(value, value));
                    });
                    status.value = order.orderStatus;
                    status.addEventListener("change", async () => {
                        try {
                            await apiRequest(`/orders/${encodeURIComponent(order._id)}/status`, {
                                method: "PUT",
                                body: JSON.stringify({ orderStatus: status.value }),
                            });
                            showMessage(message, "Order status updated.");
                        } catch (error) {
                            showMessage(message, error.message, true);
                            status.value = order.orderStatus;
                        }
                    });
                    row.append(detail, status);
                    orderList.append(row);
                });
            } catch (error) {
                if (error.status === 401) return clearSessionAndRedirect();
                if (error.status === 403) {
                    productForm.style.display = "none";
                    document.querySelector(".admin-products-section")?.style.setProperty("display", "none");
                    document.querySelector(".admin-orders-section")?.style.setProperty("display", "none");
                }
                showMessage(
                    message,
                    error.status === 403
                        ? "Administrator access is required to manage the store."
                        : error instanceof TypeError
                            ? "Could not connect to the store backend."
                            : error.message,
                    true
                );
            }
        };

        cancelEdit.addEventListener("click", () => {
            productForm.reset();
            productForm.elements.productId.value = "";
            document.querySelector("#admin-form-title").textContent = "Add a product";
            submitButton.textContent = "Save product";
            cancelEdit.hidden = true;
        });

        productForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!productForm.reportValidity()) return;
            const formData = new FormData(productForm);
            const product = {
                name: formData.get("name").trim(),
                description: formData.get("description").trim(),
                price: Number(formData.get("price")),
                stock: Number(formData.get("stock")),
                category: formData.get("category").trim(),
                image: formData.get("image").trim() || PLACEHOLDER_IMAGE,
            };
            const productId = formData.get("productId");
            submitButton.disabled = true;
            try {
                await apiRequest(productId ? `/products/${encodeURIComponent(productId)}` : "/products", {
                    method: productId ? "PUT" : "POST",
                    body: JSON.stringify(product),
                });
                showMessage(message, productId ? "Product updated." : "Product created.");
                productForm.reset();
                productForm.elements.productId.value = "";
                document.querySelector("#admin-form-title").textContent = "Add a product";
                submitButton.textContent = "Save product";
                cancelEdit.hidden = true;
                await loadAdminData();
            } catch (error) {
                if (error.status === 401) return clearSessionAndRedirect();
                showMessage(message, error.message, true);
            } finally {
                submitButton.disabled = false;
            }
        });

        await loadAdminData();
    };

    document.addEventListener("DOMContentLoaded", () => {
        updateNavigation();
        initializeHomeProducts();
        initializeProductsPage();
        initializeProductDetail();
        initializeCart();
        initializeCheckout();
        initializeOrderDetail();
        initializeOrders();
        initializeAdmin();
    }, { once: true });
})();
