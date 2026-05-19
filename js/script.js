const BASE_URL = "https://notes-management-system-1-jf7k.onrender.com";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getToken()    { return localStorage.getItem("token"); }
function getRole()     { return localStorage.getItem("role"); }
function getUsername() { return localStorage.getItem("username"); }

function requireAuth(expectedRole) {
    const token = getToken();
    const role  = getRole();
    if (!token) { window.location.href = "login.html"; return false; }
    if (expectedRole && role !== expectedRole) {
        window.location.href = role === "admin" ? "admin.html" : "index.html";
        return false;
    }
    return true;
}

function toast(msg, type = "success") {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3400);
}

function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function currentPage() {
    const p = window.location.pathname.toLowerCase();
    if (p.includes("admin"))                                  return "admin";
    if (p.includes("createnote"))                             return "create";
    if (p.includes("notedetail") || p.includes("note-detail")) return "detail";
    if (p.includes("index") || p.endsWith("/") || p === "/") return "index";
    if (p.includes("login"))                                  return "login";
    if (p.includes("register"))                               return "register";
    return "other";
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE — role toggle
// ─────────────────────────────────────────────────────────────────────────────

let selectedRole = "user";

function setRole(role) {
    selectedRole = role;

    document.getElementById("btn-user").className  = "role-btn" + (role === "user"  ? " active-user"  : "");
    document.getElementById("btn-admin").className = "role-btn" + (role === "admin" ? " active-admin" : "");

    const loginBtn = document.getElementById("login-btn");

    if (role === "admin") {
        document.getElementById("login-title").textContent = "Admin sign in";
        document.getElementById("login-sub").textContent   = "Restricted access";
        loginBtn.className     = "btn btn-admin";
        loginBtn.style.cssText = "width:100%;justify-content:center;padding:13px;";
        document.getElementById("login-footer").innerHTML  = "";
    } else {
        document.getElementById("login-title").textContent = "Welcome back";
        document.getElementById("login-sub").textContent   = "Sign in to your notes";
        loginBtn.className     = "btn btn-primary";
        loginBtn.style.cssText = "width:100%;justify-content:center;padding:13px;";
        document.getElementById("login-footer").innerHTML  = 'No account? <a href="register.html">Create one</a>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

async function register() {
    const name     = document.getElementById("name").value.trim();
    const password = document.getElementById("password").value;
    if (!name || !password) { toast("Please fill in all fields.", "error"); return; }

    try {
        const res = await fetch(`${BASE_URL}/api/auth/register/user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password })
        });
        if (res.ok) {
            toast("Account created! Redirecting…");
            setTimeout(() => window.location.href = "login.html", 1100);
        } else {
            toast("Registration failed. Username may be taken.", "error");
        }
    } catch { toast("Cannot reach server.", "error"); }
}

async function login() {
    const name     = document.getElementById("name").value.trim();
    const password = document.getElementById("password").value;
    if (!name || !password) { toast("Please fill in all fields.", "error"); return; }

    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password })
        });

        const data = await res.json();
        if (!res.ok) { toast("Invalid username or password.", "error"); return; }

        const prefix = "Token: ";
        const idx    = data.message ? data.message.indexOf(prefix) : -1;
        if (idx === -1) { toast("Login error: no token received.", "error"); return; }
        const token = data.message.substring(idx + prefix.length);

        let roles = [];
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            roles = payload.roles || [];
        } catch { toast("Login error: invalid token.", "error"); return; }

        const isAdmin = roles.some(r => r === "ROLE_ADMIN");
        const isUser  = roles.some(r => r === "ROLE_USER");

        if (selectedRole === "admin" && !isAdmin) {
            toast("Access denied. Not an admin account.", "error"); return;
        }
        if (selectedRole === "user" && isAdmin) {
            toast("Admin account detected. Redirecting…");
            localStorage.setItem("token",    token);
            localStorage.setItem("role",     "admin");
            localStorage.setItem("username", data.username || name);
            setTimeout(() => window.location.href = "admin.html", 900);
            return;
        }
        if (!isAdmin && !isUser) {
            toast("Unrecognized account role.", "error"); return;
        }

        localStorage.setItem("token",    token);
        localStorage.setItem("role",     isAdmin ? "admin" : "user");
        localStorage.setItem("username", data.username || name);

        window.location.href = isAdmin ? "admin.html" : "index.html";

    } catch { toast("Cannot reach server.", "error"); }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "login.html";
}

// ─────────────────────────────────────────────────────────────────────────────
// USER — notes list  (index.html)
// ─────────────────────────────────────────────────────────────────────────────

async function loadNotesList() {
    if (!requireAuth("user")) return;

    const el = document.getElementById("nav-username");
    if (el) el.textContent = getUsername() || "";

    try {
        const res = await fetch(`${BASE_URL}/api/notes`, {
            headers: { Authorization: "Bearer " + getToken() }
        });
        if (res.status === 401) { logout(); return; }

        const notes     = await res.json();
        const container = document.getElementById("notes-container");
        const countEl   = document.getElementById("note-count");

        countEl.textContent = notes.length === 0
            ? "No notes yet"
            : `${notes.length} note${notes.length === 1 ? "" : "s"}`;

        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <h3>Nothing here yet</h3>
                    <p>Create your first note to get started.</p>
                    <a href="createNote.html" class="btn btn-primary">+ New note</a>
                </div>`;
            return;
        }

        let html = '<div class="notes-grid">';
        notes.forEach((n, i) => {
            const preview = n.content
                ? n.content.slice(0, 80) + (n.content.length > 80 ? "…" : "")
                : "No content";
            html += `
                <a class="note-card" href="noteDetail.html?id=${n.id}" style="animation-delay:${i * 0.05}s">
                    <div class="note-card-body">
                        <div class="note-card-title">${escHtml(n.title)}</div>
                        <div class="note-card-preview">${escHtml(preview)}</div>
                    </div>
                    <span class="note-card-arrow">›</span>
                </a>`;
        });
        html += "</div>";
        container.innerHTML = html;

    } catch {
        document.getElementById("notes-container").innerHTML =
            `<div class="empty-state"><p style="color:var(--accent)">Failed to load notes. Is the server running?</p></div>`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// USER — create note  (createNote.html)
// ─────────────────────────────────────────────────────────────────────────────

async function createNote() {
    if (!requireAuth("user")) return;

    const title   = document.getElementById("title").value.trim();
    const content = document.getElementById("content").value.trim();
    if (!title) { toast("Please add a title.", "error"); return; }

    try {
        const res = await fetch(`${BASE_URL}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
            body: JSON.stringify({ title, content })
        });
        if (res.status === 401) { logout(); return; }
        if (res.ok || res.status === 201) {
            toast("Note saved!");
            setTimeout(() => window.location.href = "index.html", 900);
        } else {
            toast("Failed to save note.", "error");
        }
    } catch { toast("Cannot reach server.", "error"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// USER — note detail  (noteDetail.html)
// ─────────────────────────────────────────────────────────────────────────────

let currentNote = null;

async function loadNoteDetail() {
    if (!requireAuth("user")) return;

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { window.location.href = "index.html"; return; }

    try {
        const res = await fetch(`${BASE_URL}/api/notes/${id}`, {
            headers: { Authorization: "Bearer " + getToken() }
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { window.location.href = "index.html"; return; }

        currentNote = await res.json();
        document.getElementById("loader").style.display     = "none";
        document.getElementById("view-mode").style.display  = "block";
        document.getElementById("view-title").textContent   = currentNote.title;
        document.getElementById("view-content").textContent = currentNote.content;
        document.title = `${currentNote.title} — Notis`;

    } catch { toast("Failed to load note.", "error"); }
}

function enterEditMode() {
    document.getElementById("edit-title").value   = currentNote.title;
    document.getElementById("edit-content").value = currentNote.content;
    document.getElementById("view-mode").style.display = "none";
    document.getElementById("edit-mode").style.display = "block";
}

function cancelEdit() {
    document.getElementById("edit-mode").style.display = "none";
    document.getElementById("view-mode").style.display = "block";
}

async function saveEdit() {
    const title   = document.getElementById("edit-title").value.trim();
    const content = document.getElementById("edit-content").value.trim();
    if (!title) { toast("Title cannot be empty.", "error"); return; }

    try {
        const res = await fetch(`${BASE_URL}/api/notes/${currentNote.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
            body: JSON.stringify({ title, content })
        });
        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            currentNote.title   = title;
            currentNote.content = content;
            document.getElementById("view-title").textContent   = title;
            document.getElementById("view-content").textContent = content;
            document.title = `${title} — Notis`;
            cancelEdit();
            toast("Note updated!");
        } else {
            toast("Failed to update note.", "error");
        }
    } catch { toast("Cannot reach server.", "error"); }
}

async function confirmDelete() {
    if (!confirm(`Delete "${currentNote.title}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${BASE_URL}/api/notes/${currentNote.id}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + getToken() }
        });
        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            toast("Note deleted.");
            setTimeout(() => window.location.href = "index.html", 900);
        } else {
            toast("Failed to delete note.", "error");
        }
    } catch { toast("Cannot reach server.", "error"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — dashboard  (admin.html)
// ─────────────────────────────────────────────────────────────────────────────

async function loadAllNotes() {
    if (!requireAuth("admin")) return;

    const el = document.getElementById("nav-admin-name");
    if (el) el.textContent = getUsername() || "";

    const container = document.getElementById("admin-container");
    container.innerHTML = '<div class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';

    try {
        const res = await fetch(`${BASE_URL}/api/admin/notes`, {
            headers: { Authorization: "Bearer " + getToken() }
        });
        if (res.status === 401) { logout(); return; }
        if (res.status === 403) { toast("Access denied.", "error"); logout(); return; }

        const notes       = await res.json();
        const uniqueUsers = new Set(notes.map(n => n.appUser?.username || n.username || "unknown")).size;
        document.getElementById("stat-total").textContent = notes.length;
        document.getElementById("stat-users").textContent = uniqueUsers;

        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>No notes in the system</h3>
                    <p>Notes will appear here once users create them.</p>
                </div>`;
            return;
        }

        let rows = "";
        notes.forEach((n, i) => {
            const owner   = n.appUser?.username || n.username || "—";
            const preview = (n.content || "").slice(0, 100) + ((n.content || "").length > 100 ? "…" : "");
            rows += `
                <tr style="animation:fadeUp .3s ease ${i * 0.04}s both">
                    <td style="width:40px;color:var(--ink-3);font-size:0.8rem;">${n.id}</td>
                    <td class="td-title">${escHtml(n.title)}</td>
                    <td class="td-content">${escHtml(preview)}</td>
                    <td><span class="td-user">${escHtml(owner)}</span></td>
                    <td style="text-align:right;">
                        <button class="btn btn-danger btn-sm" onclick="adminDeleteNote(${n.id}, '${escHtml(n.title)}')">🗑 Delete</button>
                    </td>
                </tr>`;
        });

        container.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>#</th><th>Title</th><th>Content preview</th><th>Owner</th><th></th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

    } catch {
        container.innerHTML = `<div class="empty-state"><p style="color:var(--accent)">Failed to load notes. Is the server running?</p></div>`;
    }
}

async function adminDeleteNote(id, title) {
    if (!confirm(`Delete note "${title}"?\nThis cannot be undone.`)) return;
    try {
        const res = await fetch(`${BASE_URL}/api/admin/notes/${id}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + getToken() }
        });
        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            toast(`Deleted: ${title}`);
            loadAllNotes();
        } else {
            toast("Failed to delete note.", "error");
        }
    } catch { toast("Cannot reach server.", "error"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO INIT
// ─────────────────────────────────────────────────────────────────────────────

const page = currentPage();
if (page === "index")  loadNotesList();
if (page === "detail") loadNoteDetail();
if (page === "create") requireAuth("user");
if (page === "admin")  loadAllNotes();