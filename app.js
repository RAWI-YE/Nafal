import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// إعدادات قاعدة البيانات (إذا غيرتها مستقبلاً من غرفة العمليات، انسخ الكود المولد هناك وضعه هنا)
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

// حالة المتجر العامة
let storeSettings = {
  storeName: "NAFAL Specialty Roast | نفال للقهوة المختصة",
  bannerText: "المتجر يوصل لداخل شرورة فقط 🚚",
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
let searchQuery = "";
let cart = JSON.parse(localStorage.getItem("nafal_cart") || "[]");
let savedOrderIds = JSON.parse(localStorage.getItem("nafal_my_orders") || "[]");
let activeInvoiceUnsubscribe = null;

// دالة الإشعارات السريعة
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2800);
}

// تنسيق رقم الواتساب ليقبل الأرقام السعودية تلقائياً
function formatWhatsappNumber(rawPhone) {
  let cleaned = (rawPhone || "").replace(/[^0-9]/g, "");
  if (cleaned.startsWith("05")) {
    cleaned = "966" + cleaned.slice(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  return cleaned;
}

// 1. الاستماع المباشر لإعدادات غرفة العمليات (الشريط العلوي، العروض، الواتساب، الأقسام)
function listenToStoreSettings() {
  onSnapshot(doc(db, "nafal_settings", "storeConfig"), (snap) => {
    if (snap.exists()) {
      storeSettings = { ...storeSettings, ...snap.data() };
    }
    applySettingsToUI();
    renderCart();
  });
}

function applySettingsToUI() {
  document.getElementById("topBannerText").textContent =
    storeSettings.bannerText || "المتجر يوصل لداخل شرورة فقط 🚚";

  const promoStrip = document.getElementById("promoStrip");
  const promoText = document.getElementById("promoStripText");
  if (storeSettings.promoMessage && storeSettings.promoMessage.trim() !== "") {
    promoText.textContent = storeSettings.promoMessage;
    promoStrip.classList.remove("hidden");
  } else {
    promoStrip.classList.add("hidden");
  }

  // تحديث روابط سناب شات وتيك توك
  const snapLinks = [
    document.getElementById("snapchatHeaderLink"),
    document.getElementById("snapchatFooterLink")
  ];
  snapLinks.forEach((el) => {
    if (storeSettings.snapchatUrl) {
      el.href = storeSettings.snapchatUrl;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });

  const tiktokLinks = [
    document.getElementById("tiktokHeaderLink"),
    document.getElementById("tiktokFooterLink")
  ];
  tiktokLinks.forEach((el) => {
    if (storeSettings.tiktokUrl) {
      el.href = storeSettings.tiktokUrl;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });

  renderCategoriesBar();
}

function renderCategoriesBar() {
  const bar = document.getElementById("categoriesBar");
  bar.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `cat-pill ${selectedCategory === "all" ? "active" : ""}`;
  allBtn.textContent = "كل المنتجات";
  allBtn.addEventListener("click", () => {
    selectedCategory = "all";
    renderCategoriesBar();
    renderProducts();
  });
  bar.appendChild(allBtn);

  (storeSettings.categories || []).forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = `cat-pill ${selectedCategory === cat ? "active" : ""}`;
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      selectedCategory = cat;
      renderCategoriesBar();
      renderProducts();
    });
    bar.appendChild(btn);
  });
}

// 2. الاستماع المباشر للمنتجات والمحاصيل
function listenToProducts() {
  const q = query(collection(db, "nafal_products"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    allProducts = [];
    snapshot.forEach((docSnap) => {
      allProducts.push({ id: docSnap.id, ...docSnap.data() });
    });

    syncCartWithLatestProducts();
    renderProducts();
    renderCart();
  });
}

