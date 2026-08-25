// اجرا: node scripts/fuzz-order-lifecycle.cjs [تعدادِ سفارش] [تعدادِ قدم به ازای هر سفارش]
// پیش‌نیاز: سرور dev روی پورت 3001 بالا باشه (npm run dev -- -p 3001)
//
// فازرِ state-machine برای چرخه‌ی سفارش خارجی (ترندیول). برخلاف تستِ
// exhaustive روی توابع خالص (tests/unit/orderStateSpace.exhaustive.test.ts)
// که فقط منطقِ تصمیم‌گیری رو چک می‌کنه، این اسکریپت روی روت‌های واقعی و DB
// واقعی کار می‌کنه -- یعنی side effectهای واقعی (رفاند، تراکنشِ کیف‌پول،
// نوتیفیکیشن) رو هم می‌بینه. چون cartesianِ خامِ کل فضای حالت غیرممکنه (اکثر
// ترکیب‌ها reachable نیستن)، به‌جاش از هر سفارش یه دنباله‌ی تصادفی از
// اقدام‌های «مجاز به نظر رسیدن» رو امتحان می‌کنه (سرور خودش مرجعِ نهاییِ
// مجاز بودنه -- رد شدن با ۴۰۰ خطا نیست، فقط یعنی اون قدم اونجا معنی نداشت)،
// و بعد از هر قدم چندتا اینورینتِ کلی رو چک می‌کنه. هر اینورینتی که نقض بشه
// یعنی یه باگِ واقعی پیدا شده.
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
const { randomUUID } = require("crypto");

const prisma = new PrismaClient();
const BASE = "http://localhost:3001";
const SECRET = process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production-CHANGE-ME";
const SALT = "authjs.session-token";
const RUN_TAG = `fuzz-${Date.now()}`;

const N_ORDERS = Number(process.argv[2]) || 15;
const N_STEPS = Number(process.argv[3]) || 12;

const mintedSids = [];
const createdUserIds = [];
const createdOrderIds = [];
const violations = [];
const terminalSeen = new Map(); // orderId -> اولین statusِ نهایی‌ای که دیدیم

function log(...args) {
  console.log(...args);
}

async function mintCookie(userId, role) {
  const sid = randomUUID();
  await prisma.userSession.create({ data: { userId, sid, deviceId: randomUUID(), isCurrent: true } });
  mintedSids.push(sid);
  const jwt = await encode({ token: { id: userId, role, sid, ver: "initial", sub: userId }, secret: SECRET, salt: SALT });
  return `authjs.session-token=${jwt}`;
}

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TERMINAL_ITEM_STATUSES = new Set(["CANCELLED", "RECEIVED", "LOST", "WRONG_SIZE", "WRONG_COLOR", "ISSUE_OTHER"]);

async function loadState(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shippingPayment: true, cancellationRequest: true, returnRequest: true },
  });
  return order;
}

async function walletBalance(userId) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}

function record(orderId, action, message) {
  violations.push({ orderId, action, message });
  log(`  ⚠️  نقضِ اینورینت [${action}]: ${message}`);
}

async function checkInvariants(orderId, action) {
  const order = await loadState(orderId);
  if (!order) return;
  const balance = await walletBalance(order.userId);
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");

  if (balance < 0) {
    record(orderId, action, `موجودیِ کیف‌پول منفی شد: ${balance}`);
  }

  if (["CANCELLED", "RETURNED"].includes(order.status)) {
    const prev = terminalSeen.get(orderId);
    if (prev && prev !== order.status) {
      record(orderId, action, `سفارش از حالتِ نهاییِ ${prev} به ${order.status} تغییر کرد`);
    }
    terminalSeen.set(orderId, order.status);
  } else {
    const prev = terminalSeen.get(orderId);
    if (prev) {
      record(orderId, action, `سفارشی که قبلاً ${prev} بود، حالا ${order.status} شده (نهایی نبوده!)`);
    }
  }

  if (["SHIPPED", "DELIVERED"].includes(order.status) && hasExternalItems) {
    for (const item of order.items) {
      if (item.source === "TRENDYOL" && !TERMINAL_ITEM_STATUSES.has(item.purchaseStatus)) {
        record(
          orderId,
          action,
          `سفارش ${order.status}ه ولی قلم «${item.title}» هنوز purchaseStatus=${item.purchaseStatus} (نه یه وضعیتِ نهایی)`
        );
      }
    }
  }

  if (order.cancellationRequest?.status === "APPROVED" && order.status !== "CANCELLED") {
    record(orderId, action, `cancellationRequest تأیید شده ولی order.status=${order.status} (باید CANCELLED باشه)`);
  }
  if (order.returnRequest?.status === "REFUNDED" && order.status !== "RETURNED") {
    record(orderId, action, `returnRequest به REFUNDED رسیده ولی order.status=${order.status} (باید RETURNED باشه)`);
  }
  if (order.shippingPayment?.status === "PAID" && order.paymentStatus !== "PAID") {
    record(orderId, action, `shippingPayment.status=PAID ولی order.paymentStatus=${order.paymentStatus}`);
  }
}

