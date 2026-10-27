import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  initializeFirestore, getFirestore, collection, doc, addDoc, updateDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات قاعدة بيانات فايربيس مع تفعيل الاتصال المستقر
const firebaseConfig = {
  apiKey: "AIzaSyAtCSiIDDN9nceKMj2xZbjREy9qXFEv68k",
  authDomain: "rawi-ye02.firebaseapp.com",
  projectId: "rawi-ye02",
  storageBucket: "rawi-ye02.firebasestorage.app",
  messagingSenderId: "247996335759",
  appId: "1:247996335759:web:846f6e93f75175bddc92fa",
  measurementId: "G-0RDKKNKSJJ"
};

let app;
let db;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true
  });
} else {
  app = getApps()[0];
  db = getFirestore(app);
}

const DEFAULT_COFFEE_IMG = "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80";

let storeConfig = {
  storeName: "NAFAL Specialty Roast",
  storeDescription: "نفال للقهوة المختصة والمحاصيل الفاخرة",
  storeLogo: "",
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
  instagramUrl: "",
  twitterUrl: "",
  mapsUrl: "",
  categories: ["محاصيل مختصة", "أدوات قهوة", "بكجات نفال"]
};

let allProducts = [];
let selectedCategory = "all";
let cart = JSON.parse(localStorage.getItem("nafal_cart") || "[]");
let savedInvoices = JSON.parse(localStorage.getItem("nafal_my_invoices") || "[]");

// متغيرات صفحة تفاصيل المنتج المفتوحة حالياً
let currentDetailProduct = null;
let currentDetailQty = 1;

function showToast(msg) {
  const toast = document.getElementById("toast");
  document.getElementById("toastText").textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2800);
}

// 2. الاستماع المباشر لإعدادات المتجر والهوية
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
  const name = storeConfig.storeName || "NAFAL Specialty Roast";
  const desc = storeConfig.storeDescription || "نفال للقهوة المختصة والمحاصيل الفاخرة";
  document.title = `${name} | ${desc}`;
  document.getElementById("storeTitle").textContent = name;
  document.getElementById("storeDesc").textContent = desc;
  document.getElementById("footerStoreName").textContent = name;
  document.getElementById("footerStoreDesc").textContent = `${desc} — شرورة`;

  const logoImg = document.getElementById("storeLogoImg");
  const logoIcon = document.getElementById("storeLogoIcon");
  if (storeConfig.storeLogo) {
    logoImg.src = storeConfig.storeLogo;
    logoImg.classList.remove("hidden");
    logoIcon.classList.add("hidden");
  } else {
    logoImg.classList.add("hidden");
    logoIcon.classList.remove("hidden");
  }

  document.getElementById("topBanner").textContent = storeConfig.bannerText || "المتجر يوصل لداخل شرورة فقط";
  const promoSection = document.getElementById("promoSection");
  if (storeConfig.promoMessage) {
    document.getElementById("promoText").textContent = storeConfig.promoMessage;
    promoSection.classList.remove("hidden");
  } else {
    promoSection.classList.add("hidden");
  }

  toggleSocialLink("snapchatLink", storeConfig.snapchatUrl);
  toggleSocialLink("tiktokLink", storeConfig.tiktokUrl);
  toggleSocialLink("instagramLink", storeConfig.instagramUrl);
  toggleSocialLink("twitterLink", storeConfig.twitterUrl);
  toggleSocialLink("mapsLink", storeConfig.mapsUrl);

  const waBtn = document.getElementById("whatsappFooterLink");
  if (storeConfig.whatsappNumber) {
    const cleanPhone = storeConfig.whatsappNumber.replace(/[^0-9]/g, "");
    waBtn.href = `https://wa.me/${cleanPhone}`;
    waBtn.classList.remove("hidden");
  } else {
    waBtn.classList.add("hidden");
  }
}