function syncCartWithLatestProducts() {
  cart = cart
    .map((item) => {
      const liveProd = allProducts.find((p) => p.id === item.id);
      if (!liveProd || liveProd.stock <= 0) return null;
      return {
        id: liveProd.id,
        name: liveProd.name,
        price: Number(liveProd.price),
        freeDelivery: !!liveProd.freeDelivery,
        maxStock: Number(liveProd.stock),
        qty: Math.min(item.qty, Number(liveProd.stock))
      };
    })
    .filter(Boolean);
  saveCart();
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  const filtered = allProducts.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      (p.name && p.name.toLowerCase().includes(searchQuery)) ||
      (p.description && p.description.toLowerCase().includes(searchQuery));
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="loading-state">لا توجد منتجات مطابقة حالياً ☕</div>`;
    return;
  }

  filtered.forEach((prod) => {
    const inCart = cart.find((c) => c.id === prod.id);
    const outOfStock = Number(prod.stock) <= 0;

    const card = document.createElement("article");
    card.className = "product-card";

    card.innerHTML = `
      <div class="prod-img-wrap">
        <img src="${prod.imageUrl}" alt="${prod.name}" loading="lazy">
        <span class="badge-top-right">${prod.category || "قهوة مختصة"}</span>
        ${prod.freeDelivery ? `<span class="badge-free-del">🚚 معفي من التوصيل</span>` : ""}
      </div>
      <div class="prod-body">
        <h3 class="prod-title">${prod.name}</h3>
        <p class="prod-desc">${prod.description || "محصول مختص محمص بعناية فائقة."}</p>
        <div class="prod-footer">
          <div class="prod-price">${prod.price} <small>ريال</small></div>
          <div class="prod-action-slot"></div>
        </div>
      </div>
    `;

    const actionSlot = card.querySelector(".prod-action-slot");

    if (outOfStock) {
      const btn = document.createElement("button");
      btn.className = "btn-add-cart";
      btn.disabled = true;
      btn.textContent = "نفدت الكمية";
      actionSlot.appendChild(btn);
    } else if (inCart) {
      const qtyBox = document.createElement("div");
      qtyBox.className = "qty-inline";
      qtyBox.innerHTML = `
        <button type="button" class="inc-btn">+</button>
        <span>${inCart.qty}</span>
        <button type="button" class="dec-btn">-</button>
      `;
      qtyBox.querySelector(".inc-btn").addEventListener("click", () => updateCartQty(prod, 1));
      qtyBox.querySelector(".dec-btn").addEventListener("click", () => updateCartQty(prod, -1));
      actionSlot.appendChild(qtyBox);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn-add-cart";
      btn.textContent = "إضافة للسلة +";
      btn.addEventListener("click", () => updateCartQty(prod, 1));
      actionSlot.appendChild(btn);
    }

    grid.appendChild(card);
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderProducts();
});

// 3. إدارة السلة وحساب التوصيل الذكي تلقائياً
function updateCartQty(prod, delta) {
  const existing = cart.find((c) => c.id === prod.id);
  if (existing) {
    const nextQty = existing.qty + delta;
    if (nextQty <= 0) {
      cart = cart.filter((c) => c.id !== prod.id);
    } else if (nextQty <= Number(prod.stock)) {
      existing.qty = nextQty;
    } else {
      showToast(`الكمية المتاحة في المخزون ${prod.stock} فقط`);
      return;
    }
  } else if (delta > 0) {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: Number(prod.price),
      freeDelivery: !!prod.freeDelivery,
      maxStock: Number(prod.stock),
      qty: 1
    });
    showToast("تمت الإضافة إلى السلة ☕");
  }

  saveCart();
  renderProducts();
  renderCart();
}

function saveCart() {
  localStorage.setItem("nafal_cart", JSON.stringify(cart));
}

function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (cart.length === 0) {
    return { subtotal: 0, deliveryFee: 0, total: 0, offerHint: "", progressPct: 0 };
  }

  // إذا كانت جميع المنتجات في السلة معفية من رسوم التوصيل
  const allExempt = cart.every((item) => item.freeDelivery === true);
  if (allExempt) {
    return {
      subtotal,
      deliveryFee: 0,
      total: subtotal,
      offerHint: "🎉 منتجاتك المختارة مشمولة بالتوصيل المجاني!",
      progressPct: 100
    };
  }

  let deliveryFee = Number(storeSettings.baseDeliveryFee ?? 15);
  let offerHint = "";
  let progressPct = 0;

  if (storeSettings.enableSmartOffers) {
    // ترتيب شرائح العروض تصاعدياً لضمان الحساب السليم مهما كانت القيم المدخلة
    const tiers = [
      {
        threshold: Number(storeSettings.tier1Threshold || 0),
        fee: Number(storeSettings.tier1Fee ?? deliveryFee)
      },
      {
        threshold: Number(storeSettings.tier2Threshold || 0),
        fee: Number(storeSettings.tier2Fee ?? 0)
      }
    ]
      .filter((t) => t.threshold > 0)
      .sort((a, b) => a.threshold - b.threshold);

    if (tiers.length === 1) {
      const t1 = tiers[0];
      if (subtotal >= t1.threshold) {
        deliveryFee = t1.fee;
        progressPct = 100;
        offerHint =
          t1.fee === 0
            ? "🎉 مبروك! حصلت على توصيل مجاني لطلبك!"
            : `✨ رائع! تم تخفيض التوصيل إلى ${t1.fee} ريال فقط!`;
      } else {
        const diff = t1.threshold - subtotal;
        progressPct = Math.min(100, Math.round((subtotal / t1.threshold) * 100));
        offerHint =
          t1.fee === 0
            ? `أضف بقيمة ${diff} ريال للحصول على توصيل مجاني!`
            : `أضف بقيمة ${diff} ريال ليصبح التوصيل بـ ${t1.fee} ريال فقط!`;
      }
    } else if (tiers.length >= 2) {
      const [t1, t2] = tiers;
      if (subtotal >= t2.threshold) {
        deliveryFee = t2.fee;
        progressPct = 100;
        offerHint =
          t2.fee === 0
            ? "🎉 مبروك! طلبك مؤهل للتوصيل المجاني بالكامل!"
            : `🎉 مبروك! حصلت على أفضل عرض توصيل (${t2.fee} ريال)!`;
      } else if (subtotal >= t1.threshold) {
        deliveryFee = t1.fee;
        const diff = t2.threshold - subtotal;
        progressPct = Math.min(100, Math.round((subtotal / t2.threshold) * 100));
        const nextReward = t2.fee === 0 ? "توصيل مجاني" : `توصيل بـ ${t2.fee} ريال`;
        offerHint = `✨ التوصيل الآن بـ ${t1.fee} ريال! أضف ${diff} ريال لتحصل على ${nextReward}!`;
      } else {
        const diff = t1.threshold - subtotal;
        progressPct = Math.min(100, Math.round((subtotal / t1.threshold) * 100));
        const firstReward = t1.fee === 0 ? "توصيل مجاني" : `توصيل بـ ${t1.fee} ريال فقط`;
        offerHint = `أضف منتجات بقيمة ${diff} ريال لتحصل على ${firstReward}!`;
      }
    }
  }

  return {
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    offerHint,
    progressPct
  };
}

function renderCart() {
  const totalCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const { subtotal, deliveryFee, total, offerHint, progressPct } = calculateTotals();

  document.getElementById("headerCartCount").textContent = totalCount;
  document.getElementById("floatingCartCount").textContent = totalCount;
  document.getElementById("floatingCartTotal").textContent = `${total} ريال`;

  const floatingBar = document.getElementById("floatingCartBar");
  if (totalCount > 0) {
    floatingBar.classList.remove("hidden");
  } else {
    floatingBar.classList.add("hidden");
  }

  const emptyMsg = document.getElementById("emptyCartMsg");
  const checkoutSection = document.getElementById("cartCheckoutSection");
  const smartOfferBar = document.getElementById("smartOfferBar");

  if (cart.length === 0) {
    emptyMsg.classList.remove("hidden");
    checkoutSection.classList.add("hidden");
    smartOfferBar.classList.add("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");
  checkoutSection.classList.remove("hidden");

  if (offerHint) {
    smartOfferBar.classList.remove("hidden");
    document.getElementById("smartOfferText").textContent = offerHint;
    document.getElementById("smartOfferFill").style.width = `${progressPct}%`;
  } else {
    smartOfferBar.classList.add("hidden");
  }

  const container = document.getElementById("cartItemsContainer");
  container.innerHTML = "";

  cart.forEach((item) => {
    const prodRef = allProducts.find((p) => p.id === item.id) || {
      id: item.id,
      name: item.name,
      price: item.price,
      stock: item.maxStock
    };

    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span>${item.price} ريال × ${item.qty} = ${item.price * item.qty} ريال</span>
      </div>
      <div class="qty-inline">
        <button type="button" class="inc">+</button>
        <span>${item.qty}</span>
        <button type="button" class="dec">-</button>
      </div>
    `;

    row.querySelector(".inc").addEventListener("click", () => updateCartQty(prodRef, 1));
    row.querySelector(".dec").addEventListener("click", () => updateCartQty(prodRef, -1));
    container.appendChild(row);
  });

  document.getElementById("summarySubtotal").textContent = `${subtotal} ريال`;
  document.getElementById("summaryDelivery").textContent =
    deliveryFee === 0 ? "مجاني" : `${deliveryFee} ريال`;
  document.getElementById("summaryTotal").textContent = `${total} ريال`;
}