async function makeOrder(adminCookie, bankCardId) {
  const customer = await prisma.user.create({
    data: { email: `${RUN_TAG}-${randomUUID()}@test.local`, name: "مشتری فازر", role: "CUSTOMER" },
  });
  createdUserIds.push(customer.id);
  const customerCookie = await mintCookie(customer.id, "CUSTOMER");

  const externalCount = pick([1, 1, 2]); // بیشتر تک‌قلمی، گاهی دو قلمی (برای پوششِ حالتِ mixed/چندقلمی)
  const includeMazon = Math.random() < 0.35;

  const items = [];
  for (let i = 0; i < externalCount; i++) {
    items.push({ source: "TRENDYOL", externalId: `${RUN_TAG}-ext-${i}`, title: `کالای خارجی ${i}`, price: 500000, quantity: 1 });
  }
  if (includeMazon) {
    items.push({ source: "MAZON", title: "کالای مزون", price: 200000, quantity: 1 });
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      status: "PENDING",
      paymentStatus: "PENDING",
      addressSnapshot: "آدرس تست فازر",
      subtotal,
      total: subtotal,
      items: { create: items },
    },
    include: { items: true },
  });
  createdOrderIds.push(order.id);

  return { order, customerCookie, customerId: customer.id };
}

function buildActions(adminCookie, customerCookie, bankCardId) {
  return [
    {
      name: "adminOpensOrder(PENDING→PROCESSING)",
      canRun: (o) => o.status === "PENDING",
      run: async (o) => {
        await prisma.order.update({ where: { id: o.id }, data: { status: "PROCESSING" } });
      },
    },
    {
      name: "finalizeShipping",
      canRun: (o) => o.paymentStatus === "PENDING" && o.itemsNegotiationStatus !== "AWAITING_CUSTOMER_REVIEW" && o.status !== "PENDING",
      run: (o) => call("POST", `/api/admin/orders/${o.id}/finalize-shipping`, adminCookie, { bankCardId }),
    },
    {
      name: "itemReceiptUploaded(bypass)",
      canRun: (o) => o.paymentStatus === "AWAITING_PAYMENT",
      run: (o) => prisma.order.update({ where: { id: o.id }, data: { paymentStatus: "AWAITING_VERIFICATION", receiptImage: "sim.png", receiptSubmittedAt: new Date() } }),
    },
    {
      name: "verifyPayment",
      canRun: (o) => o.paymentStatus === "AWAITING_VERIFICATION",
      run: (o) => {
        const action = pick(["approve", "approve", "reject"]); // بیشتر approve تا سفارش جلو بره
        const body = action === "reject" ? { action, reason: "تست فازر" } : { action };
        return call("POST", `/api/admin/orders/${o.id}/verify-payment`, adminCookie, body);
      },
    },
    {
      name: "purchaseItem",
      canRun: (o) => o.paymentStatus === "PAID" && o.items.some((i) => i.source === "TRENDYOL" && i.purchaseStatus === "PENDING"),
      run: (o) => {
        const item = pick(o.items.filter((i) => i.source === "TRENDYOL" && i.purchaseStatus === "PENDING"));
        return call("POST", `/api/admin/orders/${o.id}/items/${item.id}/purchase`, adminCookie, {
          tag: `${RUN_TAG}-tag-${randomUUID()}`,
          actualPrice: item.price + pick([-10000, 0, 10000]),
        });
      },
    },
    {
      name: "cancelPurchaseItem",
      canRun: (o) => o.paymentStatus === "PAID" && o.items.some((i) => i.source === "TRENDYOL" && i.purchaseStatus === "PENDING"),
      run: (o) => {
        const item = pick(o.items.filter((i) => i.source === "TRENDYOL" && i.purchaseStatus === "PENDING"));
        return call("POST", `/api/admin/orders/${o.id}/items/${item.id}/cancel-purchase`, adminCookie, { reason: "ناموجود بود (تست فازر)" });
      },
    },
    {
      name: "resolveItem",
      canRun: (o) => o.items.some((i) => i.purchaseStatus === "PURCHASED"),
      run: (o) => {
        const item = pick(o.items.filter((i) => i.purchaseStatus === "PURCHASED"));
        const outcome = pick(["RECEIVED", "RECEIVED", "RECEIVED", "LOST", "WRONG_SIZE", "WRONG_COLOR", "ISSUE_OTHER"]);
        return call("POST", `/api/admin/orders/${o.id}/items/${item.id}/resolve`, adminCookie, { outcome });
      },
    },
    {
      name: "mismatchDecision",
      canRun: (o) => o.items.some((i) => i.purchaseStatus === "AWAITING_CUSTOMER_DECISION"),
      run: (o) => {
        const item = pick(o.items.filter((i) => i.purchaseStatus === "AWAITING_CUSTOMER_DECISION"));
        const decision = pick(["KEEP", "REFUND"]);
        return call("POST", `/api/orders/${o.id}/items/${item.id}/mismatch-decision`, customerCookie, { decision });
      },
    },
    {
      name: "setShippingCost",
      canRun: (o) =>
        o.items.some((i) => i.source === "TRENDYOL") &&
        o.paymentStatus === "PAID" &&
        (!o.shippingPayment || o.shippingPayment.status === "FAILED"),
      run: (o) => call("POST", `/api/admin/orders/${o.id}/set-shipping-cost`, adminCookie, { shippingCost: 30000, cargoCost: 20000, bankCardId }),
    },
    {
      name: "shippingReceiptUploaded(bypass)",
      canRun: (o) => o.shippingPayment?.status === "AWAITING_PAYMENT",
      run: (o) => prisma.shippingPayment.update({ where: { orderId: o.id }, data: { status: "AWAITING_VERIFICATION", receiptImage: "sim.png", receiptSubmittedAt: new Date() } }),
    },
    {
      name: "verifyShippingPayment",
      canRun: (o) => o.shippingPayment?.status === "AWAITING_VERIFICATION",
      run: (o) => {
        const action = pick(["approve", "approve", "reject"]);
        const body = action === "reject" ? { action, reason: "تست فازر" } : { action };
        return call("POST", `/api/admin/orders/${o.id}/verify-shipping-payment`, adminCookie, body);
      },
    },
    {
      name: "markShipped",
      canRun: (o) => o.status === "PROCESSING" && o.paymentStatus === "PAID" && (o.shippingPayment ? o.shippingPayment.status === "PAID" : true),
      run: (o) => call("PATCH", `/api/admin/orders/${o.id}`, adminCookie, { status: "SHIPPED", trackingCodes: [`TRACK-${randomUUID().slice(0, 8)}`] }),
    },
    {
      name: "markDelivered",
      canRun: (o) => o.status === "SHIPPED",
      run: (o) => call("PATCH", `/api/admin/orders/${o.id}`, adminCookie, { status: "DELIVERED" }),
    },
    {
      name: "markReturnedToSender",
      canRun: (o) => o.status === "SHIPPED",
      run: (o) => call("POST", `/api/admin/orders/${o.id}/mark-returned-to-sender`, adminCookie, { reason: "پیک برنگردوند (تست فازر)" }),
    },
    {
      name: "customerCancelRequest",
      canRun: (o) => o.items.some((i) => i.source === "TRENDYOL") && !o.cancellationRequest,
      run: (o) => call("POST", `/api/orders/${o.id}/cancel-request`, customerCookie, { reason: "پشیمون شدم (تست فازر)" }),
    },
    {
      name: "adminCancelRequestDecision",
      canRun: (o) => o.cancellationRequest?.status === "PENDING",
      run: (o) => {
        const action = pick(["approve", "approve", "reject"]);
        return call("PATCH", `/api/admin/orders/${o.id}/cancel-request`, adminCookie, { action });
      },
    },
    {
      name: "customerDirectCancel",
      canRun: (o) => !o.items.some((i) => i.source === "TRENDYOL"),
      run: (o) => call("PATCH", `/api/orders/${o.id}`, customerCookie, { action: "cancel", reason: "تست فازر" }),
    },
    {
      name: "customerReturnRequest",
      canRun: (o) => o.status === "DELIVERED" && !o.returnRequest,
      run: (o) =>
        call("POST", `/api/orders/${o.id}/return`, customerCookie, {
          items: o.items.map((i) => ({ orderItemId: i.id, reason: "CHANGED_MIND" })),
        }),
    },
    {
      name: "adminReturnDecision",
      canRun: (o) => o.returnRequest && o.returnRequest.status !== "REFUNDED",
      run: (o) => {
        const status = pick(["APPROVED", "ITEM_RECEIVED", "REFUNDED", "REJECTED"]);
        return call("PATCH", `/api/admin/returns/${o.returnRequest.id}`, adminCookie, { status });
      },
    },
  ];
}

