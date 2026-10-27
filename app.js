import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات قاعدة بيانات فايربيس الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyAtCSiIDDN9nceKMj2xZbjREy9qXFEv68k",
  authDomain: "rawi-ye02.firebaseapp.com",
  projectId: "rawi-ye02",
  storageBucket: "rawi-ye02.firebasestorage.app",
  messagingSenderId: "247996335759",
  appId: "1:247996335759:web:846f6e93f75175bddc92fa",
  measurementId: "G-0RDKKNKSJJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// متغيرات النظام الافتراضية
let storeConfig = {
  storeName: "NAFAL Specialty Roast",
  bannerText: "المتجر يوصل لداخل شرورة فقط",
  promoMessage: "اطلب بـ 100 ريال والتوصيل بـ 5 ريال! وعند الطلب بـ 300 ريال التوصيل مجاني!",
  baseDeliveryFee: 15,
  enableSmartOffers: true,
  tier1Threshold: 100,
  tier1Fee: 5,
  tier2Threshold: 300,
  tier2Fee: 0,
  whatsappNumber: "966500000000",
  snapchatUrl: "",
  tiktokUrl: "",
  categories: ["محاصيل مختصة", "أدوات قهوة", "بكجات نفال"]
};

let allProducts = [];
let selectedCategory = "all";
let cart = JSON.parse(localStorage.getItem("nafal_cart") || "[]");
let savedInvoices = JSON.parse(localStorage.getItem("nafal_my_invoices") || "[]");

// إشعار عائم زجاجي
function showToast(msg) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  toastText.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2800);
}

// 2. الاستماع المباشر لإعدادات المتجر والعروض من غرفة العمليات
function listenToStoreSettings() {
  onSnapshot(doc(db, "nafal_settings", "storeConfig"), (snap) => {
    if (snap.exists()) {
      storeConfig = { ...storeConfig, ...snap.data() };
      applyStoreSettingsToUI();
      renderCategoriesBar();
      updateCartUI();
    }
  });
}

function applyStoreSettingsToUI() {
  document.getElementById("topBanner").textContent = storeConfig.bannerText || "المتجر يوصل لداخل شرورة فقط";
  document.getElementById("promoText").textContent = storeConfig.promoMessage || "";

  const snapBtn = document.getElementById("snapchatLink");
  const tiktokBtn = document.getElementById("tiktokLink");
  const waBtn = document.getElementById("whatsappFooterLink");

  if (storeConfig.snapchatUrl) {
    snapBtn.href = storeConfig.snapchatUrl;
    snapBtn.classList.remove("hidden");
  } else {
    snapBtn.classList.add("hidden");
  }

  if (storeConfig.tiktokUrl) {
    tiktokBtn.href = storeConfig.tiktokUrl;
    tiktokBtn.classList.remove("hidden");
  } else {
    tiktokBtn.classList.add("hidden");
  }

  if (storeConfig.whatsappNumber) {
    const cleanPhone = storeConfig.whatsappNumber.replace(/[^0-9]/g, "");
    waBtn.href = `https://wa.me/${cleanPhone}`;
    waBtn.classList.remove("hidden");
  }
}

// 3. عرض الأقسام والمنتجات بأيقونات احترافية
function renderCategoriesBar() {
  const bar = document.getElementById("categoriesBar");
  bar.innerHTML = `
    <button class="cat-pill ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
      <i class="ri-apps-2-line"></i>
      <span>كل المحاصيل والمنتجات</span>
    </button>
  `;

  (storeConfig.categories || []).forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `cat-pill ${selectedCategory === cat ? "active" : ""}`;
    btn.dataset.cat = cat;
    btn.innerHTML = `<i class="ri-cup-line"></i><span>${cat}</span>`;
    bar.appendChild(btn);
  });

  bar.querySelectorAll(".cat-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedCategory = btn.dataset.cat;
      renderCategoriesBar();
      renderProductsGrid();
    });
  });
}