// فتح وإغلاق النوافذ
const cartModal = document.getElementById("cartModal");
document.getElementById("openCartBtn").addEventListener("click", () => cartModal.classList.remove("hidden"));
document.getElementById("floatingCartBar").addEventListener("click", () => cartModal.classList.remove("hidden"));
document.getElementById("closeCartBtn").addEventListener("click", () => cartModal.classList.add("hidden"));

// 4. تحديد موقع العميل عبر الـ GPS
document.getElementById("getGpsBtn").addEventListener("click", () => {
  const gpsBtn = document.getElementById("getGpsBtn");
  const gpsHint = document.getElementById("gpsStatusText");

  if (!navigator.geolocation) {
    gpsHint.textContent = "❌ متصفحك لا يدعم تحديد الموقع التلقائي.";
    return;
  }

  gpsBtn.textContent = "⏳ جاري التقاط موقعك عبر الأقمار الصناعية...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
      document.getElementById("custGpsUrl").value = mapUrl;
      gpsBtn.textContent = "✅ تم تحديد موقعك الجغرافي بنجاح";
      gpsBtn.classList.add("captured");
      gpsHint.textContent = "تم حفظ رابط خريطة موقعك لإرساله مع الفاتورة.";
    },
    () => {
      gpsBtn.textContent = "📍 إعادة محاولة تحديد الموقع (GPS)";
      gpsHint.textContent = "⚠️ تعذر تحديد الموقع، تأكد من تفعيل الموقع (Location) في جوالك وإعطاء الإذن للمتصفح.";
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
});

