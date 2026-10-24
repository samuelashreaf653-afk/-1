/* ============================================================
   doctor.js — لوحة الدكتور (نسخة تجريبية)
   المحاضرات + QR + سجل الحضور + الدرجات (لمواد الدكتور فقط)
   ============================================================ */

const DoctorUI = {
    sid: null,
    lastToken: null,

    me() { return Store.current(); },
    subjects() { return Store.mySubjects(this.me()); },

    curSid() {
        const subs = this.subjects();
        if (!subs.length) return null;
        if (!subs.some((s) => s.Subject_id === this.sid)) {
            this.sid = (subs.find((s) => s.term === "First") || subs[0]).Subject_id;
        }
        return this.sid;
    },

    picker() {
        const subs = this.subjects();
        const sid = this.curSid();
        return `<select class="select" onchange="DoctorUI.setSubject(this.value)">${subs.map((s) =>
            `<option value="${s.Subject_id}" ${s.Subject_id === sid ? "selected" : ""}>${esc(s.Subject_Name)} (#${s.Subject_id}${s.term === "First" ? "" : " — ترم 2"})</option>`).join("")}</select>`;
    },

    setSubject(v) { this.sid = Number(v); show(CURRENT_VIEW); },

    noSubjects() {
        return `<div class="full-card"><div class="empty-box">لا توجد مواد مسندة إلى حسابك حالياً. يمكن للأدمن إسناد مادة إليك.</div></div>`;
    },

    /* ---------- نظرة عامة ---------- */
    overview() {
        const subs = this.subjects();
        if (!subs.length) return this.noSubjects();
        let lectures = 0, present = 0, total = 0;
        const rows = subs.map((s) => {
            const sess = Store.sessionsOf(s.Subject_id);
            const studs = Store.enrolledStudents(s.Subject_id);
            let p = 0, t = 0;
            studs.forEach((st) => { const x = Store.attendanceStats(s.Subject_id, st); p += x.present; t += x.total; });
            lectures += sess.length; present += p; total += t;
            const rate = t ? Math.round(((t - p) / t) * 100) : 0;
            return `<tr><td><b>#${s.Subject_id}</b></td><td>${esc(s.Subject_Name)}</td><td><span class="badge ${s.term === "First" ? "green" : "red"}">${s.term === "First" ? "الترم الأول" : "الترم الثاني (غير متاح)"}</span></td><td>${esc(s.Credits)}</td><td>${studs.length}</td><td>${sess.length}</td><td>${t ? `<span class="badge ${rate > parseInt(DB.maxAllowedAbsentRate, 10) ? "red" : "green"}">${rate}%</span>` : "—"}</td></tr>`;
        }).join("");
        const avg = total ? 100 - Math.round(((total - present) / total) * 100) : 0;
        const open = subs.map((s) => Store.openSessionOf(s.Subject_id)).filter(Boolean).length;
        return `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-info"><b>${subs.length}</b><span>موادي</span></div></div>
                <div class="stat-card"><div class="stat-icon">🗓️</div><div class="stat-info"><b>${lectures}</b><span>محاضرات مسجلة</span></div></div>
                <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-info"><b>${avg}%</b><span>متوسط الحضور</span></div></div>
                <div class="stat-card"><div class="stat-icon">📡</div><div class="stat-info"><b>${open}</b><span>محاضرات مفتوحة الآن</span></div></div>
            </div>
            <div class="full-card">
                <div class="card-header">المواد المسندة إليك</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>الكود</th><th>المادة</th><th>الفصل</th><th>الساعات</th><th>الطلاب</th><th>المحاضرات</th><th>متوسط الغياب</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>
            </div>`;
    },

    /* ---------- المحاضرات و QR ---------- */
    sessions() {
        const sid = this.curSid();
        if (sid === null) return this.noSubjects();
        const sub = Store.subjectById(sid);
        const open = Store.openSessionOf(sid);
        let main;
        if (sub.term !== "First") {
            main = `<div class="empty-box">الفصل الدراسي الثاني غير متاح حالياً، لا يمكن بدء محاضرات لهذه المادة.</div>`;
        } else if (open) {
            main = this.activePanel(open, sub) + this.liveList(open, sid);
        } else {
            const next = Math.max(0, ...Store.sessionsOf(sid).map((s) => s.lecture_no)) + 1;
            main = `<div class="start-box">
                <p>لا توجد محاضرة مفتوحة لهذه المادة. عند البدء سيظهر رمز QR يتغير كل 20 ثانية ويبقى التسجيل متاحًا ${Store.SESSION_MINUTES} دقائق.</p>
                <button class="btn sm" onclick="DoctorUI.start()">▶ بدء المحاضرة رقم ${next}</button>
            </div>`;
        }
        const history = Store.sessionsOf(sid).slice().reverse().map((s) => {
            const studs = Store.enrolledStudents(sid);
            const p = studs.filter((st) => Store.attendanceOf(s.id, st.Student_id) === "present").length;
            const isOpen = Store.isOpen(s);
            return `<tr><td><b>محاضرة رقم ${s.lecture_no}</b></td><td>${esc(s.date)}</td><td><span class="badge ${isOpen ? "gold" : "blue"}">${isOpen ? "مفتوحة" : "مغلقة"}</span></td><td>${p} من ${studs.length}</td></tr>`;
        }).join("");
        return `
            <div class="full-card">
                <div class="card-header toolbar"><span>المحاضرات وQR الحضور</span>${this.picker()}</div>
                ${main}
            </div>
            <div class="full-card">
                <div class="card-header">محاضرات المادة السابقة</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>المحاضرة</th><th>التاريخ</th><th>الحالة</th><th>الحاضرون</th></tr></thead>
                    <tbody>${history || `<tr><td colspan="4" class="c">لا توجد محاضرات بعد</td></tr>`}</tbody>
                </table></div>
            </div>`;
    },

    activePanel(s, sub) {
        return `
            <div class="qr-panel">
                <div class="qr-box"><canvas id="qrCanvas" width="260" height="260"></canvas></div>
                <div class="qr-info">
                    <h3>${esc(sub.Subject_Name)} — محاضرة رقم ${s.lecture_no}</h3>
                    <div class="timer-row">
                        <span class="pill" id="slotTimer">—</span>
                        <span class="pill gold" id="sessionTimer">—</span>
                    </div>
                    <p class="muted">اعرض هذه الشاشة للطلاب. الرمز يتجدد تلقائيًا، ولن يُقبل رمز قديم. افتح حساب طالب في تبويب/نافذة أخرى لتجربة المسح.</p>
                    <label class="mini-label">نص الرمز الحالي (للصق اليدوي في صفحة الطالب)</label>
                    <input class="input" id="tokenText" readonly dir="ltr" />
                    <div style="margin-top:12px;">
                        <button class="btn sm danger" onclick="DoctorUI.close('${s.id}')">⏹ إنهاء المحاضرة</button>
                    </div>
                </div>
            </div>`;
    },

    liveList(s, sid) {
        const rows = Store.enrolledStudents(sid).map((st) => {
            const rec = (DB.attendance[s.id] || {})[st.Student_id];
            const present = rec && rec.status === "present";
            const when = rec && rec.at && rec.at.length > 10 ? new Date(rec.at).toLocaleTimeString("ar-EG") : "—";
            return `<tr><td><b>${esc(st.Student_name)}</b><div class="sub-line">${st.Student_id}</div></td>
                <td>${present ? '<span class="badge green">حاضر</span>' : '<span class="badge gold">لم يُسجَّل بعد</span>'}</td>
                <td>${rec ? methodBadge(rec.method) : "—"}</td><td>${esc(when)}</td>
                <td><button class="btn sm ghost" onclick="DoctorUI.toggle('${s.id}', ${st.Student_id})">${present ? "تحويل لغائب" : "تسجيل حضور يدوي"}</button></td></tr>`;
        }).join("");
        const count = Store.enrolledStudents(sid).filter((st) => Store.attendanceOf(s.id, st.Student_id) === "present").length;
        return `
            <div class="card-header" style="margin-top:22px;">الحضور المباشر (يتحدث تلقائيًا) — ${count} حاضر</div>
            <div class="table-wrap"><table style="margin-bottom:0;">
                <thead><tr><th>الطالب</th><th>الحالة</th><th>الطريقة</th><th>الوقت</th><th>إجراء</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>`;
    },

    afterSessions() {
        const sid = this.curSid();
        const open = sid === null ? null : Store.openSessionOf(sid);
        if (!open) return;
        const tick = () => {
            Store.sync();
            const s = DB.sessions.find((x) => x.id === open.id);
            if (!s || !Store.isOpen(s)) { UI.toast("انتهت المحاضرة."); return show("sessions", true); }
            const token = Store.tokenFor(s);
            if (token !== this.lastToken) {
                this.lastToken = token;
                const cv = $("qrCanvas");
                if (cv) QRLib.toCanvas(cv, token, 260);
                const tt = $("tokenText");
                if (tt) tt.value = token;
            }
            const left = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
            if ($("slotTimer")) $("slotTimer").textContent = `الرمز يتجدد بعد ${Math.ceil(Store.msToNextSlot() / 1000)} ث`;
            if ($("sessionTimer")) $("sessionTimer").textContent = `التسجيل يغلق بعد ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        };
        this.lastToken = null;
        tick();
        Live.every(1000, tick);
    },

    start() {
        const sid = this.curSid();
        if (UI.attempt(() => Store.startSession(sid), "تم بدء المحاضرة — الـ QR جاهز ✔")) show("sessions");
    },

    close(sessionId) {
        UI.confirm("هل تريد إنهاء المحاضرة؟ لن يستطيع الطلاب التسجيل بعدها (ويمكنك التعديل اليدوي من سجل الحضور).", () => {
            Store.closeSession(sessionId);
            UI.toast("تم إنهاء المحاضرة.");
            show("sessions");
        }, "إنهاء المحاضرة");
    },

    toggle(sessionId, studentId) {
        Store.sync();
        const now = Store.attendanceOf(sessionId, studentId);
        const ok = UI.attempt(() => Store.markAttendance(sessionId, studentId, now === "present" ? "absent" : "present"));
        if (ok) show(CURRENT_VIEW, true);
    },

    /* ---------- سجل الحضور ---------- */
    attendance() {
        const sid = this.curSid();
        if (sid === null) return this.noSubjects();
        return `
            <div class="full-card">
                <div class="card-header toolbar"><span>سجل حضور الطلاب — اضغط على الخلية لتعديل الحالة</span>${this.picker()}</div>
                ${attendanceMatrixHtml(sid, { editable: true })}
            </div>`;
    },

    /* ---------- الدرجات ---------- */
    grades() {
        const sid = this.curSid();
        if (sid === null) return this.noSubjects();
        const sub = Store.subjectById(sid);
        if (sub.term !== "First") {
            return `<div class="full-card"><div class="card-header toolbar"><span>الدرجات</span>${this.picker()}</div><div class="empty-box">الفصل الدراسي الثاني غير متاح حالياً.</div></div>`;
        }
        const input = (st, field) => {
            const v = Store.gradeOf(sid, st.Student_id)[field];
            return `<input class="grade-input" type="number" min="0" max="${Store.MAX[field]}" step="0.5" value="${v === null ? "" : v}" placeholder="—" onchange="DoctorUI.grade(${sid}, ${st.Student_id}, '${field}', this)" />`;
        };
        const rows = Store.enrolledStudents(sid).map((st) => {
            const g = Store.gradeOf(sid, st.Student_id);
            const t = Store.gradeTotal(g);
            return `<tr><td><b>${esc(st.Student_name)}</b><div class="sub-line">${st.Student_id}</div></td>
                <td>${input(st, "midterm")} <small>/ ${Store.MAX.midterm}</small></td>
                <td>${input(st, "coursework")} <small>/ ${Store.MAX.coursework}</small></td>
                <td>${input(st, "final")} <small>/ ${Store.MAX.final}</small></td>
                <td id="gt-${sid}-${st.Student_id}"><b>${t === null ? "—" : t}</b></td>
                <td id="gl-${sid}-${st.Student_id}">${this.letterBadge(g)}</td></tr>`;
        }).join("");
        return `
            <div class="full-card">
                <div class="card-header toolbar"><span>رصد الدرجات — تُحفظ تلقائيًا عند التعديل</span>${this.picker()}</div>
                <div class="table-wrap"><table style="margin-bottom:0;">
                    <thead><tr><th>الطالب</th><th>ميدتيرم</th><th>أعمال السنة</th><th>النهائي</th><th>المجموع</th><th>التقدير</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>
                <p class="legend">اترك الخانة فارغة لو لم تُرصد الدرجة بعد. التقدير يظهر بعد رصد الدرجات الثلاث.</p>
            </div>`;
    },

    letterBadge(g) {
        const l = Store.gradeLetter(g);
        return `<span class="badge ${l === "F" ? "red" : l === "—" ? "" : "green"}">${l}</span>`;
    },

    grade(sid, studentId, field, el) {
        const ok = UI.attempt(() => Store.setGrade(sid, studentId, field, el.value));
        const g = Store.gradeOf(sid, studentId);
        if (!ok) { el.value = g[field] === null ? "" : g[field]; return; }
        const t = Store.gradeTotal(g);
        $(`gt-${sid}-${studentId}`).innerHTML = `<b>${t === null ? "—" : t}</b>`;
        $(`gl-${sid}-${studentId}`).innerHTML = this.letterBadge(g);
        UI.toast("تم حفظ الدرجة ✔");
    }
};

ROLES.doctor = {
    label: "دكتور",
    sub: "لوحة الدكتور",
    views: [
        { id: "overview", icon: "📊", label: "نظرة عامة" },
        { id: "sessions", icon: "📡", label: "المحاضرات وQR الحضور" },
        { id: "attendance", icon: "✅", label: "سجل الحضور" },
        { id: "grades", icon: "📝", label: "رصد الدرجات" }
    ],
    live: ["sessions", "attendance"],
    render: {
        overview: () => DoctorUI.overview(),
        sessions: () => DoctorUI.sessions(),
        attendance: () => DoctorUI.attendance(),
        grades: () => DoctorUI.grades()
    },
    after: { sessions: () => DoctorUI.afterSessions() }
};