function listenToProducts() {
  const q = query(collection(db, "nafal_products"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    allProducts = [];
    snapshot.forEach(docSnap => {
      allProducts.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderProductsGrid();
  });
}

function renderProductsGrid() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  const filtered = selectedCategory === "all" 
    ? allProducts 
    : allProducts.filter(p => p.category === selectedCategory);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="loading-box glass-panel">
        <i class="ri-cup-line"></i>
        <span>لا توجد محاصيل أو منتجات في هذا القسم حالياً</span>
      </div>
    `;
    return;
  }

  filtered.forEach(prod => {
    const outOfStock = prod.stock <= 0;
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-img-wrap">
        <img src="${prod.imageUrl}" alt="${prod.name}">
        ${prod.freeDelivery ? `<span class="badge-free-delivery"><i class="ri-truck-line"></i> توصيل مجاني</span>` : ""}
        <span class="badge-category">${prod.category}</span>
      </div>
      <div class="product-info">
        <h3 class="product-title">${prod.name}</h3>
        <p class="product-desc">${prod.description || "محصول قهوة مختصة فاخر من نفال"}</p>
        <div class="product-footer">
          <span class="product-price">${prod.price} <small>ريال</small></span>
          <button class="btn-add" ${outOfStock ? "disabled" : ""}>
            <i class="${outOfStock ? 'ri-forbid-2-line' : 'ri-add-line'}"></i>
            <span>${outOfStock ? "نفذت الكمية" : "أضف للسلة"}</span>
          </button>
        </div>
      </div>
    `;

    if (!outOfStock) {
      card.querySelector(".btn-add").addEventListener("click", () => addToCart(prod));
    }

    grid.appendChild(card);
  });
}

// 4. إدارة سلة المشتريات وحساب التوصيل الذكي
function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty += 1;
    } else {
      showToast("وصلت للحد الأقصى المتوفر في المخزون");
      return;
    }
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      freeDelivery: !!product.freeDelivery,
      qty: 1,
      maxStock: Number(product.stock)
    });
  }
  saveCart();
  updateCartUI();
  showToast(`تمت إضافة "${product.name}" للسلة`);
}

function saveCart() {
  localStorage.setItem("nafal_cart", JSON.stringify(cart));
}

