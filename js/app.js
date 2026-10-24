/* app.js — الهيكل المشترك (أدوار + تنقل + أدوات) + لوحة الطالب */

const $ = (id) => document.getElementById(id);

// تهريب النص قبل وضعه داخل HTML (البيانات قابلة للتعديل من الأدمن)
const esc = (v) => String(v === undefined || v === null ? "" : v).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

/* ---------- أدوات واجهة مشتركة ---------- */
const UI = {
    toast(msg, type) {
        const el = document.createElement("div");
        el.className = "toast " + (type === "err" ? "err" : "ok");
        el.textContent = msg;
        $("toastHost").appendChild(el);
        setTimeout(() => el.classList.add("out"), 3200);
        setTimeout(() => el.remove(), 3700);
    },
    // ينفّذ إجراءً ويعرض رسالة نجاح أو خطأ. يرجع true/false
    attempt(fn, okMsg) {
        try { fn(); if (okMsg) UI.toast(okMsg); return true; }
        catch (e) { UI.toast(e.message || "حدث خطأ غير متوقع", "err"); return false; }
    },
    modal(title, bodyHtml, onSubmit, submitLabel) {
        $("modalHost").innerHTML = `
            <div class="modal-overlay" id="modalOverlay">
                <form class="modal" id="modalForm" autocomplete="off">
                    <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="modal-x" id="modalX">✕</button></div>
                    <div class="modal-body">${bodyHtml}</div>
                    <div class="modal-error" id="modalError"></div>
                    <div class="modal-foot">
                        <button class="btn sm" type="submit">${esc(submitLabel || "حفظ")}</button>
                        <button class="btn sm ghost" type="button" id="modalCancel">إلغاء</button>
                    </div>
                </form>
            </div>`;
        $("modalX").onclick = $("modalCancel").onclick = () => UI.closeModal();
        $("modalOverlay").addEventListener("mousedown", (e) => { if (e.target.id === "modalOverlay") UI.closeModal(); });
        $("modalForm").addEventListener("submit", (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            try { onSubmit(data); UI.closeModal(); }
            catch (err) { $("modalError").textContent = err.message || "حدث خطأ"; }
        });
        const first = $("modalForm").querySelector("input,select,textarea");
        if (first) first.focus();
    },
    confirm(message, onYes, yesLabel) {
        UI.modal("تأكيد الإجراء", `<p class="confirm-text">${esc(message)}</p>`, () => onYes(), yesLabel || "تأكيد");
    },
    closeModal() { $("modalHost").innerHTML = ""; }
};

// مؤقتات الصفحة الحالية (تُلغى عند التنقل)
const Live = {
    ids: [],
    every(ms, fn) { this.ids.push(setInterval(fn, ms)); },
    clear() { this.ids.forEach(clearInterval); this.ids = []; }
};

/* ---------- الأدوار والتنقل ----------
   كل دور له: قائمة صفحاته (views) ودوال العرض (render).
   دور الدكتور والأدمن يُسجَّلان في doctor.js و admin.js.            */
const ROLES = {
    student: {
        label: "طالب",
        sub: "نظم معلومات الأعمال (BIS)",
        views: [
            { id: "studentProfile", icon: "👤", label: "الملف الشخصي" },
            { id: "departmentAndLevels", icon: "🏢", label: "القسم والمستويات الأكاديمية" },
            { id: "professors", icon: "👨‍🏫", label: "الأساتذة والمواد" },
            { id: "subjects", icon: "📚", label: "المواد الدراسية" },
            { id: "semesters", icon: "🗓️", label: "الفصول الدراسية وجداول المحاضرات" },
            { id: "registration", icon: "📌", label: "تسجيل المواد" },
            { id: "courses", icon: "🏅", label: "الدورات والشهادات" },
            { id: "attendance", icon: "✅", label: "سجل الحضور والغياب" },
            { id: "scan", icon: "📷", label: "مسح QR للحضور" },
            { id: "grades", icon: "📝", label: "درجاتي" }
        ],
        live: ["attendance"],
        render: null,
        after: {}
    }
};

let CURRENT_VIEW = null;