async function fuzzOrder(adminCookie, bankCardId, index) {
  const { order, customerCookie } = await makeOrder(adminCookie, bankCardId);
  const actions = buildActions(adminCookie, customerCookie, bankCardId);
  const trail = [];

  for (let step = 0; step < N_STEPS; step++) {
    const state = await loadState(order.id);
    const applicable = actions.filter((a) => {
      try {
        return a.canRun(state);
      } catch {
        return false;
      }
    });
    if (applicable.length === 0) break;
    const action = pick(applicable);
    try {
      await action.run(state);
    } catch (e) {
      trail.push(`${action.name} → EXCEPTION: ${e.message}`);
      continue;
    }
    trail.push(action.name);
    await checkInvariants(order.id, action.name);
  }

  log(`سفارش ${index + 1}/${N_ORDERS} (${order.id.slice(-8)}): ${trail.length} قدم -- ${trail.join(" → ")}`);
}

async function cleanup() {
  log("\n--- پاکسازی ---");
  for (const orderId of createdOrderIds) {
    await prisma.shippingPayment.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.orderPaymentEvent.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.orderStatusHistory.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.cancellationRequest.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.returnRequestItem.deleteMany({ where: { returnRequest: { orderId } } }).catch(() => {});
    await prisma.returnRequest.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.orderItem.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
  }
  for (const userId of createdUserIds) {
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.walletTransaction.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.wallet.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.userSession.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
  for (const sid of mintedSids) {
    await prisma.userSession.deleteMany({ where: { sid } }).catch(() => {});
  }
  log(`${createdOrderIds.length} سفارش و ${createdUserIds.length} کاربرِ تستی پاک شد.`);
}

async function main() {
  const ping = await fetch(BASE + "/").catch(() => null);
  if (!ping) {
    console.error(`سرور روی ${BASE} در دسترس نیست -- اول dev server رو بالا بیار.`);
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("هیچ کاربرِ ADMIN توی دیتابیس پیدا نشد");
  const bankCard = await prisma.bankCard.findFirst({ where: { isActive: true } });
  if (!bankCard) throw new Error("هیچ کارتِ بانکیِ فعالی پیدا نشد");

  const adminCookie = await mintCookie(admin.id, admin.role);

  log(`شروعِ فازر: ${N_ORDERS} سفارش × حداکثر ${N_STEPS} قدم\n`);
  for (let i = 0; i < N_ORDERS; i++) {
    await fuzzOrder(adminCookie, bankCard.id, i);
  }

  log(`\n=== نتیجه ===`);
  log(`${createdOrderIds.length} سفارش شبیه‌سازی شد.`);
  if (violations.length === 0) {
    log("✅ هیچ نقضِ اینورینتی پیدا نشد.");
  } else {
    log(`❌ ${violations.length} نقضِ اینورینت پیدا شد:`);
    for (const v of violations) {
      log(`  - سفارش ${v.orderId.slice(-8)} | اقدام ${v.action} | ${v.message}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("خطا:", e);
    violations.push({ orderId: "-", action: "-", message: `اجرای فازر با خطا متوقف شد: ${e.message}` });
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(violations.length > 0 ? 1 : 0);
  });