function toggleSocialLink(elementId, url) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (url && url.trim() !== "") {
    el.href = url.trim();
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

// استخراج مصفوفة صور المنتج بمرونة (يدعم صورة واحدة أو عدة صور)
function getProductImages(prod) {
  const list = [];
  if (Array.isArray(prod.images) && prod.images.length > 0) {
    prod.images.forEach(u => {
      if (u && typeof u === "string" && u.trim() !== "") list.push(u.trim());
    });
  }
  if (prod.imageUrl && !list.includes(prod.imageUrl.trim())) {
    list.unshift(prod.imageUrl.trim());
  }
  if (list.length === 0) {
    list.push(DEFAULT_COFFEE_IMG);
  }
  return list;
}

// 3. عرض الأقسام والمنتجات
function renderCategoriesBar() {
  const bar = document.getElementById("categoriesBar");
  bar.innerHTML = `
    <button type="button" class="cat-pill ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
      <i class="ri-apps-2-line"></i>
      <span>كل المحاصيل والمنتجات</span>
    </button>
  `;

  (storeConfig.categories || []).forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
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
  onSnapshot(collection(db, "nafal_products"), (snapshot) => {
    allProducts = [];
    snapshot.forEach(docSnap => {
      allProducts.push({ id: docSnap.id, ...docSnap.data() });
    });
    allProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
    const outOfStock = Number(prod.stock) <= 0;
    const images = getProductImages(prod);
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-img-wrap">
        <img src="${images[0]}" alt="${prod.name}">
        ${prod.freeDelivery ? `<span class="badge-free-delivery"><i class="ri-truck-line"></i> توصيل مجاني</span>` : ""}
        <span class="badge-category">${prod.category}</span>
        ${images.length > 1 ? `<span class="multi-img-indicator"><i class="ri-image-2-line"></i> ${images.length}</span>` : ""}
      </div>
      <div class="product-info">
        <h3 class="product-title">${prod.name}</h3>
        <p class="product-desc">${prod.description || "اضغط لعرض التفاصيل الكاملة للمحصول"}</p>
        <div class="product-footer">
          <span class="product-price">${prod.price} <small>ريال</small></span>
          <button type="button" class="btn-add" ${outOfStock ? "disabled" : ""}>
            <i class="${outOfStock ? 'ri-forbid-2-line' : 'ri-add-line'}"></i>
            <span>${outOfStock ? "نفذت" : "أضف"}</span>
          </button>
        </div>
      </div>
    `;

    // الضغط على البطاقة يفتح صفحة تفاصيل المنتج الكاملة
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-add")) return;
      openProductDetailModal(prod);
    });

    // زر الإضافة السريعة للسلة
    if (!outOfStock) {
      card.querySelector(".btn-add").addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(prod, 1);
      });
    }

    grid.appendChild(card);
  });
}

// 4. نافذة صفحة تفاصيل المنتج الكاملة (معرض الصور + المواصفات + الكمية)
function openProductDetailModal(prod) {
  currentDetailProduct = prod;
  currentDetailQty = 1;

  const images = getProductImages(prod);
  const outOfStock = Number(prod.stock) <= 0;

  document.getElementById("detailTitle").textContent = prod.name;
  document.getElementById("detailPrice").textContent = prod.price;
  document.getElementById("detailCategoryBadge").textContent = prod.category || "محاصيل مختصة";

  const freeBadge = document.getElementById("detailFreeBadge");
  if (prod.freeDelivery) {
    freeBadge.classList.remove("hidden");
  } else {
    freeBadge.classList.add("hidden");
  }

  // حالة المخزون
  const stockEl = document.getElementById("detailStockStatus");
  if (outOfStock) {
    stockEl.className = "stock-pill out";
    stockEl.innerHTML = `<i class="ri-close-circle-fill"></i> نفذت الكمية حالياً`;
  } else {
    stockEl.className = "stock-pill";
    stockEl.innerHTML = `<i class="ri-checkbox-circle-fill"></i> متوفر في المخزون (${prod.stock} قطعة)`;
  }

  // معرض الصور (الصورة الرئيسية + المصغرات)
  const mainImg = document.getElementById("detailMainImg");
  const thumbsContainer = document.getElementById("detailThumbnails");
  mainImg.src = images[0];
  thumbsContainer.innerHTML = "";

  if (images.length > 1) {
    thumbsContainer.classList.remove("hidden");
    images.forEach((imgUrl, idx) => {
      const thumb = document.createElement("div");
      thumb.className = `thumb-item ${idx === 0 ? "active" : ""}`;
      thumb.innerHTML = `<img src="${imgUrl}" alt="صورة ${idx + 1}">`;
      thumb.addEventListener("click", () => {
        mainImg.src = imgUrl;
        thumbsContainer.querySelectorAll(".thumb-item").forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");
      });
      thumbsContainer.appendChild(thumb);
    });
  } else {
    thumbsContainer.classList.add("hidden");
  }

  // المواصفات التفصيلية (الوزن، المعالجة، التحميص، الإيحاءات - تعمل تلقائياً إذا أضيفت من غرفة العمليات)
  const specsGrid = document.getElementById("detailSpecsGrid");
  specsGrid.innerHTML = "";
  const specsList = [
    { label: "الوزن / الحجم", val: prod.weight, icon: "ri-scales-3-line" },
    { label: "المعالجة / المصدر", val: prod.process, icon: "ri-earth-line" },
    { label: "درجة التحميص", val: prod.roastLevel, icon: "ri-fire-line" },
    { label: "الإيحاءات", val: prod.notes, icon: "ri-sparkling-line" }
  ].filter(s => s.val && String(s.val).trim() !== "");

  if (specsList.length > 0) {
    specsGrid.classList.remove("hidden");
    specsList.forEach(sp => {
      const box = document.createElement("div");
      box.className = "spec-card";
      box.innerHTML = `
        <i class="${sp.icon}"></i>
        <div>
          <small>${sp.label}</small>
          <strong>${sp.val}</strong>
        </div>
      `;
      specsGrid.appendChild(box);
    });
  } else {
    specsGrid.classList.add("hidden");
  }

  // الوصف الكامل
  document.getElementById("detailFullDesc").textContent = 
    prod.fullDescription || prod.description || "محصول قهوة مختصة فاخر محمص بعناية ليمنحك تجربة استثنائية.";

  updateDetailModalQtyUI();
  document.getElementById("productDetailModal").classList.remove("hidden");
}

function updateDetailModalQtyUI() {
  if (!currentDetailProduct) return;
  const outOfStock = Number(currentDetailProduct.stock) <= 0;
  document.getElementById("detailQtyValue").textContent = currentDetailQty;
  const addBtn = document.getElementById("detailAddToCartBtn");
  const addBtnText = document.getElementById("detailAddBtnText");

  if (outOfStock) {
    addBtn.disabled = true;
    addBtnText.textContent = "نفذت الكمية";
  } else {
    addBtn.disabled = false;
    const totalPrice = Number(currentDetailProduct.price) * currentDetailQty;
    addBtnText.textContent = `إضافة للسلة (${totalPrice} ريال)`;
  }
}

document.getElementById("detailQtyMinus").addEventListener("click", () => {
  if (currentDetailQty > 1) {
    currentDetailQty -= 1;
    updateDetailModalQtyUI();
  }
});

document.getElementById("detailQtyPlus").addEventListener("click", () => {
  if (!currentDetailProduct) return;
  if (currentDetailQty < Number(currentDetailProduct.stock)) {
    currentDetailQty += 1;
    updateDetailModalQtyUI();
  } else {
    showToast("وصلت للحد الأقصى المتوفر في المخزون");
  }
});

document.getElementById("detailAddToCartBtn").addEventListener("click", () => {
  if (!currentDetailProduct) return;
  addToCart(currentDetailProduct, currentDetailQty);
  document.getElementById("productDetailModal").classList.add("hidden");
});

document.getElementById("closeDetailBtn").addEventListener("click", () => {
  document.getElementById("productDetailModal").classList.add("hidden");
});

// 5. إدارة سلة المشتريات والشريط العائم السفلي
function addToCart(product, qtyToAdd = 1) {
  const existing = cart.find(item => item.id === product.id);
  const maxStock = Number(product.stock);

  if (existing) {
    if (existing.qty + qtyToAdd <= maxStock) {
      existing.qty += qtyToAdd;
    } else {
      existing.qty = maxStock;
      showToast("تمت إضافة الحد الأقصى المتوفر في المخزون");
    }
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      freeDelivery: !!product.freeDelivery,
      qty: Math.min(qtyToAdd, maxStock),
      maxStock
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
        ? `مبروك! فاتورتك وصلت ${t2} ريال وحصلت على توصيل مجاني` 
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
  const totals = calculateTotals();

  document.getElementById("cartCount").textContent = totalCount;
  document.getElementById("dockTotalAmount").textContent = totals.subtotal;

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

  document.getElementById("smartDeliveryHint").textContent = totals.hint;
  document.getElementById("subtotalAmount").textContent = totals.subtotal;
  document.getElementById("deliveryAmount").textContent = totals.deliveryFee;
  document.getElementById("finalTotalAmount").textContent = totals.total;
}

// 6. تحديد الموقع الجغرافي (GPS) للعميل
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

// 7. إنشاء الفاتورة وتحويل الطلب لواتساب المتجر
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
      `*طلب جديد - ${storeConfig.storeName || "متجر نفال"}*\n` +
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

// 8. متابعة حالة الفواتير المباشرة للعميل بالقوائم المنسدلة
let unsubscribeInvoices = null;

function listenToCustomerInvoices(searchInvoice = "") {
  const container = document.getElementById("customerOrdersList");
  const targetList = searchInvoice ? [searchInvoice.toUpperCase()] : savedInvoices;

  if (targetList.length === 0) {
    container.innerHTML = `<p class="hint-text">لا توجد فواتير محفوظة حالياً. يمكنك البحث برقم فاتورتك بالأعلى.</p>`;
    return;
  }

  if (unsubscribeInvoices) unsubscribeInvoices();

  unsubscribeInvoices = onSnapshot(collection(db, "nafal_orders"), (snapshot) => {
    container.innerHTML = "";
    const matched = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (targetList.includes((data.invoiceNumber || "").toUpperCase())) {
        matched.push(data);
      }
    });

    matched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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

    matched.forEach((order, index) => {
      const isCanceled = order.status === "ملغي";
      const currentIdx = stepsMeta.findIndex(s => s.label === order.status);

      const stepsHtml = isCanceled 
        ? `<div class="smart-hint glass-inset" style="color:var(--danger);"><i class="ri-close-circle-line" style="color:var(--danger);"></i> تم إلغاء هذا الطلب</div>`
        : `<div class="status-steps">
            ${stepsMeta.map((st, idx) => `
              <div class="step-box ${idx <= currentIdx ? "done" : ""}">
                <i class="${st.icon}"></i>
                <span>${st.label}</span>
              </div>
            `).join("")}
          </div>`;

      const itemsLine = (order.items || []).map(i => `• ${i.name} (الكمية: ${i.qty})`).join("<br>");

      const accordion = document.createElement("div");
      accordion.className = `cust-invoice-accordion ${index === 0 ? "open" : ""}`;

      accordion.innerHTML = `
        <button type="button" class="cust-inv-header">
          <div class="cust-inv-right">
            <div class="cust-arrow"><i class="ri-arrow-down-s-line"></i></div>
            <div>
              <strong style="font-size:1.02rem; color:var(--espresso);">فاتورة #${order.invoiceNumber}</strong>
              <div class="hint-text">${order.totalAmount} ريال — ${new Date(order.createdAt || Date.now()).toLocaleDateString("ar-SA")}</div>
            </div>
          </div>
          <span class="status-pill ${isCanceled ? 'canceled' : ''}">
            <i class="${isCanceled ? 'ri-close-circle-line' : 'ri-loader-2-line'}"></i>
            <span>${order.status}</span>
          </span>
        </button>

        <div class="cust-inv-body">
          ${stepsHtml}
          <div class="glass-inset" style="padding:12px; font-size:0.88rem; line-height:1.7;">
            <strong>تفاصيل الطلب:</strong><br>
            ${itemsLine}
            <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(30,19,13,0.12); font-weight:800;">
              التوصيل: ${order.deliveryFee} ريال | الإجمالي: ${order.totalAmount} ريال
            </div>
          </div>
        </div>
      `;

      accordion.querySelector(".cust-inv-header").addEventListener("click", () => {
        accordion.classList.toggle("open");
      });

      container.appendChild(accordion);
    });
  });
}

document.getElementById("searchInvoiceBtn").addEventListener("click", () => {
  const val = document.getElementById("searchInvoiceInput").value.trim();
  listenToCustomerInvoices(val);
});

// 9. فتح وإغلاق النوافذ
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

// إغلاق أي نافذة عند الضغط خارج البطاقة الزجاجية
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
    }
  });
});

// تشغيل المتجر
listenToStoreSettings();
listenToProducts();
updateCartUI();