function buildNav(role) {
    $("nav").innerHTML = ROLES[role].views.map(
        (v) => `<button data-view="${v.id}">${v.icon}<span>${v.label}</span></button>`
    ).join("");
    $("nav").querySelectorAll("button").forEach((b) => (b.onclick = () => show(b.dataset.view)));
}

function show(viewId, keepScroll) {
    Live.clear();
    UI.closeModal();
    if (typeof ScanUI !== "undefined") ScanUI.stop();
    Store.sync();
    const user = Store.current();
    if (!user) { Auth.logout(); return; }
    const cfg = ROLES[user.role];
    if (!cfg.views.some((v) => v.id === viewId)) {
        UI.toast("هذه الصفحة غير متاحة لهذا الدور.", "err");
        viewId = cfg.views[0].id;
    }
    CURRENT_VIEW = viewId;
    $("nav").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
    $("content").innerHTML = cfg.render[viewId] ? cfg.render[viewId]() : `<p>الصفحة قيد التحديث</p>`;
    if (cfg.after && cfg.after[viewId]) cfg.after[viewId]();
    if (!keepScroll) window.scrollTo(0, 0);
}

// بيانات مساعدة
const levelName = (st) => { const l = DB.levels.find((x) => x.Level_Number === st.Level_Number); return l ? l.Level_name : "—"; };
const termSubjects = (term) => DB.subjects.filter((s) => s.term === term).map((s) => ({ id: s.Subject_id, name: s.Subject_Name }));
const methodBadge = (m) => m === "qr" ? '<span class="badge blue">QR</span>' : m === "manual" ? '<span class="badge gold">يدوي</span>' : '<span class="badge">—</span>';

/* مصفوفة الحضور: الطلاب × المحاضرات لمادة واحدة
   editable: للدكتور/الأدمن (ضغطة تبدّل الحالة) — onlyStudent: طالب واحد فقط */
function attendanceMatrixHtml(sid, opts) {
    opts = opts || {};
    const sub = Store.subjectById(sid);
    if (!sub) return "";
    if (sub.term !== "First") return `<div class="empty-box">الفصل الدراسي الثاني غير متاح حالياً — لا توجد محاضرات بعد.</div>`;
    const sessions = Store.sessionsOf(sid);
    if (!sessions.length) return `<div class="empty-box">لا توجد محاضرات مسجلة لهذه المادة بعد.</div>`;
    const students = opts.onlyStudent ? [opts.onlyStudent] : Store.enrolledStudents(sid);
    const head = sessions.map((s) => `<th class="c">م${s.lecture_no}<div class="sub-line" style="color:#cbd5e1">${esc(s.date)}</div></th>`).join("");
    const rows = students.map((st) => {
        const mine = Store.sessionsOf(sid, st).map((s) => s.id);
        const cells = sessions.map((s) => {
            if (!mine.includes(s.id)) return `<td class="c"><span class="badge">—</span></td>`;
            const rec = (DB.attendance[s.id] || {})[st.Student_id];
            const open = Store.isOpen(s);
            const state = rec ? rec.status : (open ? "pending" : "absent");
            const label = state === "present" ? "✔" : state === "pending" ? "⏳" : "✘";
            const cls = state === "present" ? "present" : state === "pending" ? "pending" : "absent";
            if (opts.editable) {
                return `<td class="c"><button class="att-cell ${cls}" title="اضغط لتبديل الحالة" onclick="DoctorUI.toggle('${s.id}', ${st.Student_id})">${label}</button></td>`;
            }
            return `<td class="c"><span class="att-cell static ${cls}">${label}</span></td>`;
        }).join("");
        const stt = Store.attendanceStats(sid, st);
        const rate = stt.total ? `<span class="badge ${stt.exceeded ? "red" : "green"}">${stt.rate}%${stt.exceeded ? " ⚠" : ""}</span>` : "—";
        return `<tr><td><b>${esc(st.Student_name)}</b><div class="sub-line">${st.Student_id}</div></td>${cells}<td class="c">${stt.present} من ${stt.total}</td><td class="c">${rate}</td></tr>`;
    }).join("");
    return `
        <div class="table-wrap"><table class="matrix">
            <thead><tr><th>الطالب</th>${head}<th class="c">الحضور</th><th class="c">نسبة الغياب</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <p class="legend">✔ حاضر · ✘ غائب · ⏳ لم يُسجَّل بعد (محاضرة مفتوحة) · ⚠ تجاوز نسبة الغياب المسموحة (${esc(DB.maxAllowedAbsentRate)})</p>`;
}