// 5. إنشاء الفاتورة وحفظها في القاعدة وتوليد رقم عشوائي مختصر
function generateInvoiceCode() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `NF-${randomNum}`;
}

document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) return;

  const gpsUrl = document.getElementById("custGpsUrl").value.trim();
  if (!gpsUrl) {
    showToast("يرجى الضغط على زر تحديد موقعك (GPS) أولاً 📍");
    return;
  }

  const submitBtn = document.getElementById("createInvoiceBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "⏳ جاري إصدار الفاتورة...";

  const customerName = document.getElementById("custName").value.trim();
  const customerPhone = document.getElementById("custPhone").value.trim();
  const customerEmail = document.getElementById("custEmail").value.trim();
  const customerAddress = document.getElementById("custAddress").value.trim();
  const { subtotal, deliveryFee, total } = calculateTotals();
  const invoiceNumber = generateInvoiceCode();

  const orderPayload = {
    invoiceNumber,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    gpsLocation: gpsUrl,
    items: cart.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      freeDelivery: i.freeDelivery
    })),
    subtotal,
    deliveryFee,
    totalAmount: total,
    status: "جديد - قيد المراجعة",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  try {
    const docRef = await addDoc(collection(db, "nafal_orders"), orderPayload);

    // خصم الكمية المطلوبة من المخزون تلقائياً
    for (const item of cart) {
      const liveProd = allProducts.find((p) => p.id === item.id);
      if (liveProd) {
        const newStock = Math.max(0, Number(liveProd.stock) - item.qty);
        updateDoc(doc(db, "nafal_products", item.id), { stock: newStock }).catch(() => {});
      }
    }

    // حفظ الفاتورة في سجل العميل على جهازه
    savedOrderIds.unshift(docRef.id);
    savedOrderIds = [...new Set(savedOrderIds)];
    localStorage.setItem("nafal_my_orders", JSON.stringify(savedOrderIds));
    updateMyOrdersBadge();

    // تفريغ السلة بعد إصدار الفاتورة
    cart = [];
    saveCart();
    renderCart();
    renderProducts();
    document.getElementById("checkoutForm").reset();
    document.getElementById("custGpsUrl").value = "";
    const gpsBtn = document.getElementById("getGpsBtn");
    gpsBtn.textContent = "📍 اضغط لتحديد موقعي الحالي (GPS)";
    gpsBtn.classList.remove("captured");

    cartModal.classList.add("hidden");
    openLiveInvoiceModal(docRef.id);
    showToast("تم إنشاء فاتورتك بنجاح! أكدها الآن عبر واتساب");
  } catch (error) {
    console.error("Create Order Error:", error);
    showToast("حدث خطأ أثناء إنشاء الفاتورة، حاول مرة أخرى");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "إنشاء الفاتورة ومتابعة التأكيد";
  }
});

