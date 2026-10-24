/* ============================================================
   boot.js — شاشة الدخول (طالب / دكتور / أدمن) + تشغيل المنصة
   تذكير: هذا تسجيل دخول تجريبي داخل المتصفح، وليس آمنًا.
   ============================================================ */

const Auth = {
    role: "student",

    HINTS: {
        student: "بيانات التجربة — المستخدم: <b>student</b> (أو <b>20230145</b>) · كلمة المرور: <b>1234</b>",
        doctor: "بيانات التجربة — المستخدم: <b>doctor</b> (د. مصطفى كمال — مادة قواعد البيانات) · كلمة المرور: <b>1234</b><br/>دكاترة آخرون: <b>doctor2</b> · <b>doctor3</b> · <b>doctor4</b>",
        admin: "بيانات التجربة — المستخدم: <b>admin</b> · كلمة المرور: <b>1234</b>"
    },
    DEMO: { student: ["student", "1234"], doctor: ["doctor", "1234"], admin: ["admin", "1234"] },
    PLACEHOLDER: {
        student: "اكتب student أو 20230145",
        doctor: "اكتب doctor",
        admin: "اكتب admin"
    },
    LABEL: {
        student: "الرقم الجامعي أو اسم المستخدم",
        doctor: "اسم المستخدم (الدكتور)",
        admin: "اسم المستخدم (الأدمن)"
    },

    setRole(role) {
        this.role = role;
        document.querySelectorAll(".role-tab").forEach((b) => b.classList.toggle("active", b.dataset.role === role));
        $("loginHint").innerHTML = this.HINTS[role];
        $("studentId").placeholder = this.PLACEHOLDER[role];
        $("userLabel").textContent = this.LABEL[role];
        $("loginError").textContent = "";
    },

    enter(user) {
        $("loginView").classList.add("hidden");
        $("portalView").classList.remove("hidden");
        const cfg = ROLES[user.role];
        $("sideRole").textContent = cfg.sub;
        $("welcome").textContent = `أهلاً بك، ${user.name} 👋`;
        let sub = cfg.sub;
        if (user.role === "student") sub = `نظم معلومات الأعمال (BIS) · ${levelName(user.student)}`;
        if (user.role === "doctor") sub = `لوحة الدكتور · ${Store.mySubjects(user).map((s) => s.Subject_Name).join("، ") || "بدون مواد"}`;
        if (user.role === "admin") sub = "لوحة الإدارة · نسخة تجريبية";
        $("welcomeSub").textContent = sub;
        $("avatar").textContent = user.name.charAt(0);
        buildNav(user.role);
        show(cfg.views[0].id);
    },

    logout() {
        Live.clear();
        if (typeof ScanUI !== "undefined") ScanUI.stop();
        UI.closeModal();
        Store.logout();
        CURRENT_VIEW = null;
        $("portalView").classList.add("hidden");
        $("loginView").classList.remove("hidden");
        $("password").value = "";
        this.setRole(this.role);
    }
};

document.querySelectorAll(".role-tab").forEach((b) => (b.onclick = () => Auth.setRole(b.dataset.role)));

$("fillDemoBtn").onclick = () => {
    const [u, p] = Auth.DEMO[Auth.role];
    $("studentId").value = u;
    $("password").value = p;
};

$("resetDemoLogin").onclick = () => {
    UI.confirm("سيتم حذف كل تعديلات التجربة (الحضور، الدرجات، الطلاب المضافين...) والرجوع للبيانات الابتدائية. متأكد؟", () => {
        Store.reset();
        UI.toast("تمت إعادة ضبط بيانات التجربة ✔");
    }, "إعادة الضبط");
};

$("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
        const user = Store.login(Auth.role, $("studentId").value, $("password").value);
        $("loginError").textContent = "";
        Auth.enter(user);
    } catch (err) {
        $("loginError").textContent = err.message;
    }
});

$("logoutBtn").onclick = () => Auth.logout();

// تحديث مباشر بين التبويبات (مثلاً: الطالب يمسح QR في تبويب، والدكتور يرى الحضور في تبويب آخر)
let storageTimer = null;
window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== "acp_demo_v2") return;
    clearTimeout(storageTimer);
    storageTimer = setTimeout(() => {
        Store.sync();
        const user = Store.current();
        if (!user || $("portalView").classList.contains("hidden")) return;
        if (document.querySelector(".modal-overlay")) return;   // لا نقاطع نموذجًا مفتوحًا
        if (CURRENT_VIEW && (ROLES[user.role].live || []).includes(CURRENT_VIEW)) show(CURRENT_VIEW, true);
    }, 150);
});

// بدء التشغيل
Auth.setRole("student");
(function bootstrap() {
    const user = Store.current();
    if (user) { Auth.role = user.role; Auth.setRole(user.role); Auth.enter(user); }
})();