function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  if (cart.length === 0) {
    return { subtotal: 0, deliveryFee: 0, total: 0, hint: "سلتك فارغة حالياً، أضف محاصيلك المفضلة" };
  }

  const allItemsFreeDelivery = cart.every(item => item.freeDelivery === true);
  if (allItemsFreeDelivery) {
    return { 
      subtotal, 
      deliveryFee: 0, 
      total: subtotal, 
      hint: "منتجاتك المختارة تشمل توصيل مجاني داخل شرورة" 
    };
  }

  let deliveryFee = Number(storeConfig.baseDeliveryFee ?? 15);
  let hint = `سعر التوصيل داخل شرورة: ${deliveryFee} ريال`;

  if (storeConfig.enableSmartOffers) {
    const t1 = Number(storeConfig.tier1Threshold || 100);
    const f1 = Number(storeConfig.tier1Fee ?? 5);
    const t2 = Number(storeConfig.tier2Threshold || 300);
    const f2 = Number(storeConfig.tier2Fee ?? 0);

    if (subtotal >= t2) {
      deliveryFee = f2;
      hint = f2 === 0 
        ? `مبروك! فاتورتك تجاوزت ${t2} ريال وحصلت على توصيل مجاني` 
        : `مبروك! حصلت على عرض التوصيل المخفض (${f2} ريال فقط)`;
    } else if (subtotal >= t1) {
      deliveryFee = f1;
      const remainingForT2 = t2 - subtotal;
      hint = `التوصيل الآن بـ ${f1} ريال فقط! أضف بـ ${remainingForT2} ريال ليصبح التوصيل ${f2 === 0 ? "مجاني" : f2 + " ريال"}`;
    } else {
      const remainingForT1 = t1 - subtotal;
      hint = `أضف منتجات بقيمة ${remainingForT1} ريال ليصبح التوصيل بـ ${f1} ريال فقط بدلاً من ${deliveryFee} ريال`;
    }
  }

  return {
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    hint
  };
}

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById("cartCount").textContent = totalCount;

  const container = document.getElementById("cartItemsContainer");
  container.innerHTML = "";

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span>${item.price} ريال × ${item.qty} = ${item.price * item.qty} ريال</span>
      </div>
      <div class="qty-controls">
        <button type="button" class="qty-btn dec-btn"><i class="ri-subtract-line"></i></button>
        <strong>${item.qty}</strong>
        <button type="button" class="qty-btn inc-btn"><i class="ri-add-line"></i></button>
      </div>
    `;

    row.querySelector(".dec-btn").addEventListener("click", () => {
      if (item.qty > 1) {
        item.qty -= 1;
      } else {
        cart.splice(index, 1);
      }
      saveCart();
      updateCartUI();
    });

    row.querySelector(".inc-btn").addEventListener("click", () => {
      if (item.qty < item.maxStock) {
        item.qty += 1;
        saveCart();
        updateCartUI();
      } else {
        showToast("وصلت للكمية القصوى المتاحة في المخزون");
      }
    });

    container.appendChild(row);
  });

  const totals = calculateTotals();
  document.getElementById("smartDeliveryHint").textContent = totals.hint;
  document.getElementById("subtotalAmount").textContent = totals.subtotal;
  document.getElementById("deliveryAmount").textContent = totals.deliveryFee;
  document.getElementById("finalTotalAmount").textContent = totals.total;
}

// 5. تحديد الموقع الجغرافي (GPS) للعميل
document.getElementById("getGpsBtn").addEventListener("click", () => {
  const statusText = document.getElementById("gpsStatusText");
  const gpsInput = document.getElementById("custGpsUrl");

  if (!navigator.geolocation) {
    statusText.textContent = "متصفحك لا يدعم تحديد الموقع، يرجى كتابة العنوان بالأسفل.";
    return;
  }

  statusText.textContent = "جاري التقاط موقعك الجغرافي بالـ GPS...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      gpsInput.value = mapsUrl;
      statusText.textContent = "تم تحديد موقعك الجغرافي بنجاح";
    },
    () => {
      statusText.textContent = "تعذر التقاط الـ GPS، تأكد من تفعيل الموقع أو اكتب حيّك بالأسفل.";
      gpsInput.removeAttribute("readonly");
      gpsInput.placeholder = "اكتب اسم الحي والشارع هنا";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// 6. إنشاء الفاتورة، حفظها في القاعدة، وتحويل الطلب لواتساب المتجر
function generateInvoiceNumber() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `NF-${randomDigits}`;
}

document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) {
    showToast("السلة فارغة! أضف منتجات أولاً");
    return;
  }

  const submitBtn = document.getElementById("submitOrderBtn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ri-loader-4-line spin-icon"></i><span>جاري إصدار الفاتورة...</span>`;

  const invoiceNumber = generateInvoiceNumber();
  const totals = calculateTotals();

  const orderData = {
    invoiceNumber,
    customerName: document.getElementById("custName").value.trim(),
    customerPhone: document.getElementById("custPhone").value.trim(),
    customerEmail: document.getElementById("custEmail").value.trim(),
    gpsLocation: document.getElementById("custGpsUrl").value.trim(),
    customerAddress: document.getElementById("custAddress").value.trim() || "داخل شرورة",
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    totalAmount: totals.total,
    status: "جديد - قيد المراجعة",
    createdAt: Date.now()
  };

  try {
    await addDoc(collection(db, "nafal_orders"), orderData);

    for (const item of cart) {
      const prod = allProducts.find(p => p.id === item.id);
      if (prod) {
        const newStock = Math.max(0, Number(prod.stock) - item.qty);
        await updateDoc(doc(db, "nafal_products", item.id), { stock: newStock });
      }
    }

    if (!savedInvoices.includes(invoiceNumber)) {
      savedInvoices.unshift(invoiceNumber);
      localStorage.setItem("nafal_my_invoices", JSON.stringify(savedInvoices));
    }

    const storeWa = (storeConfig.whatsappNumber || "").replace(/[^0-9]/g, "");
    const itemsSummary = orderData.items.map(i => `• ${i.name} (${i.qty})`).join("\n");

    const waText = encodeURIComponent(
      `*طلب جديد - متجر نفال للقهوة المختصة*\n` +
      `*رقم الفاتورة:* #${invoiceNumber}\n` +
      `*العميل:* ${orderData.customerName}\n` +
      `*الجوال:* ${orderData.customerPhone}\n` +
      `*الموقع (GPS):* ${orderData.gpsLocation}\n` +
      `*العنوان:* ${orderData.customerAddress}\n` +
      `------------------\n` +
      `*الطلبات:*\n${itemsSummary}\n` +
      `------------------\n` +
      `*التوصيل:* ${orderData.deliveryFee} ريال\n` +
      `*الإجمالي النهائي:* ${orderData.totalAmount} ريال`
    );

    cart = [];
    saveCart();
    updateCartUI();
    document.getElementById("checkoutForm").reset();
    document.getElementById("cartModal").classList.add("hidden");

    document.getElementById("ordersModal").classList.remove("hidden");
    listenToCustomerInvoices();

    window.open(`https://wa.me/${storeWa}?text=${waText}`, "_blank");

  } catch (err) {
    console.error("Order Submit Error:", err);
    showToast("حدث خطأ أثناء إنشاء الفاتورة، حاول مرة أخرى");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="ri-whatsapp-line"></i><span>إنشاء الفاتورة وتأكيد الطلب عبر واتساب</span>`;
  }
});

// 7. نظام متابعة حالة الفواتير المباشر للعميل بالأيقونات
let unsubscribeInvoices = null;

function listenToCustomerInvoices(searchInvoice = "") {
  const container = document.getElementById("customerOrdersList");
  const targetList = searchInvoice ? [searchInvoice.toUpperCase()] : savedInvoices;

  if (targetList.length === 0) {
    container.innerHTML = `<p class="hint-text">لا توجد فواتير محفوظة. يمكنك البحث برقم فاتورتك بالأعلى.</p>`;
    return;
  }

  if (unsubscribeInvoices) unsubscribeInvoices();

  const q = query(collection(db, "nafal_orders"), orderBy("createdAt", "desc"));
  unsubscribeInvoices = onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    const matched = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (targetList.includes((data.invoiceNumber || "").toUpperCase())) {
        matched.push(data);
      }
    });

    if (matched.length === 0) {
      container.innerHTML = `<p class="hint-text">لم يتم العثور على فاتورة بهذا الرقم.</p>`;
      return;
    }

    const stepsMeta = [
      { label: "جديد - قيد المراجعة", icon: "ri-time-line" },
      { label: "جاري التحميص والتجهيز", icon: "ri-fire-line" },
      { label: "مع المندوب للتوصيل", icon: "ri-e-bike-2-line" },
      { label: "تم التوصيل", icon: "ri-checkbox-circle-line" }
    ];

    matched.forEach(order => {
      const currentIdx = stepsMeta.findIndex(s => s.label === order.status);

      const stepsHtml = stepsMeta.map((st, idx) => `
        <div class="step-box ${idx <= currentIdx ? "done" : ""}">
          <i class="${st.icon}"></i>
          <span>${st.label}</span>
        </div>
      `).join("");

      const itemsLine = (order.items || []).map(i => `${i.name} × ${i.qty}`).join(" ، ");

      const card = document.createElement("div");
      card.className = "invoice-card";
      card.innerHTML = `
        <div class="invoice-top">
          <strong>فاتورة #${order.invoiceNumber}</strong>
          <span class="status-pill">${order.status}</span>
        </div>
        <div class="hint-text">المنتجات: ${itemsLine}</div>
        <div><strong>الإجمالي: ${order.totalAmount} ريال</strong> (شامل التوصيل: ${order.deliveryFee} ريال)</div>
        <div class="status-steps">${stepsHtml}</div>
      `;
      container.appendChild(card);
    });
  });
}

document.getElementById("searchInvoiceBtn").addEventListener("click", () => {
  const val = document.getElementById("searchInvoiceInput").value.trim();
  listenToCustomerInvoices(val);
});

// 8. فتح وإغلاق النوافذ
document.getElementById("openCartBtn").addEventListener("click", () => {
  updateCartUI();
  document.getElementById("cartModal").classList.remove("hidden");
});

document.getElementById("closeCartBtn").addEventListener("click", () => {
  document.getElementById("cartModal").classList.add("hidden");
});

document.getElementById("openOrdersBtn").addEventListener("click", () => {
  document.getElementById("ordersModal").classList.remove("hidden");
  listenToCustomerInvoices();
});

document.getElementById("closeOrdersBtn").addEventListener("click", () => {
  document.getElementById("ordersModal").classList.add("hidden");
});

// تشغيل المتجر
listenToStoreSettings();
listenToProducts();
updateCartUI();
