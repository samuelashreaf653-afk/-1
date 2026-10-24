/* ============================================================
   admin.js — لوحة الأدمن (نسخة تجريبية)
   إدارة: الطلاب، الأساتذة، المواد، الجداول، الكورسات + الحضور والدرجات
   ============================================================ */

/* تعريف كل كيان: الأعمدة + حقول النموذج. المنطق والتحقق في Store.crud */
const ADMIN_ENTITIES = {
    students: {
        title: "إدارة الطلاب", single: "طالب", idField: "Student_id",
        search: (r) => `${r.Student_id} ${r.Student_name} ${r.email}`,
        columns: [
            { label: "الرقم الجامعي", cell: (r) => `<b>${esc(r.Student_id)}</b>` },
            { label: "الاسم", cell: (r) => esc(r.Student_name) },
            { label: "النوع", cell: (r) => esc(r.gender) },
            { label: "البريد", cell: (r) => esc(r.email) },
            { label: "الفرقة", cell: (r) => esc(levelName(r)) },
            { label: "المعدل", cell: (r) => `<span class="badge gold">${Number(r.gpa).toFixed(2)}</span>` }
        ],
        fields: (row) => [
            { name: "Student_id", label: "الرقم الجامعي", type: "number", value: row ? row.Student_id : "", readonly: !!row, required: true },
            { name: "Student_name", label: "اسم الطالب", value: row ? row.Student_name : "", required: true },
            { name: "gender", label: "النوع", type: "select", options: ["ذكر", "أنثى"], value: row ? row.gender : "ذكر" },
            { name: "email", label: "البريد الإلكتروني", type: "email", value: row ? row.email : "" },
            { name: "Level_Number", label: "الفرقة", type: "select", options: DB.levels.map((l) => [l.Level_Number, l.Level_name]), value: row ? row.Level_Number : 3 },
            { name: "gpa", label: "المعدل التراكمي (0 - 4)", type: "number", step: "0.01", value: row ? row.gpa : "3.00", required: true },
            { name: "password", label: row ? "كلمة مرور جديدة (اتركها فارغة بدون تغيير)" : "كلمة المرور", type: "text", value: "", required: !row }
        ]
    },

    professors: {
        title: "إدارة الأساتذة والمعيدين", single: "أستاذ / معيد", idField: "Prof_id",
        search: (r) => `${r.name} ${r.degree}`,
        columns: [
            { label: "#", cell: (r) => esc(r.Prof_id) },
            { label: "الاسم", cell: (r) => `<b>${esc(r.name)}</b>` },
            { label: "الدرجة العلمية", cell: (r) => `<span class="badge ${r.degree === "دكتور" ? "blue" : "gold"}">${esc(r.degree)}</span>` },
            { label: "المواد", cell: (r) => Store.subjectsOfProfessor(r).map((s) => esc(s.Subject_Name)).join("، ") || "—" },
            { label: "حساب الدخول", cell: (r) => { const a = DB.accounts.find((x) => x.role === "doctor" && x.ref === r.Prof_id); return a ? `<code>${esc(a.username)}</code>` : "—"; } }
        ],
        fields: (row) => {
            const f = [
                { name: "name", label: "الاسم", value: row ? row.name : "", required: true },
                { name: "degree", label: "الدرجة العلمية", type: "select", options: ["دكتور", "معيد"], value: row ? row.degree : "دكتور" }
            ];
            if (!row) {
                f.push({ name: "username", label: "اسم مستخدم الدكتور (للدكاترة فقط)", value: "" });
                f.push({ name: "password", label: "كلمة المرور (للدكاترة فقط)", value: "" });
            } else if (row.degree === "دكتور") {
                f.push({ name: "password", label: "كلمة مرور جديدة (اتركها فارغة بدون تغيير)", value: "" });
            }
            return f;
        }
    },

    subjects: {
        title: "إدارة المواد الدراسية", single: "مادة", idField: "Subject_id",
        search: (r) => `${r.Subject_id} ${r.Subject_Name} ${r.prof} ${r.ta}`,
        columns: [
            { label: "الكود", cell: (r) => `<b>#${esc(r.Subject_id)}</b>` },
            { label: "المادة", cell: (r) => esc(r.Subject_Name) },
            { label: "الساعات", cell: (r) => `<span class="badge gold">${esc(r.Credits)}</span>` },
            { label: "الفصل", cell: (r) => (r.term === "First" ? "الأول" : "الثاني") },
            { label: "الدكتور", cell: (r) => esc(r.prof) },
            { label: "المعيد", cell: (r) => esc(r.ta) }
        ],
        fields: (row) => [
            { name: "Subject_id", label: "كود المادة", type: "number", value: row ? row.Subject_id : "", readonly: !!row, required: true },
            { name: "Subject_Name", label: "اسم المادة", value: row ? row.Subject_Name : "", required: true },
            { name: "Credits", label: "الساعات المعتمدة", type: "number", value: row ? row.Credits : 3, required: true },
            { name: "term", label: "الفصل الدراسي", type: "select", options: [["First", "الأول"], ["Second", "الثاني"]], value: row ? row.term : "First" },
            { name: "prof", label: "الدكتور المسؤول", type: "select", options: DB.professors.filter((p) => p.degree === "دكتور").map((p) => p.name), value: row ? row.prof : "" },
            { name: "ta", label: "المعيد المسؤول", type: "select", options: DB.professors.filter((p) => p.degree === "معيد").map((p) => p.name), value: row ? row.ta : "" }
        ]
    },

    schedule: {
        title: "إدارة جداول المحاضرات والسكاشن", single: "صف جدول", idField: "id",
        search: (r) => `${r.day} ${r.subject} ${r.lecture.who} ${r.section.who}`,
        columns: [
            { label: "اليوم", cell: (r) => `<b>${esc(r.day)}</b>` },
            { label: "المادة", cell: (r) => esc(r.subject) },
            { label: "المحاضرة", cell: (r) => `${esc(r.lecture.who)}<div class="sub-line">${esc(r.lecture.time)} · ${esc(r.lecture.hall)}</div>` },
            { label: "السكشن", cell: (r) => `${esc(r.section.who)}<div class="sub-line">${esc(r.section.time)} · ${esc(r.section.hall)}</div>` }
        ],
        fields: (row) => [
            { name: "day", label: "اليوم", type: "select", options: ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"], value: row ? row.day : "السبت" },
            { name: "subject", label: "المادة", type: "select", options: DB.subjects.map((s) => s.Subject_Name), value: row ? row.subject : "" },
            { name: "lec_who", label: "المحاضر", value: row ? row.lecture.who : "", required: true },
            { name: "lec_time", label: "توقيت المحاضرة", value: row ? row.lecture.time : "", required: true },
            { name: "lec_hall", label: "القاعة", value: row ? row.lecture.hall : "", required: true },
            { name: "sec_who", label: "المعيد (السكشن)", value: row ? row.section.who : "", required: true },
            { name: "sec_time", label: "توقيت السكشن", value: row ? row.section.time : "", required: true },
            { name: "sec_hall", label: "المعمل", value: row ? row.section.hall : "", required: true }
        ]
    },

    courses: {
        title: "إدارة الدورات والكورسات", single: "كورس", idField: "course_id",
        search: (r) => `${r.courses_title} ${r.instructor}`,
        columns: [
            { label: "#", cell: (r) => esc(r.course_id) },
            { label: "الكورس", cell: (r) => `<b>${esc(r.courses_title)}</b>` },
            { label: "المحاضر", cell: (r) => esc(r.instructor) },
            { label: "الشهادة", cell: (r) => esc(r.Certification) },
            { label: "السعر", cell: (r) => `<span class="course-price">${esc(r.Cost)} جنيه</span>` }
        ],
        fields: (row) => [
            { name: "courses_title", label: "اسم الكورس", value: row ? row.courses_title : "", required: true },
            { name: "Certification", label: "نوع الشهادة", value: row ? row.Certification : "شهادة إتمام معتمدة", required: true },
            { name: "description", label: "الوصف", type: "textarea", value: row ? row.description : "", required: true },
            { name: "Cost", label: "السعر (جنيه)", type: "number", value: row ? row.Cost : "", required: true },
            { name: "instructor", label: "المحاضر", value: row ? row.instructor : "", required: true },
            { name: "externalNote", label: "ملاحظة عن المحاضر", value: row ? row.externalNote : "" }
        ]
    }
};

const AdminUI = {
    filters: {},

    /* ---------- نموذج الإضافة / التعديل ---------- */
    fieldHtml(f) {
        const attrs = `name="${f.name}" ${f.required ? "required" : ""} ${f.readonly ? "readonly" : ""}`;
        let ctl;
        if (f.type === "select") {
            ctl = `<select class="input" ${attrs}>${f.options.map((o) => {
                const [v, l] = Array.isArray(o) ? o : [o, o];
                return `<option value="${esc(v)}" ${String(v) === String(f.value) ? "selected" : ""}>${esc(l)}</option>`;
            }).join("")}</select>`;
        } else if (f.type === "textarea") {
            ctl = `<textarea class="input" rows="3" ${attrs}>${esc(f.value)}</textarea>`;
        } else {
            ctl = `<input class="input" type="${f.type || "text"}" ${f.step ? `step="${f.step}"` : ""} value="${esc(f.value)}" ${attrs} />`;
        }
        return `<div class="field"><label>${esc(f.label)}</label>${ctl}</div>`;
    },

    openForm(entity, id) {
        const E = ADMIN_ENTITIES[entity];
        const row = id === undefined ? null : Store.crud.list(entity).find((r) => String(r[E.idField]) === String(id));
        if (id !== undefined && !row) return UI.toast("السجل غير موجود.", "err");
        const body = `<div class="form-grid">${E.fields(row).map((f) => this.fieldHtml(f)).join("")}</div>`;
        UI.modal(row ? `تعديل ${E.single}` : `إضافة ${E.single}`, body, (data) => {
            if (row) Store.crud.update(entity, id, data);
            else Store.crud.add(entity, data);
            UI.toast(row ? "تم حفظ التعديل ✔" : "تمت الإضافة ✔");
            show(CURRENT_VIEW, true);
        }, row ? "حفظ التعديل" : "إضافة");
    },

    remove(entity, id) {
        const E = ADMIN_ENTITIES[entity];
        UI.confirm(`هل أنت متأكد من حذف هذا ${E.single}؟ لا يمكن التراجع (إلا بإعادة ضبط بيانات التجربة).`, () => {
            Store.crud.remove(entity, id);
            UI.toast("تم الحذف ✔");
            show(CURRENT_VIEW, true);
        }, "حذف");
    },

    search(entity, value) {
        this.filters[entity] = value;
        const body = $("crudBody");
        if (body) body.innerHTML = this.rowsHtml(entity);
    },

    rowsHtml(entity) {
        const E = ADMIN_ENTITIES[entity];
        const q = (this.filters[entity] || "").trim().toLowerCase();
        const rows = Store.crud.list(entity).filter((r) => !q || E.search(r).toLowerCase().includes(q));
        if (!rows.length) return `<tr><td colspan="${E.columns.length + 1}" class="c">لا توجد نتائج</td></tr>`;
        return rows.map((r) => `<tr>${E.columns.map((c) => `<td>${c.cell(r)}</td>`).join("")}
            <td class="actions">
                <button class="btn sm ghost" onclick="AdminUI.openForm('${entity}', '${esc(r[E.idField])}')">✏️ تعديل</button>
                <button class="btn sm danger" onclick="AdminUI.remove('${entity}', '${esc(r[E.idField])}')">🗑️ حذف</button>
            </td></tr>`).join("");
    },

    crudView(entity) {
        const E = ADMIN_ENTITIES[entity];
        const total = Store.crud.list(entity).length;
        return `
            <div class="full-card">
                <div class="card-header toolbar">
                    <span>${E.title} <span class="badge blue">${total}</span></span>
                    <span class="toolbar-actions">
                        <input class="input search" placeholder="🔎 بحث..." value="${esc(this.filters[entity] || "")}" oninput="AdminUI.search('${entity}', this.value)" />
                        <button class="btn sm" onclick="AdminUI.openForm('${entity}')">➕ إضافة ${E.single}</button>
                    </span>
                </div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr>${E.columns.map((c) => `<th>${c.label}</th>`).join("")}<th>إجراءات</th></tr></thead>
                    <tbody id="crudBody">${this.rowsHtml(entity)}</tbody>
                </table></div>
            </div>`;
    },

    /* ---------- نظرة عامة ---------- */
    overview() {
        Store.sync();
        const open = DB.sessions.filter((s) => Store.isOpen(s)).length;
        const stats = [
            ["🎓", DB.students.length, "الطلاب"],
            ["👨‍🏫", DB.professors.length, "الأساتذة والمعيدون"],
            ["📚", DB.subjects.length, "المواد"],
            ["🏅", DB.courses.length, "الكورسات"],
            ["🗓️", DB.sessions.length, "المحاضرات المسجلة"],
            ["📡", open, "محاضرات مفتوحة الآن"]
        ].map(([i, n, l]) => `<div class="stat-card"><div class="stat-icon">${i}</div><div class="stat-info"><b>${n}</b><span>${l}</span></div></div>`).join("");

        const risk = [];
        DB.subjects.filter((s) => s.term === "First").forEach((s) => {
            DB.students.forEach((st) => {
                const t = Store.attendanceStats(s.Subject_id, st);
                if (t.exceeded) risk.push({ st, s, t });
            });
        });
        const riskRows = risk.slice(0, 12).map((r) => `<tr><td><b>${esc(r.st.Student_name)}</b></td><td>${esc(r.s.Subject_Name)}</td><td>${r.t.absent} من ${r.t.total}</td><td><span class="badge red">${r.t.rate}% ⚠</span></td></tr>`).join("");
        const accounts = DB.accounts.filter((a) => a.role !== "student").map((a) => `<tr><td><code>${esc(a.username)}</code></td><td>${esc(a.name)}</td><td><span class="badge ${a.role === "admin" ? "red" : "blue"}">${esc(Store.ROLE_LABEL[a.role])}</span></td></tr>`).join("");
        return `
            <div class="stats-grid">${stats}</div>
            <div class="full-card">
                <div class="card-header">طلاب تجاوزوا نسبة الغياب المسموحة (${esc(DB.maxAllowedAbsentRate)})</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>الطالب</th><th>المادة</th><th>الغياب</th><th>النسبة</th></tr></thead>
                    <tbody>${riskRows || `<tr><td colspan="4" class="c">لا يوجد</td></tr>`}</tbody>
                </table></div>
            </div>
            <div class="full-card">
                <div class="card-header">حسابات الإدارة والدكاترة (تجريبية)</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>اسم المستخدم</th><th>الاسم</th><th>الدور</th></tr></thead>
                    <tbody>${accounts}</tbody>
                </table></div>
                <p class="legend">حسابات الطلاب أسماء المستخدمين لها هي أرقامهم الجامعية. كلمات المرور التجريبية معروضة للتجربة فقط في هذه النسخة.</p>
                <button class="btn sm danger" onclick="AdminUI.resetDemo()">↺ إعادة ضبط بيانات التجربة</button>
            </div>`;
    },

    resetDemo() {
        UI.confirm("سيتم حذف كل التعديلات والرجوع للبيانات الابتدائية. متأكد؟", () => {
            Store.reset();
            UI.toast("تمت إعادة ضبط بيانات التجربة ✔");
            show("overview");
        }, "إعادة الضبط");
    },

    /* ---------- الحضور (تعديل أي مادة) ---------- */
    attSid: null,
    attendance() {
        const subs = DB.subjects.filter((s) => s.term === "First");
        if (!subs.length) return `<div class="full-card"><div class="empty-box">لا توجد مواد في الفصل الأول.</div></div>`;
        if (!subs.some((s) => s.Subject_id === this.attSid)) this.attSid = subs[0].Subject_id;
        const picker = `<select class="select" onchange="AdminUI.pickAtt(this.value)">${subs.map((s) =>
            `<option value="${s.Subject_id}" ${s.Subject_id === this.attSid ? "selected" : ""}>${esc(s.Subject_Name)} (#${s.Subject_id})</option>`).join("")}</select>`;
        return `
            <div class="full-card">
                <div class="card-header toolbar"><span>سجل الحضور لكل مادة — اضغط على الخلية لتصحيح الحالة</span>${picker}</div>
                ${attendanceMatrixHtml(this.attSid, { editable: true })}
            </div>`;
    },
    pickAtt(v) { this.attSid = Number(v); show("attendance", true); },

    /* ---------- الدرجات (تعديل أي مادة) ---------- */
    grades() {
        const subs = DB.subjects.filter((s) => s.term === "First");
        if (!subs.length) return `<div class="full-card"><div class="empty-box">لا توجد مواد في الفصل الأول.</div></div>`;
        DoctorUI.sid = subs.some((s) => s.Subject_id === DoctorUI.sid) ? DoctorUI.sid : subs[0].Subject_id;
        // نعيد استخدام جدول الدرجات الخاص بالدكتور مع قائمة مواد كل المواد
        const html = DoctorUI.grades.call({
            curSid: () => DoctorUI.sid,
            picker: () => `<select class="select" onchange="AdminUI.pickGrade(this.value)">${subs.map((s) =>
                `<option value="${s.Subject_id}" ${s.Subject_id === DoctorUI.sid ? "selected" : ""}>${esc(s.Subject_Name)} (#${s.Subject_id})</option>`).join("")}</select>`,
            letterBadge: (g) => DoctorUI.letterBadge(g)
        });
        return html;
    },
    pickGrade(v) { DoctorUI.sid = Number(v); show("grades", true); }
};

ROLES.admin = {
    label: "أدمن",
    sub: "لوحة الإدارة",
    views: [
        { id: "overview", icon: "📊", label: "نظرة عامة" },
        { id: "students", icon: "🎓", label: "إدارة الطلاب" },
        { id: "professors", icon: "👨‍🏫", label: "الأساتذة والمواد (عرض)" },
        { id: "subjects", icon: "📚", label: "إدارة المواد" },
        { id: "profManage", icon: "🧑‍🏫", label: "إدارة الأساتذة" },
        { id: "schedule", icon: "🗓️", label: "إدارة الجداول" },
        { id: "courses", icon: "🏅", label: "إدارة الكورسات" },
        { id: "attendance", icon: "✅", label: "الحضور والغياب" },
        { id: "grades", icon: "📝", label: "الدرجات" }
    ],
    live: ["attendance"],
    render: {
        overview: () => AdminUI.overview(),
        students: () => AdminUI.crudView("students"),
        professors: () => ProfUI.html(),
        subjects: () => AdminUI.crudView("subjects"),
        profManage: () => AdminUI.crudView("professors"),
        schedule: () => AdminUI.crudView("schedule"),
        courses: () => AdminUI.crudView("courses"),
        attendance: () => AdminUI.attendance(),
        grades: () => AdminUI.grades()
    },
    after: {}
};