const RENDER = {
    studentProfile() {
        const s = Store.current().student;
        const d = DB.department;
        return `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon">🎓</div><div class="stat-info"><b>${esc(levelName(s))}</b><span>المستوى الحالي</span></div></div>
                <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-info"><b>${Number(s.gpa).toFixed(2)}</b><span>المعدل التراكمي</span></div></div>
                <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-info"><b>${DB.subjects.length}</b><span>المواد الدراسية</span></div></div>
            </div>
            <div class="full-card">
                <div class="card-header">معلومات الطالب الأكاديمية</div>
                <div class="table-wrap"><table>
                    <tr><td style="width:220px; font-weight:600;">الرقم الجامعي</td><td><b>${esc(s.Student_id)}</b></td></tr>
                    <tr><td style="font-weight:600;">اسم الطالب</td><td>${esc(s.Student_name)}</td></tr>
                    <tr><td style="font-weight:600;">النوع</td><td>${esc(s.gender)}</td></tr>
                    <tr><td style="font-weight:600;">البريد الإلكتروني</td><td>${esc(s.email)}</td></tr>
                    <tr><td style="font-weight:600;">القسم التخصصي</td><td><span class="badge blue">${d.Department_name}</span></td></tr>
                </table></div>
            </div>`;
    },

    departmentAndLevels() {
        const d = DB.department;
        return `
            <div class="full-card">
                <div class="card-header">القسم الأكاديمي (قسم الطالب الوحيد)</div>
                <div class="table-wrap" style="margin-bottom:24px;"><table>
                    <thead><tr><th>كود القسم</th><th>اسم القسم التخصصي</th><th>رئيس القسم</th></tr></thead>
                    <tbody>
                        <tr>
                            <td><span class="badge blue">${d.code}</span></td>
                            <td><b>${d.Department_name}</b></td>
                            <td>${d.head}</td>
                        </tr>
                    </tbody>
                </table></div>

                <div class="card-header">المستويات الأكاديمية ومشاريع التخرج</div>
                <div class="table-wrap"><table>
                    <thead><tr><th>المستوى / الفرقة</th><th>حالة الطالب</th><th>ملاحظات ومتطلبات التخرج</th></tr></thead>
                    <tbody>
                        ${DB.levels.map(l => `
                            <tr>
                                <td><b>${l.Level_name}</b></td>
                                <td>
                                    ${l.status === 'completed' ? '<span class="badge green">✓ تم إنجازها</span>' : 
                                        l.status === 'current' ? '<span class="badge gold">★ أنت هنا (الحالية)</span>' : 
                                        '<span class="badge blue">قادمة</span>'}
                                </td>
                                <td>${l.note}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table></div>
            </div>`;
    },

    subjects() {
        const firstTerm = DB.subjects.filter(s => s.term === "First");
        const secondTerm = DB.subjects.filter(s => s.term === "Second");
        return `
            <div class="full-card">
                <div class="card-header">المواد الدراسية - الفصل الدراسي الأول</div>
                <div class="table-wrap" style="margin-bottom:20px;"><table style="margin-bottom:0;">
                    <thead><tr><th>كود المادة</th><th>اسم المادة</th><th>الساعات</th><th>أستاذ المحاضرة (الدكتور)</th><th>المعيد المسئول</th></tr></thead>
                    <tbody>${firstTerm.map(s => `<tr><td><b>#${s.Subject_id}</b></td><td>${esc(s.Subject_Name)}</td><td><span class="badge gold">${esc(s.Credits)} ساعات</span></td><td>${esc(s.prof)}</td><td>${esc(s.ta)}</td></tr>`).join('')}</tbody>
                </table></div>

                <div class="card-header" style="margin-top:20px;">المواد الدراسية - الفصل الدراسي الثاني</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>كود المادة</th><th>اسم المادة</th><th>الساعات</th><th>أستاذ المحاضرة (الدكتور)</th><th>المعيد المسئول</th></tr></thead>
                    <tbody>${secondTerm.map(s => `<tr><td><b>#${s.Subject_id}</b></td><td>${esc(s.Subject_Name)}</td><td><span class="badge gold">${esc(s.Credits)} ساعات</span></td><td>${esc(s.prof)}</td><td>${esc(s.ta)}</td></tr>`).join('')}</tbody>
                </table></div>
            </div>`;
    },

    semesters() {
        return `
            <div class="full-card">
                <div class="card-header">الفصول الدراسية وجداول المحاضرات المباشرة</div>
                
                <!-- ترم أول (عرض جدول واحد فقط تفصيلي دون أي تكرار) -->
                <div style="margin-bottom:30px; border-bottom:1px solid var(--border-color); padding-bottom:24px;">
                    <h3 style="font-size:16px; color:var(--navy-dark); margin-bottom:4px;">الفصل الدراسي الأول (معرف: #101)</h3>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">من تاريخ: 2026-09-20 إلى تاريخ: 2027-01-15</p>
                    
                    <h4 style="font-size:14px; color:var(--navy-primary); margin-bottom:12px;">جدول المحاضرات والسكاشن التفصيلي (ترم أول)</h4>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>اليوم</th>
                                    <th>اسم المادة</th>
                                    <th>المحاضرة (الدكتور / التوقيت / القاعة)</th>
                                    <th>السكشن (المعيد / التوقيت / المعمل)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${DB.fullWeeklySchedule.map(sch => `
                                    <tr>
                                        <td><b>${esc(sch.day)}</b></td>
                                        <td><b>${esc(sch.subject)}</b></td>
                                        <td>
                                            <span class="badge blue">محاضرة</span>
                                            <div>${esc(sch.lecture.who)}</div>
                                            <div class="sub-line">${esc(sch.lecture.time)} · ${esc(sch.lecture.hall)}</div>
                                        </td>
                                        <td>
                                            <span class="badge gold">سكشن</span>
                                            <div>${esc(sch.section.who)}</div>
                                            <div class="sub-line">${esc(sch.section.time)} · ${esc(sch.section.hall)}</div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ترم تاني -->
                <div>
                    <h3 style="font-size:16px; color:var(--navy-dark); margin-bottom:4px;">الفصل الدراسي الثاني (معرف: #102)</h3>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">من تاريخ: 2027-02-10 إلى تاريخ: 2027-06-05</p>
                    <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:24px; text-align:center;">
                        <p style="font-weight:700; color:var(--text-muted); font-size:15px;">غير متاح حالياً (لأننا لا زلنا في الفصل الدراسي الأول)</p>
                    </div>
                </div>
            </div>`;
    },

    registration() {
        const t1 = DB.registrations[0];
        const t2 = DB.registrations[1];
        return `
            <div class="full-card">
                <div class="card-header">تسجيل المواد الدراسية للعام الجامعي</div>
                
                <!-- ترم اول -->
                <div style="margin-bottom:24px;">
                    <h3 style="font-size:15px; color:var(--navy-dark); margin-bottom:6px;">${t1.term_name}</h3>
                    <p style="font-size:13px; color:var(--gold-accent); font-weight:600; margin-bottom:4px;">ميعاد التسجيل وأخر موعد: ${t1.period}</p>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">الحالة: <span class="badge green">${t1.status}</span></p>
                    <div class="table-wrap"><table style="margin-bottom:0;">
                        <thead><tr><th>كود المادة (ID)</th><th>اسم المادة</th><th>الترم</th></tr></thead>
                        <tbody>${termSubjects("First").map(sub => `<tr><td><span class="badge blue">#${sub.id}</span></td><td><b>${esc(sub.name)}</b></td><td>الترم الأول</td></tr>`).join('')}</tbody>
                    </table></div>
                </div>

                <!-- ترم تاني -->
                <div>
                    <h3 style="font-size:15px; color:var(--navy-dark); margin-bottom:6px;">${t2.term_name}</h3>
                    <p style="font-size:13px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">ميعاد التسجيل: ${t2.period}</p>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">الحالة: <span class="badge red">${t2.status}</span></p>
                    <div class="table-wrap"><table style="margin-bottom:0;">
                        <thead><tr><th>كود المادة (ID)</th><th>اسم المادة</th><th>الترم</th></tr></thead>
                        <tbody>${termSubjects("Second").map(sub => `<tr><td><span class="badge blue">#${sub.id}</span></td><td><b>${esc(sub.name)}</b></td><td>الترم الثاني</td></tr>`).join('')}</tbody>
                    </table></div>
                </div>
            </div>`;
    },

    courses() {
        return `
            <div class="full-card">
                <div class="card-header">الدورات التدريبية المتاحة للحجز والتطوير المهني</div>
                <div class="courses-grid" style="margin-bottom:28px;">
                    ${DB.courses.map((c, idx) => {
                        const shortDesc = c.description.substring(0, 70) + "...";
                        return `
                            <div class="course-box">
                                <div>
                                    <span class="badge blue">كورس معتمد</span>
                                    <h4 style="margin-top:10px;">${esc(c.courses_title)}</h4>
                                    <p class="course-desc" id="desc-${idx}">${shortDesc}</p>
                                    <button class="read-more-btn" onclick="toggleDesc(${idx})">قراءة المزيد (Read More)</button>
                                    <div class="instructor-info">
                                        <b>المحاضر:</b> ${esc(c.instructor)}<br/>
                                        <span style="font-size:11px; opacity:0.8;">(${esc(c.externalNote)})</span>
                                    </div>
                                    <p style="font-size:12px; color:var(--gold-accent); margin-bottom:8px;">★ ${esc(c.Certification)}</p>
                                </div>
                                <div class="course-footer">
                                    <span class="course-price">${esc(c.Cost)} جنيه</span>
                                    <button class="btn" style="padding:8px 16px; font-size:13px;" onclick="alert('تم تسجيل طلب حجز الكورس بنجاح!')">حجز الكورس</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="card-header">الكورسات التي أنجزتها والشهادات المتاحة للتحميل</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>اسم الكورس</th><th>تاريخ الإنجاز</th><th>الشهادة</th></tr></thead>
                    <tbody>
                        ${DB.completedCourses.map(cc => `
                            <tr>
                                <td><b>${esc(cc.courses_title)}</b></td>
                                <td>${cc.completion_date}</td>
                                <td><a href="#" class="badge green" style="text-decoration:none;" onclick="alert('جاري تحميل الشهادة بصيغة PDF...'); return false;">📥 تحميل الشهادة</a></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table></div>
            </div>`;
    },

    attendance() {
        const st = Store.current().student;
        const rows = Store.studentAttendanceRows(st);
        const summary = DB.subjects.filter((x) => x.term === "First").map((x) => {
            const t = Store.attendanceStats(x.Subject_id, st);
            return `<tr><td><b>${esc(x.Subject_Name)}</b></td><td>${t.present} من ${t.total}</td><td><span class="badge ${t.exceeded ? "red" : "green"}">${t.rate}%${t.exceeded ? " ⚠ تجاوزت الحد" : ""}</span></td></tr>`;
        }).join("");
        return `
            <div class="full-card">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>سجل الحضور والغياب لجميع محاضرات الترم</span>
                    <span class="badge red" style="font-size:13px;">نسبة الغياب القصوى المسموحة: ${esc(DB.maxAllowedAbsentRate)}</span>
                </div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>رقم المحاضرة</th><th>اسم المادة الدراسية</th><th>تاريخ المحاضرة</th><th>حالة الحضور</th><th>طريقة التسجيل</th></tr></thead>
                    <tbody>
                        ${rows.map(a => `
                            <tr>
                                <td><b>محاضرة رقم ${a.lecture_no}</b></td>
                                <td>${esc(a.subject)}</td>
                                <td>${esc(a.date)}</td>
                                <td>
                                    ${a.status === 'present' ? '<span class="badge green">حاضر</span>' : '<span class="badge red">غائب</span>'}
                                </td>
                                <td>${methodBadge(a.method)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table></div>

                <div class="card-header" style="margin-top:20px;">ملخص الحضور لكل مادة</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>المادة</th><th>الحضور</th><th>نسبة الغياب</th></tr></thead>
                    <tbody>${summary}</tbody>
                </table></div>
            </div>`;
    }
};

window.toggleDesc = function(idx) {
    const descEl = document.getElementById(`desc-${idx}`);
    const courses = DB.courses;
    if (descEl.dataset.expanded === "true") {
        descEl.textContent = courses[idx].description.substring(0, 70) + "...";
        descEl.dataset.expanded = "false";
        event.target.textContent = "قراءة المزيد (Read More)";
    } else {
        descEl.textContent = courses[idx].description;
        descEl.dataset.expanded = "true";
        event.target.textContent = "إخفاء التفاصيل";
    }
};

/* ============================================================
   تبويبات الطالب الجديدة: الأساتذة والمواد + الدرجات + مسح QR
   ============================================================ */

ROLES.student.render = RENDER;

/* ---------- الأساتذة والمواد (وحضور الطلاب لكل مادة) ---------- */
const ProfUI = {
    sid: null,
    html() {
        const me = Store.current();
        if (this.sid === null || !Store.subjectById(this.sid)) {
            const f = DB.subjects.find((s) => s.term === "First") || DB.subjects[0];
            this.sid = f ? f.Subject_id : null;
        }
        const rows = DB.professors.map((p, i) => {
            const subs = Store.subjectsOfProfessor(p);
            const chips = subs.length
                ? subs.map((s) => `<button class="chip ${s.Subject_id === this.sid ? "on" : ""}" onclick="ProfUI.pick(${s.Subject_id})" title="عرض الحضور">${esc(s.Subject_Name)}<small>${s.term === "First" ? "ترم 1" : "ترم 2"}</small></button>`).join(" ")
                : "—";
            return `<tr><td>${i + 1}</td><td><b>${esc(p.name)}</b></td><td><span class="badge ${p.degree === "دكتور" ? "blue" : "gold"}">${esc(p.degree)}</span></td><td>${chips}</td></tr>`;
        }).join("");
        const options = DB.subjects.map((s) => `<option value="${s.Subject_id}" ${s.Subject_id === this.sid ? "selected" : ""}>${esc(s.Subject_Name)} (#${s.Subject_id})</option>`).join("");
        const title = me.role === "student" ? "حضورك في المادة" : "حضور كل طالب في المادة";
        return `
            <div class="full-card">
                <div class="card-header">الأساتذة والمعيدون والمواد التي يدرّسونها</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>#</th><th>الاسم</th><th>الدرجة العلمية</th><th>المادة التي يدرّسها (اضغط لعرض الحضور)</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>
            </div>
            <div class="full-card" id="profAttCard">
                <div class="card-header toolbar">
                    <span>${title}</span>
                    <select class="select" id="profSubjectSelect" onchange="ProfUI.pick(this.value)">${options}</select>
                </div>
                <div id="profAttBody">${this.body()}</div>
            </div>`;
    },
    body() {
        const me = Store.current();
        return attendanceMatrixHtml(this.sid, { onlyStudent: me.role === "student" ? me.student : null, editable: false });
    },
    pick(sid) {
        this.sid = Number(sid);
        const card = $("profAttCard");
        if (!card) return;
        $("profAttBody").innerHTML = this.body();
        $("profSubjectSelect").value = String(this.sid);
        document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.getAttribute("onclick") === `ProfUI.pick(${this.sid})`));
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
};
RENDER.professors = () => ProfUI.html();

/* ---------- درجات الطالب (قراءة فقط) ---------- */
RENDER.grades = function () {
    const st = Store.current().student;
    const rows = DB.subjects.filter((s) => s.term === "First").map((s) => {
        const g = Store.gradeOf(s.Subject_id, st.Student_id);
        const t = Store.gradeTotal(g);
        const cell = (v) => (v === null || v === undefined ? '<span class="badge">لم تُرصد</span>' : `<b>${v}</b>`);
        const letter = Store.gradeLetter(g);
        return `<tr><td><b>#${s.Subject_id}</b></td><td>${esc(s.Subject_Name)}</td><td>${cell(g.midterm)} / ${Store.MAX.midterm}</td><td>${cell(g.coursework)} / ${Store.MAX.coursework}</td><td>${cell(g.final)} / ${Store.MAX.final}</td><td>${t === null ? "—" : `<b>${t}</b>`}</td><td><span class="badge ${letter === "F" ? "red" : letter === "—" ? "" : "green"}">${letter}</span></td></tr>`;
    }).join("");
    return `
        <div class="full-card">
            <div class="card-header">درجاتي — الفصل الدراسي الأول (للعرض فقط)</div>
            <div class="table-wrap"><table style="margin-bottom:0;">
                <thead><tr><th>كود المادة</th><th>المادة</th><th>ميدتيرم</th><th>أعمال السنة</th><th>النهائي</th><th>المجموع</th><th>التقدير</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            <p class="legend">الدرجات يرصدها الدكتور المسؤول عن المادة. التقدير يظهر بعد رصد الدرجات الثلاث.</p>
        </div>`;
};

/* ---------- مسح QR للحضور ---------- */
function loadJsQR() {
    return new Promise((resolve) => {
        if (window.jsQR) return resolve(window.jsQR);
        const urls = [
            "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
            "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js"
        ];
        const tryNext = (i) => {
            if (i >= urls.length) return resolve(null);
            const sc = document.createElement("script");
            sc.src = urls[i];
            sc.onload = () => resolve(window.jsQR || null);
            sc.onerror = () => tryNext(i + 1);
            document.head.appendChild(sc);
        };
        tryNext(0);
    });
}

const ScanUI = {
    stream: null,
    timer: null,

    openSessionsHtml() {
        const st = Store.current().student;
        const open = DB.sessions.filter((s) => Store.isOpen(s) && Store.isEnrolled(st.Student_id, s.Subject_id));
        if (!open.length) return `<div class="empty-box">لا توجد محاضرات مفتوحة للتسجيل الآن. اطلب من الدكتور (من حساب دكتور في تبويب آخر) أن يبدأ محاضرة ويعرض الـ QR.</div>`;
        return open.map((s) => {
            const sub = Store.subjectById(s.Subject_id);
            const left = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
            const done = Store.attendanceOf(s.id, st.Student_id) === "present";
            return `<div class="open-session">
                <div><b>${esc(sub.Subject_Name)}</b> — محاضرة رقم ${s.lecture_no}<div class="sub-line">تغلق بعد ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} · ${done ? "✔ تم تسجيل حضورك" : "لم يُسجَّل حضورك بعد"}</div></div>
                <button class="btn sm" ${done ? "disabled" : ""} onclick="ScanUI.simulate('${s.id}')">📲 مسح QR هذه المحاضرة (محاكاة)</button>
            </div>`;
        }).join("");
    },

    html() {
        return `
            <div class="full-card">
                <div class="card-header">تسجيل الحضور بمسح QR</div>
                <p class="muted">الدكتور يبدأ المحاضرة ويعرض رمز QR على الشاشة (يتغير كل 20 ثانية). امسحه بالكاميرا أو استخدم المحاكاة للتجربة.</p>
                <div class="scan-actions">
                    <button class="btn sm" onclick="ScanUI.startCamera()">📷 فتح الكاميرا للمسح</button>
                    <button class="btn sm ghost" id="stopCamBtn" style="display:none" onclick="ScanUI.stop()">إيقاف الكاميرا</button>
                </div>
                <div class="scan-video-box" id="scanVideoBox" style="display:none"><video id="scanVideo" playsinline muted></video></div>

                <div class="card-header" style="margin-top:22px;">محاضرات مفتوحة الآن (محاكاة المسح)</div>
                <div id="openSessions">${this.openSessionsHtml()}</div>

                <div class="card-header" style="margin-top:22px;">أو الصق نص الرمز يدويًا</div>
                <div class="inline-form">
                    <input class="input" id="manualToken" placeholder="ACP1|S-3101-5|xxxxxx" dir="ltr" />
                    <button class="btn sm" onclick="ScanUI.manual()">تأكيد الرمز</button>
                </div>

                <div id="scanResult"></div>
            </div>`;
    },

    after() {
        Live.every(2000, () => { const el = $("openSessions"); if (el) el.innerHTML = this.openSessionsHtml(); });
    },

    simulate(sessionId) {
        Store.sync();
        const s = DB.sessions.find((x) => x.id === sessionId);
        if (!s || !Store.isOpen(s)) { UI.toast("هذه المحاضرة لم تعد مفتوحة.", "err"); return this.refresh(); }
        this.submit(Store.tokenFor(s));
    },

    manual() {
        const v = $("manualToken").value.trim();
        if (!v) return UI.toast("الصق نص الرمز أولاً.", "err");
        this.submit(v);
    },

    submit(token) {
        let res = null, err = null;
        try { res = Store.scanAttendance(token); } catch (e) { err = e; }
        const box = $("scanResult");
        if (err) {
            if (box) box.innerHTML = `<div class="result-card bad"><div class="big">✘</div><div><b>تعذّر تسجيل الحضور</b><div>${esc(err.message)}</div></div></div>`;
            UI.toast(err.message, "err");
        } else {
            const when = new Date(res.time).toLocaleTimeString("ar-EG");
            if (box) box.innerHTML = res.duplicate
                ? `<div class="result-card warn"><div class="big">ℹ</div><div><b>حضورك مسجّل مسبقًا</b><div>${esc(res.subject)} — محاضرة رقم ${res.lecture_no} (${esc(when)})</div></div></div>`
                : `<div class="result-card good"><div class="big">✔</div><div><b>تم تسجيل حضورك بنجاح</b><div>${esc(res.subject)} — محاضرة رقم ${res.lecture_no} · ${esc(when)}</div><div class="sub-line">عرض تجريبي — السجل محفوظ في متصفحك فقط.</div></div></div>`;
            UI.toast(res.duplicate ? "حضورك مسجّل مسبقًا." : "تم تسجيل الحضور بنجاح ✔");
        }
        this.refresh();
    },

    refresh() { const el = $("openSessions"); if (el) el.innerHTML = this.openSessionsHtml(); },

    async startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return UI.toast("الكاميرا غير مدعومة هنا. افتح الصفحة عبر localhost أو استخدم المحاكاة / لصق الرمز.", "err");
        }
        let detector = null;
        if ("BarcodeDetector" in window) { try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { detector = null; } }
        const jsqr = detector ? null : await loadJsQR();
        if (!detector && !jsqr) return UI.toast("تعذّر تحميل قارئ QR (يحتاج إنترنت أو متصفح يدعم BarcodeDetector). استخدم المحاكاة أو الصق الرمز.", "err");
        try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); }
        catch (e) { return UI.toast("لم يتم السماح بالوصول إلى الكاميرا.", "err"); }
        const video = $("scanVideo");
        video.srcObject = this.stream;
        await video.play();
        $("scanVideoBox").style.display = "block";
        $("stopCamBtn").style.display = "inline-block";
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        this.timer = setInterval(async () => {
            if (video.readyState < 2) return;
            let text = null;
            if (detector) {
                try { const r = await detector.detect(video); if (r.length) text = r[0].rawValue; } catch (e) { /* تجاهل */ }
            } else {
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const c = jsqr(img.data, img.width, img.height);
                if (c) text = c.data;
            }
            if (text) { this.stop(); this.submit(text); }
        }, 300);
    },

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        if ($("scanVideoBox")) $("scanVideoBox").style.display = "none";
        if ($("stopCamBtn")) $("stopCamBtn").style.display = "none";
    }
};
RENDER.scan = () => ScanUI.html();
ROLES.student.after.scan = () => ScanUI.after();