// 6. عرض الفاتورة الحية للعميل ومتابعة حالتها لحظياً + حقن الواتساب المختصر
const invoiceModal = document.getElementById("invoiceModal");
document.getElementById("closeInvoiceBtn").addEventListener("click", () => {
  invoiceModal.classList.add("hidden");
  if (activeInvoiceUnsubscribe) {
    activeInvoiceUnsubscribe();
    activeInvoiceUnsubscribe = null;
  }
});

function openLiveInvoiceModal(orderDocId) {
  if (activeInvoiceUnsubscribe) {
    activeInvoiceUnsubscribe();
  }

  invoiceModal.classList.remove("hidden");

  activeInvoiceUnsubscribe = onSnapshot(doc(db, "nafal_orders", orderDocId), (snap) => {
    if (!snap.exists()) return;
    const order = snap.data();

    document.getElementById("invNumberDisplay").textContent = `#${order.invoiceNumber}`;
    document.getElementById("invDateDisplay").textContent = new Date(
      order.createdAt
    ).toLocaleString("ar-SA");
    document.getElementById("invStatusBadge").textContent = order.status;

    updateTrackerVisuals(order.status);

    document.getElementById("invCustomerInfo").innerHTML = `
      <strong>العميل:</strong> ${order.customerName} (${order.customerPhone})<br>
      ${order.customerEmail ? `<strong>البريد:</strong> ${order.customerEmail}<br>` : ""}
      <strong>العنوان بشرورة:</strong> ${order.customerAddress}<br>
      <a href="${order.gpsLocation}" target="_blank" style="color: var(--caramel-dark); font-weight: 700;">📍 معاينة الموقع المرفق (GPS)</a>
    `;

    document.getElementById("invItemsList").innerHTML = (order.items || [])
      .map((i) => `<div>• ${i.name} — <strong>${i.qty} × ${i.price} ريال</strong></div>`)
      .join("");

    document.getElementById("invSubtotal").textContent = `${order.subtotal ?? order.totalAmount} ريال`;
    document.getElementById("invDelivery").textContent =
      order.deliveryFee === 0 ? "مجاني" : `${order.deliveryFee} ريال`;
    document.getElementById("invTotal").textContent = `${order.totalAmount} ريال`;

    // تجهيز رسالة الواتساب المختصرة والمرتبة
    const storePhone = formatWhatsappNumber(storeSettings.whatsappNumber);
    const compactItems = (order.items || [])
      .map((i) => `${i.qty}× ${i.name}`)
      .join(" + ");

    const waMessage = [
      `☕ *تأكيد طلب | NAFAL Specialty Roast*`,
      `🧾 *فاتورة:* #${order.invoiceNumber}`,
      `👤 *العميل:* ${order.customerName} (${order.customerPhone})`,
      `📦 *الطلب:* ${compactItems}`,
      `🚚 *التوصيل:* ${order.deliveryFee === 0 ? "مجاني" : order.deliveryFee + " ريال"}`,
      `💰 *الإجمالي:* ${order.totalAmount} ريال`,
      `🏠 *الحي:* ${order.customerAddress}`,
      `📍 *الموقع GPS:* ${order.gpsLocation}`
    ].join("\n");

    document.getElementById("confirmWhatsappBtn").href = `https://wa.me/${storePhone}?text=${encodeURIComponent(
      waMessage
    )}`;

    document.getElementById("copyInvBtn").onclick = () => {
      navigator.clipboard.writeText(order.invoiceNumber);
      showToast("تم نسخ رقم الفاتورة");
    };
  });
}

