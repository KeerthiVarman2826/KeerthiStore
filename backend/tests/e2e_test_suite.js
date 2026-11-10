const http = require('http');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');

const BASE_URL = 'http://localhost:5000/api';

const results = {
  passed: [],
  failed: [],
};

const assert = (condition, testName, details = '') => {
  if (condition) {
    results.passed.push(testName);
    console.log(`  [PASS] ${testName}`);
  } else {
    results.failed.push({ testName, details });
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
};

const request = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (options.token) {
      reqOptions.headers['Authorization'] = `Bearer ${options.token}`;
    }

    if (options.body) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

(async () => {
  console.log('=== STARTING COMPLETE FINAL TESTING & QUALITY CHECK ===\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for direct verification.\n');

  // -------------------------------------------------------------
  // Test 1: MongoDB Connection & Data Persistence (Existing Data)
  // -------------------------------------------------------------
  console.log('--- Requirement 20: MongoDB Connection & Data Persistence ---');
  const existingProductsCount = await Product.countDocuments();
  assert(existingProductsCount >= 21, 'Existing product catalog preserved (>= 21 products)', `Found: ${existingProductsCount}`);

  const existingUsersCount = await User.countDocuments();
  assert(existingUsersCount >= 3, 'Existing user accounts preserved in database', `Found: ${existingUsersCount}`);

  // -------------------------------------------------------------
  // Test 2: Registration & Validation
  // -------------------------------------------------------------
  console.log('\n--- Requirement 1 & 7: Registration & Form Validation ---');
  const uniqueSuffix = Date.now();
  const testUserEmail = `tester_${uniqueSuffix}@example.com`;
  const testUserPassword = 'TestPassword123!';

  // Missing fields
  const regMissingName = await request('/users/register', {
    method: 'POST',
    body: { email: testUserEmail, password: testUserPassword },
  });
  assert(regMissingName.status === 400, 'Registration rejects missing name (400)', `Status: ${regMissingName.status}`);

  const regMissingEmail = await request('/users/register', {
    method: 'POST',
    body: { name: 'Tester', password: testUserPassword },
  });
  assert(regMissingEmail.status === 400, 'Registration rejects missing email (400)', `Status: ${regMissingEmail.status}`);

  const regMissingPass = await request('/users/register', {
    method: 'POST',
    body: { name: 'Tester', email: testUserEmail },
  });
  assert(regMissingPass.status === 400, 'Registration rejects missing password (400)', `Status: ${regMissingPass.status}`);

  // Valid Registration
  const regSuccess = await request('/users/register', {
    method: 'POST',
    body: { name: 'Test User One', email: testUserEmail, password: testUserPassword },
  });
  assert(regSuccess.status === 201 && regSuccess.data.user && regSuccess.data.user.email === testUserEmail,
    'Valid registration succeeds with 201 and user object',
    `Status: ${regSuccess.status}, Response: ${JSON.stringify(regSuccess.data)}`);

  // Duplicate Registration
  const regDuplicate = await request('/users/register', {
    method: 'POST',
    body: { name: 'Test User One Duplicate', email: testUserEmail, password: testUserPassword },
  });
  assert(regDuplicate.status === 409, 'Duplicate email registration rejected with 409 Conflict', `Status: ${regDuplicate.status}`);

  // -------------------------------------------------------------
  // Test 3: Login & JWT Authentication
  // -------------------------------------------------------------
  console.log('\n--- Requirement 1 & 2: Login & JWT Authentication ---');
  // Missing fields login
  const loginMissing = await request('/users/login', {
    method: 'POST',
    body: { email: testUserEmail },
  });
  assert(loginMissing.status === 400, 'Login rejects missing password (400)', `Status: ${loginMissing.status}`);

  // Wrong password
  const loginWrongPass = await request('/users/login', {
    method: 'POST',
    body: { email: testUserEmail, password: 'WrongPassword!' },
  });
  assert(loginWrongPass.status === 401, 'Login rejects incorrect password with 401 Unauthorized', `Status: ${loginWrongPass.status}`);

  // Non-existent user
  const loginNonExistent = await request('/users/login', {
    method: 'POST',
    body: { email: 'nonexistent_9999@example.com', password: testUserPassword },
  });
  assert(loginNonExistent.status === 401, 'Login rejects non-existent user with 401', `Status: ${loginNonExistent.status}`);

  // Successful login
  const loginSuccess = await request('/users/login', {
    method: 'POST',
    body: { email: testUserEmail, password: testUserPassword },
  });
  assert(loginSuccess.status === 200 && typeof loginSuccess.data.token === 'string',
    'Login succeeds with 200 and returns valid JWT token string',
    `Status: ${loginSuccess.status}`);

  const userToken = loginSuccess.data.token;
  assert(loginSuccess.data.user && loginSuccess.data.user.role === 'user',
    'Regular user login returns role: "user"',
    `Role: ${loginSuccess.data?.user?.role}`);

  // Profile verification (JWT verification)
  const profileSuccess = await request('/users/profile', { token: userToken });
  assert(profileSuccess.status === 200 && profileSuccess.data.user.email === testUserEmail && profileSuccess.data.user.role === 'user',
    'Protected profile endpoint returns user details and correct role with valid JWT',
    `Status: ${profileSuccess.status}, User: ${JSON.stringify(profileSuccess.data?.user)}`);

  // Protected endpoint rejects missing token
  const profileNoToken = await request('/users/profile');
  assert(profileNoToken.status === 401, 'Protected profile endpoint rejects missing Authorization header with 401', `Status: ${profileNoToken.status}`);

  // Protected endpoint rejects malformed/tampered token
  const profileBadToken = await request('/users/profile', { token: 'invalid.token.here' });
  assert(profileBadToken.status === 401, 'Protected profile endpoint rejects invalid token with 401', `Status: ${profileBadToken.status}`);

  // -------------------------------------------------------------
  // Test 4: Product Listing & Details
  // -------------------------------------------------------------
  console.log('\n--- Requirement 3: Product Listing and Product Details ---');
  const productsListRes = await request('/products');
  assert(productsListRes.status === 200 && Array.isArray(productsListRes.data.products) && productsListRes.data.products.length >= 21,
    'Product listing returns all active products (>= 21)',
    `Status: ${productsListRes.status}, Count: ${productsListRes.data?.products?.length}`);

  assert(Array.isArray(productsListRes.data.categories) && productsListRes.data.categories.length > 0,
    'Product listing returns unique categories list',
    `Categories: ${JSON.stringify(productsListRes.data?.categories)}`);

  const sampleProduct = productsListRes.data.products[0];

  // Search
  const searchRes = await request(`/products?search=${encodeURIComponent(sampleProduct.name.split(' ')[0])}`);
  assert(searchRes.status === 200 && searchRes.data.products.length > 0,
    'Product search by keyword returns matching products',
    `Found: ${searchRes.data?.products?.length}`);

  // Category filter
  const categoryRes = await request(`/products?category=${encodeURIComponent(sampleProduct.category)}`);
  const allInCategory = categoryRes.data.products.every(p => p.category.toLowerCase() === sampleProduct.category.toLowerCase());
  assert(categoryRes.status === 200 && allInCategory && categoryRes.data.products.length > 0,
    'Product category filter returns only items in that category',
    `All match category: ${allInCategory}`);

  // Sorting
  const sortAscRes = await request('/products?sort=price-asc');
  const pricesAsc = sortAscRes.data.products.map(p => p.price);
  const isSortedAsc = pricesAsc.every((val, i, arr) => !i || arr[i - 1] <= val);
  assert(sortAscRes.status === 200 && isSortedAsc,
    'Product sorting price-asc orders products low to high',
    `Ascending: ${isSortedAsc}`);

  const sortDescRes = await request('/products?sort=price-desc');
  const pricesDesc = sortDescRes.data.products.map(p => p.price);
  const isSortedDesc = pricesDesc.every((val, i, arr) => !i || arr[i - 1] >= val);
  assert(sortDescRes.status === 200 && isSortedDesc,
    'Product sorting price-desc orders products high to low',
    `Descending: ${isSortedDesc}`);

  // Product detail
  const detailRes = await request(`/products/${sampleProduct._id}`);
  assert(detailRes.status === 200 && detailRes.data.product._id === sampleProduct._id,
    'Product details returns complete product data for valid ID',
    `Name: ${detailRes.data?.product?.name}`);

  const detailInvalidId = await request('/products/not-an-objectid');
  assert(detailInvalidId.status === 400, 'Product details returns 400 for invalid ObjectId format', `Status: ${detailInvalidId.status}`);

  const detailNotFound = await request('/products/000000000000000000000000');
  assert(detailNotFound.status === 404, 'Product details returns 404 for non-existent product', `Status: ${detailNotFound.status}`);

  // -------------------------------------------------------------
  // Test 5: Cart Operations & Total Price Calculation
  // -------------------------------------------------------------
  console.log('\n--- Requirements 4, 5, 6: Cart Operations & Total Price Calculation ---');
  // Initial cart is empty
  const initialCart = await request('/cart', { token: userToken });
  assert(initialCart.status === 200 && initialCart.data.cart.items.length === 0 && initialCart.data.cart.subtotal === 0,
    'Initial cart is empty with subtotal ₹0',
    `Items: ${initialCart.data?.cart?.items?.length}`);

  // Add Item to Cart
  const productA = productsListRes.data.products[0];
  const productB = productsListRes.data.products[1];

  const addRes1 = await request('/cart/items', {
    method: 'POST',
    token: userToken,
    body: { productId: productA._id, quantity: 2 },
  });
  assert(addRes1.status === 200 && addRes1.data.cart.items.length === 1,
    'Add to cart adds item with specified quantity (2)',
    `Items count: ${addRes1.data?.cart?.items?.length}`);

  const itemA = addRes1.data.cart.items[0];
  const expectedLineTotalA = Math.round(productA.price * 2 * 100) / 100;
  assert(itemA.lineTotal === expectedLineTotalA,
    `Correct line total calculated for item A (₹${itemA.lineTotal} === ₹${expectedLineTotalA})`);
  assert(addRes1.data.cart.subtotal === expectedLineTotalA,
    `Correct subtotal calculated for single item cart (₹${addRes1.data.cart.subtotal})`);

  // Add second product to cart
  const addRes2 = await request('/cart/items', {
    method: 'POST',
    token: userToken,
    body: { productId: productB._id, quantity: 1 },
  });
  assert(addRes2.status === 200 && addRes2.data.cart.items.length === 2,
    'Add second product to cart updates items count to 2',
    `Items count: ${addRes2.data?.cart?.items?.length}`);

  const expectedSubtotal = Math.round((expectedLineTotalA + productB.price) * 100) / 100;
  assert(addRes2.data.cart.subtotal === expectedSubtotal,
    `Correct total price calculation for multiple items (₹${addRes2.data.cart.subtotal} === ₹${expectedSubtotal})`);

  // Increase quantity
  const updateIncrease = await request(`/cart/items/${productB._id}`, {
    method: 'PUT',
    token: userToken,
    body: { quantity: 3 },
  });
  const updatedItemB = updateIncrease.data.cart.items.find(i => (i.product.id || i.product._id) === productB._id);
  assert(updateIncrease.status === 200 && updatedItemB.quantity === 3,
    'Increase quantity updates cart item quantity to 3',
    `Quantity: ${updatedItemB?.quantity}`);

  // Decrease quantity
  const updateDecrease = await request(`/cart/items/${productB._id}`, {
    method: 'PUT',
    token: userToken,
    body: { quantity: 1 },
  });
  const decreasedItemB = updateDecrease.data.cart.items.find(i => (i.product.id || i.product._id) === productB._id);
  assert(updateDecrease.status === 200 && decreasedItemB.quantity === 1,
    'Decrease quantity updates cart item quantity back to 1',
    `Quantity: ${decreasedItemB?.quantity}`);

  // Stock limit validation
  const updateExcess = await request(`/cart/items/${productB._id}`, {
    method: 'PUT',
    token: userToken,
    body: { quantity: productB.stock + 10 },
  });
  assert(updateExcess.status === 409,
    'Cart quantity update exceeding available stock rejected with 409 Conflict',
    `Status: ${updateExcess.status}`);

  // Invalid quantity (< 1)
  const updateZero = await request(`/cart/items/${productB._id}`, {
    method: 'PUT',
    token: userToken,
    body: { quantity: 0 },
  });
  assert(updateZero.status === 400, 'Cart quantity update with quantity 0 rejected with 400', `Status: ${updateZero.status}`);

  // Remove single item from cart
  const removeRes = await request(`/cart/items/${productB._id}`, {
    method: 'DELETE',
    token: userToken,
  });
  assert(removeRes.status === 200 && removeRes.data.cart.items.length === 1,
    'Remove from cart removes specific product from cart',
    `Remaining: ${removeRes.data?.cart?.items?.length}`);

  // -------------------------------------------------------------
  // Test 6: Checkout Form Validation
  // -------------------------------------------------------------
  console.log('\n--- Requirement 7: Checkout Form Validation ---');
  // Missing required customer details
  const chkMissingAll = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: {},
  });
  assert(chkMissingAll.status === 400, 'Checkout rejects request without customerDetails (400)', `Status: ${chkMissingAll.status}`);

  const validCustomer = {
    name: 'Keerthi Tester',
    email: 'keerthi.tester@example.com',
    phone: '9876543210',
    address: '123 Main Street, Phase 2',
    city: 'Hyderabad',
    state: 'Telangana',
    pinCode: '500001',
  };

  // Missing phone
  const chkMissingPhone = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: { customerDetails: { ...validCustomer, phone: '' } },
  });
  assert(chkMissingPhone.status === 400, 'Checkout rejects empty phone (400)', `Status: ${chkMissingPhone.status}`);

  // Invalid email format
  const chkInvalidEmail = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: { customerDetails: { ...validCustomer, email: 'notanemail' } },
  });
  assert(chkInvalidEmail.status === 400, 'Checkout rejects invalid email format (400)', `Status: ${chkInvalidEmail.status}`);

  // Invalid phone (< 7 chars)
  const chkShortPhone = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: { customerDetails: { ...validCustomer, phone: '123' } },
  });
  assert(chkShortPhone.status === 400, 'Checkout rejects short phone number (400)', `Status: ${chkShortPhone.status}`);

  // Invalid pincode (< 3 chars)
  const chkShortPin = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: { customerDetails: { ...validCustomer, pinCode: '1' } },
  });
  assert(chkShortPin.status === 400, 'Checkout rejects short PIN code (400)', `Status: ${chkShortPin.status}`);

  // -------------------------------------------------------------
  // Test 7: Successful Order Placement, MongoDB Storage, Stock Updates & Cart Clearing
  // -------------------------------------------------------------
  console.log('\n--- Requirements 8, 9, 10, 11: Order Placement, Storage, Stock Updates & Cart Clearing ---');
  // Check stock before order
  const productBeforeOrder = await Product.findById(productA._id).lean();
  const initialStock = productBeforeOrder.stock;
  const orderedQuantity = 2; // In cart: productA with quantity 2

  const orderRes = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: { customerDetails: validCustomer },
  });

  assert(orderRes.status === 201 && orderRes.data.order && orderRes.data.order._id,
    'Successful order placement returns 201 with created order details',
    `Status: ${orderRes.status}, OrderId: ${orderRes.data?.order?._id}`);

  const placedOrderId = orderRes.data.order._id;
  const expectedTotal = Math.round(productA.price * orderedQuantity * 100) / 100;
  assert(orderRes.data.order.totalAmount === expectedTotal,
    `Order total amount matches expected sum (₹${orderRes.data.order.totalAmount} === ₹${expectedTotal})`);

  // Verify in MongoDB directly
  const orderInDb = await Order.findById(placedOrderId).lean();
  assert(orderInDb !== null, 'Order is persisted and found directly in MongoDB orders collection');
  assert(orderInDb.orderStatus === 'pending', 'Stored order status defaults to "pending"');
  assert(orderInDb.products.length === 1 && orderInDb.products[0].quantity === orderedQuantity,
    'Stored order contains correct product snapshot and quantity');

  // Verify Stock Decrement in MongoDB
  const productAfterOrder = await Product.findById(productA._id).lean();
  assert(productAfterOrder.stock === initialStock - orderedQuantity,
    `Product stock in MongoDB decremented correctly (${initialStock} -> ${productAfterOrder.stock})`,
    `Expected: ${initialStock - orderedQuantity}, Found: ${productAfterOrder.stock}`);

  // Verify Cart Clearing in MongoDB and via API
  const cartAfterCheckout = await request('/cart', { token: userToken });
  assert(cartAfterCheckout.status === 200 && cartAfterCheckout.data.cart.items.length === 0,
    'Cart items cleared after successful checkout via API');

  const userCartInDb = await Cart.findOne({ user: orderInDb.user }).lean();
  assert(userCartInDb && userCartInDb.items.length === 0,
    'Cart items array is empty directly in MongoDB');

  // Checkout with empty cart rejected
  const emptyCartCheckout = await request('/orders', {
    method: 'POST',
    token: userToken,
    body: { customerDetails: validCustomer },
  });
  assert(emptyCartCheckout.status === 400,
    'Checkout with empty cart is rejected with 400',
    `Status: ${emptyCartCheckout.status}`);

  // -------------------------------------------------------------
  // Test 8: Order History
  // -------------------------------------------------------------
  console.log('\n--- Requirement 12: Order History ---');
  const myOrdersRes = await request('/orders/my-orders', { token: userToken });
  assert(myOrdersRes.status === 200 && Array.isArray(myOrdersRes.data.orders) && myOrdersRes.data.orders.length >= 1,
    'User can list their order history via /api/orders/my-orders',
    `Found: ${myOrdersRes.data?.orders?.length}`);

  const hasPlacedOrder = myOrdersRes.data.orders.some(o => o._id === placedOrderId);
  assert(hasPlacedOrder, 'Order history contains the newly placed order ID');

  const getSingleOrder = await request(`/orders/${placedOrderId}`, { token: userToken });
  assert(getSingleOrder.status === 200 && getSingleOrder.data.order._id === placedOrderId,
    'User can view details of their specific order via /api/orders/:id');

  // -------------------------------------------------------------
  // Test 9: User Isolation & Access Control (Security)
  // -------------------------------------------------------------
  console.log('\n--- Security: User Isolation & Authorization Boundaries ---');
  // Create User B
  const userBEmail = `userb_${uniqueSuffix}@example.com`;
  await request('/users/register', {
    method: 'POST',
    body: { name: 'User Beta', email: userBEmail, password: testUserPassword },
  });
  const loginB = await request('/users/login', {
    method: 'POST',
    body: { email: userBEmail, password: testUserPassword },
  });
  const userBToken = loginB.data.token;

  // User B adds an item to their cart
  await request('/cart/items', {
    method: 'POST',
    token: userBToken,
    body: { productId: productB._id, quantity: 1 },
  });

  // User A inspects their cart: must still be empty!
  const userACart = await request('/cart', { token: userToken });
  assert(userACart.data.cart.items.length === 0, 'User A cannot access or see User B cart items');

  // User B tries to view User A's order -> must return 404 (isolation)
  const userBAccessOrderA = await request(`/orders/${placedOrderId}`, { token: userBToken });
  assert(userBAccessOrderA.status === 404,
    'User B cannot access User A order details (returns 404)',
    `Status: ${userBAccessOrderA.status}`);

  // Regular user tries to access Admin APIs -> must return 403
  const userCreateProduct = await request('/products', {
    method: 'POST',
    token: userToken,
    body: { name: 'Hacked Item', description: 'Desc', price: 99, category: 'Test', stock: 5 },
  });
  assert(userCreateProduct.status === 403,
    'Regular user cannot create product via POST /api/products (403 Forbidden)',
    `Status: ${userCreateProduct.status}`);

  const userUpdateProduct = await request(`/products/${productA._id}`, {
    method: 'PUT',
    token: userToken,
    body: { price: 1 },
  });
  assert(userUpdateProduct.status === 403,
    'Regular user cannot update product via PUT /api/products/:id (403 Forbidden)',
    `Status: ${userUpdateProduct.status}`);

  const userDeleteProduct = await request(`/products/${productA._id}`, {
    method: 'DELETE',
    token: userToken,
  });
  assert(userDeleteProduct.status === 403,
    'Regular user cannot delete product via DELETE /api/products/:id (403 Forbidden)',
    `Status: ${userDeleteProduct.status}`);

  const userListAllOrders = await request('/orders', { token: userToken });
  assert(userListAllOrders.status === 403,
    'Regular user cannot access admin order list via GET /api/orders (403 Forbidden)',
    `Status: ${userListAllOrders.status}`);

  const userUpdateOrderStatus = await request(`/orders/${placedOrderId}/status`, {
    method: 'PUT',
    token: userToken,
    body: { orderStatus: 'shipped' },
  });
  assert(userUpdateOrderStatus.status === 403,
    'Regular user cannot update order status via PUT /api/orders/:id/status (403 Forbidden)',
    `Status: ${userUpdateOrderStatus.status}`);

  // -------------------------------------------------------------
  // Test 10: Admin Product & Order Management
  // -------------------------------------------------------------
  console.log('\n--- Requirements 13 & 14: Admin Product & Order Management ---');
  // Admin Login
  const adminLogin = await request('/users/login', {
    method: 'POST',
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  assert(adminLogin.status === 200 && adminLogin.data.user.role === 'admin',
    'Admin login succeeds with role: "admin"',
    `Role: ${adminLogin.data?.user?.role}`);
  const adminToken = adminLogin.data.token;

  // Admin Profile
  const adminProfile = await request('/users/profile', { token: adminToken });
  assert(adminProfile.status === 200 && adminProfile.data.user.role === 'admin',
    'Admin profile endpoint returns role: "admin"');

  // Admin creates new product
  const newProductPayload = {
    name: `Test Admin Product ${uniqueSuffix}`,
    description: 'A test product created by admin test suite for quality verification.',
    price: 499.50,
    category: 'Electronics',
    stock: 15,
    image: 'images/product-placeholder.svg',
  };
  const createProductRes = await request('/products', {
    method: 'POST',
    token: adminToken,
    body: newProductPayload,
  });
  assert(createProductRes.status === 201 && createProductRes.data.product._id,
    'Admin can create product via POST /api/products (201 Created)',
    `Status: ${createProductRes.status}`);
  const createdProductId = createProductRes.data.product._id;

  // Verify created product in MongoDB
  const productInDb = await Product.findById(createdProductId).lean();
  assert(productInDb !== null && productInDb.name === newProductPayload.name,
    'Admin created product is verified in MongoDB');

  // Admin updates product
  const updateProductRes = await request(`/products/${createdProductId}`, {
    method: 'PUT',
    token: adminToken,
    body: { price: 549.99, stock: 20 },
  });
  assert(updateProductRes.status === 200 && updateProductRes.data.product.price === 549.99 && updateProductRes.data.product.stock === 20,
    'Admin can update product price and stock via PUT /api/products/:id',
    `Updated price: ${updateProductRes.data?.product?.price}`);

  // Admin lists all orders
  const allOrdersRes = await request('/orders', { token: adminToken });
  assert(allOrdersRes.status === 200 && Array.isArray(allOrdersRes.data.orders) && allOrdersRes.data.orders.length > 0,
    'Admin can view all customer orders via GET /api/orders',
    `Total orders found: ${allOrdersRes.data?.orders?.length}`);

  // Admin views any specific customer order
  const adminViewUserOrder = await request(`/orders/${placedOrderId}`, { token: adminToken });
  assert(adminViewUserOrder.status === 200 && adminViewUserOrder.data.order._id === placedOrderId,
    'Admin can inspect any individual customer order via GET /api/orders/:id');

  // Admin updates order status
  const updateStatusRes = await request(`/orders/${placedOrderId}/status`, {
    method: 'PUT',
    token: adminToken,
    body: { orderStatus: 'shipped' },
  });
  assert(updateStatusRes.status === 200 && updateStatusRes.data.order.orderStatus === 'shipped',
    'Admin can update order status (pending -> shipped) via PUT /api/orders/:id/status',
    `Status: ${updateStatusRes.data?.order?.orderStatus}`);

  // Verify updated status directly in MongoDB
  const orderUpdatedInDb = await Order.findById(placedOrderId).lean();
  assert(orderUpdatedInDb.orderStatus === 'shipped', 'Updated order status is verified directly in MongoDB');

  // Admin deletes the test product
  const deleteProductRes = await request(`/products/${createdProductId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert(deleteProductRes.status === 200,
    'Admin can delete product via DELETE /api/products/:id',
    `Status: ${deleteProductRes.status}`);

  const productDeletedInDb = await Product.findById(createdProductId);
  assert(productDeletedInDb === null, 'Deleted product is confirmed removed from MongoDB');

  // -------------------------------------------------------------
  // Test 11: Frontend Code Quality, Console Errors & Static Verification
  // -------------------------------------------------------------
  console.log('\n--- Requirements 15, 16, 17, 18, 19: Frontend Quality, Navigation, Responsiveness & Console Errors ---');

  // Check JavaScript syntax
  const scriptJsContent = fs.readFileSync(path.join(__dirname, '../../frontend/script.js'), 'utf8');
  const storeJsContent = fs.readFileSync(path.join(__dirname, '../../frontend/store.js'), 'utf8');

  let scriptSyntaxOk = true;
  try {
    new Function(scriptJsContent);
  } catch (err) {
    scriptSyntaxOk = false;
    console.error('script.js syntax error:', err.message);
  }
  assert(scriptSyntaxOk, 'frontend/script.js has zero syntax errors and compiles cleanly');

  let storeSyntaxOk = true;
  try {
    new Function(storeJsContent);
  } catch (err) {
    storeSyntaxOk = false;
    console.error('store.js syntax error:', err.message);
  }
  assert(storeSyntaxOk, 'frontend/store.js has zero syntax errors and compiles cleanly');

  // Verify HTML files exist and have responsive viewport meta tags
  const htmlFiles = [
    'index.html',
    'products.html',
    'product.html',
    'cart.html',
    'checkout.html',
    'orders.html',
    'order-confirmation.html',
    'admin.html',
    'dashboard.html',
    'login.html',
    'register.html',
  ];

  for (const file of htmlFiles) {
    const filePath = path.join(__dirname, '../../frontend', file);
    const exists = fs.existsSync(filePath);
    assert(exists, `HTML file exists: ${file}`);
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');
      const hasViewport = content.includes('name="viewport"');
      assert(hasViewport, `${file} includes mobile/tablet responsive viewport meta tag`);
      const hasStylesheet = content.includes('href="style.css"');
      assert(hasStylesheet, `${file} links to stylesheet style.css`);
    }
  }

  // Check CSS media queries in style.css
  const styleCssContent = fs.readFileSync(path.join(__dirname, '../../frontend/style.css'), 'utf8');
  assert(styleCssContent.includes('@media (max-width: 900px)'), 'style.css has tablet responsive rules (max-width: 900px)');
  assert(styleCssContent.includes('@media (max-width: 680px)'), 'style.css has mobile responsive rules (max-width: 680px)');
  assert(styleCssContent.includes('@media (max-width: 420px)'), 'style.css has small-phone responsive rules (max-width: 420px)');
  assert(styleCssContent.includes('[hidden]'), 'style.css enforces [hidden] { display: none !important; } for navigation');

  // Verify DOM references in store.js exist in their respective HTML files
  const productsHtml = fs.readFileSync(path.join(__dirname, '../../frontend/products.html'), 'utf8');
  assert(productsHtml.includes('id="product-grid"'), 'products.html has #product-grid element');
  assert(productsHtml.includes('id="product-search"'), 'products.html has #product-search element');
  assert(productsHtml.includes('id="category-filter"'), 'products.html has #category-filter element');
  assert(productsHtml.includes('id="product-sort"'), 'products.html has #product-sort element');

  const cartHtml = fs.readFileSync(path.join(__dirname, '../../frontend/cart.html'), 'utf8');
  assert(cartHtml.includes('id="cart-items"'), 'cart.html has #cart-items element');
  assert(cartHtml.includes('id="cart-subtotal"'), 'cart.html has #cart-subtotal element');
  assert(cartHtml.includes('id="checkout-link"'), 'cart.html has #checkout-link element');

  const checkoutHtml = fs.readFileSync(path.join(__dirname, '../../frontend/checkout.html'), 'utf8');
  assert(checkoutHtml.includes('id="checkout-form"'), 'checkout.html has #checkout-form element');
  assert(checkoutHtml.includes('id="checkout-summary"'), 'checkout.html has #checkout-summary element');
  assert(checkoutHtml.includes('id="checkout-total"'), 'checkout.html has #checkout-total element');

  const adminHtml = fs.readFileSync(path.join(__dirname, '../../frontend/admin.html'), 'utf8');
  assert(adminHtml.includes('id="admin-product-form"'), 'admin.html has #admin-product-form element');
  assert(adminHtml.includes('id="admin-products"'), 'admin.html has #admin-products element');
  assert(adminHtml.includes('id="admin-orders"'), 'admin.html has #admin-orders element');

  // Verify Navbar navigation consistency:
  const pagesWithNav = ['index.html', 'products.html', 'product.html', 'cart.html', 'checkout.html', 'orders.html', 'order-confirmation.html', 'admin.html'];
  for (const page of pagesWithNav) {
    const content = fs.readFileSync(path.join(__dirname, '../../frontend', page), 'utf8');
    const hasAuthLink = content.includes('data-auth-link');
    const hasGuestLink = content.includes('data-guest-link');
    const hasAdminLink = content.includes('data-admin-link');
    const hasLogout = content.includes('data-logout-button') || content.includes('Log out');
    assert(hasAuthLink && hasGuestLink && hasAdminLink && hasLogout,
      `${page} contains full responsive navbar with guest, auth, admin, and logout actions`);
  }

  // Restore modified product stock so database catalog stock is untouched
  await Product.updateOne({ _id: productA._id }, { $set: { stock: initialStock } });
  console.log(`\nRestored product '${productA.name}' stock back to initial value (${initialStock}).`);

  // Clean up test order and test users created during test run to leave database in pristine state
  const testUsers = await User.find({ email: { $regex: /^(tester_|userb_)/ } }).select('_id');
  const testUserIds = testUsers.map(u => u._id);
  await Order.deleteMany({ user: { $in: testUserIds } });
  await Cart.deleteMany({ user: { $in: testUserIds } });
  await User.deleteMany({ _id: { $in: testUserIds } });
  console.log('Cleaned up all test-generated orders, carts, and test users (original data fully preserved).');

  await mongoose.disconnect();

  console.log('\n======================================================');
  console.log(`TEST RESULTS SUMMARY:`);
  console.log(`  PASSED: ${results.passed.length}`);
  console.log(`  FAILED: ${results.failed.length}`);
  console.log('======================================================\n');

  if (results.failed.length > 0) {
    console.error('Failed Tests:');
    results.failed.forEach(f => console.error(`  - ${f.testName}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  }
})().catch(err => {
  console.error('Unexpected test suite error:', err);
  process.exit(1);
});