function updateTrackerVisuals(status) {
  const cancelledAlert = document.getElementById("invCancelledAlert");
  const trackerBox = document.getElementById("invTrackerSteps");

  if (status === "ملغي") {
    cancelledAlert.classList.remove("hidden");
    trackerBox.classList.add("hidden");
    return;
  }

  cancelledAlert.classList.add("hidden");
  trackerBox.classList.remove("hidden");

  const statusOrder = [
    "جديد - قيد المراجعة",
    "جاري التحميص والتجهيز",
    "مع المندوب للتوصيل",
    "تم التوصيل"
  ];
  const currentIndex = statusOrder.indexOf(status);

  document.querySelectorAll(".step-item").forEach((el, idx) => {
    el.classList.remove("done", "current");
    if (idx < currentIndex) {
      el.classList.add("done");
    } else if (idx === currentIndex) {
      el.classList.add("current");
    }
  });
}

// 7. نافذة "فواتيري" والبحث برقم الفاتورة أو الجوال
const myOrdersModal = document.getElementById("myOrdersModal");

function updateMyOrdersBadge() {
  const badge = document.getElementById("myOrdersBadge");
  if (savedOrderIds.length > 0) {
    badge.textContent = savedOrderIds.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

document.getElementById("openMyOrdersBtn").addEventListener("click", () => {
  myOrdersModal.classList.remove("hidden");
  loadSavedCustomerOrders();
});

document.getElementById("closeMyOrdersBtn").addEventListener("click", () => {
  myOrdersModal.classList.add("hidden");
});

function loadSavedCustomerOrders() {
  const listEl = document.getElementById("myOrdersList");
  if (savedOrderIds.length === 0) {
    listEl.innerHTML = `<p class="muted-label">لا توجد فواتير محفوظة على جهازك بعد. يمكنك البحث برقم الفاتورة أو رقم جوالك بالأعلى.</p>`;
    return;
  }

  listEl.innerHTML = "";
  savedOrderIds.forEach((docId) => {
    onSnapshot(doc(db, "nafal_orders", docId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      let existingCard = document.getElementById(`saved-${docId}`);
      if (!existingCard) {
        existingCard = document.createElement("div");
        existingCard.id = `saved-${docId}`;
        existingCard.className = "saved-order-card";
        listEl.appendChild(existingCard);
      }

      existingCard.innerHTML = `
        <div>
          <strong>فاتورة #${data.invoiceNumber}</strong>
          <div class="muted-label">${new Date(data.createdAt).toLocaleDateString("ar-SA")} — ${data.totalAmount} ريال</div>
        </div>
        <span class="status-pill">${data.status}</span>
      `;

      existingCard.onclick = () => {
        myOrdersModal.classList.add("hidden");
        openLiveInvoiceModal(docId);
      };
    });
  });
}

document.getElementById("lookupBtn").addEventListener("click", async () => {
  const rawVal = document.getElementById("lookupInput").value.trim().replace(/^#/, "");
  if (!rawVal) return;

  const listEl = document.getElementById("myOrdersList");
  listEl.innerHTML = `<p class="muted-label">⏳ جاري البحث عن الفاتورة...</p>`;

  try {
    const field = rawVal.toUpperCase().startsWith("NF-") ? "invoiceNumber" : "customerPhone";
    const searchVal = field === "invoiceNumber" ? rawVal.toUpperCase() : rawVal;

    const q = query(collection(db, "nafal_orders"), where(field, "==", searchVal));
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = `<p class="muted-label">لم يتم العثور على فواتير مطابقة لهذا الرقم.</p>`;
      return;
    }

    const results = [];
    snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
    results.sort((a, b) => b.createdAt - a.createdAt);

    listEl.innerHTML = "";
    results.forEach((order) => {
      const card = document.createElement("div");
      card.className = "saved-order-card";
      card.innerHTML = `
        <div>
          <strong>فاتورة #${order.invoiceNumber}</strong>
          <div class="muted-label">${order.customerName} — ${order.totalAmount} ريال</div>
        </div>
        <span class="status-pill">${order.status}</span>
      `;
      card.addEventListener("click", () => {
        myOrdersModal.classList.add("hidden");
        openLiveInvoiceModal(order.id);
      });
      listEl.appendChild(card);
    });
  } catch (err) {
    console.error("Lookup Error:", err);
    listEl.innerHTML = `<p class="muted-label">حدث خطأ أثناء البحث.</p>`;
  }
});

// تشغيل المتجر عند الفتح
updateMyOrdersBadge();
listenToStoreSettings();
listenToProducts();
renderCart();
