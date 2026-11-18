/* Story Digital — community uploads
   1. Follow SETUP.md to create a free Supabase project.
   2. Paste your Project URL and anon key below.
   Until then the page runs in DEMO MODE (nothing is saved after refresh). */

const CONFIG = {
  SUPABASE_URL: "https://cpbyimcohmjlcasjaiir.supabase.co",       // e.g. https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_vp_7rOKjKLPkGwzhoNfYiw_plvk6qLh",  // the "anon public" key (safe to put in a website)
  BUCKET: "stories"
};

(function () {
  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED = { pdf: "application/pdf", txt: "text/plain" };

  const form = document.getElementById("upload-form");
  const statusEl = document.getElementById("upload-status");
  const listEl = document.getElementById("community-list");
  const noteEl = document.getElementById("community-note");
  if (!form) return;

  const live = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
  const demoStories = [];

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "upload-status" + (type ? " " + type : "");
  }

  function render(stories) {
    listEl.textContent = "";
    if (!stories.length) {
      noteEl.textContent = live
        ? "No community stories yet. Yours could be the first!"
        : "Demo mode: uploads are shown here until you refresh the page.";
      return;
    }
    noteEl.textContent = live ? "" : "Demo mode: uploads are shown here until you refresh the page.";
    stories.forEach(function (s) {
      const li = document.createElement("li");
      li.className = "community-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = s.title;
      const meta = document.createElement("span");
      meta.textContent = s.genre + " · by " + s.author;
      info.append(title, meta);
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Download →";
      li.append(info, a);
      listEl.append(li);
    });
  }

  async function loadStories() {
    if (!live) { render(demoStories); return; }
    const { data, error } = await sb
      .from("stories")
      .select("title, author, genre, file_path")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) {
      noteEl.textContent = "Couldn't load community stories right now.";
      return;
    }
    render(data.map(function (row) {
      return {
        title: row.title,
        author: row.author,
        genre: row.genre,
        url: sb.storage.from(CONFIG.BUCKET).getPublicUrl(row.file_path).data.publicUrl
      };
    }));
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setStatus("", "");

    const fd = new FormData(form);
    if (fd.get("website")) return; // spam trap

    const title = (fd.get("title") || "").trim();
    const author = (fd.get("author") || "").trim();
    const genre = fd.get("genre");
    const file = fd.get("file");
    const consent = document.getElementById("story-consent").checked;

    if (!title || !author || !genre) return setStatus("Please fill in the title, name and genre.", "err");
    if (!file || !file.size) return setStatus("Please choose a file to upload.", "err");

    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED[ext]) return setStatus("Only PDF or TXT files are accepted.", "err");
    if (file.size > MAX_BYTES) return setStatus("That file is over 10 MB.", "err");
    if (!consent) return setStatus("Please confirm this is your own story.", "err");

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    setStatus("Uploading…", "");

    try {
      if (!live) {
        demoStories.unshift({ title: title, author: author, genre: genre, url: URL.createObjectURL(file) });
        render(demoStories);
        setStatus("Demo mode: story shown below. Connect Supabase (see SETUP.md) to make uploads real.", "ok");
      } else {
        const path = crypto.randomUUID() + "." + ext;
        const up = await sb.storage.from(CONFIG.BUCKET).upload(path, file, { contentType: ALLOWED[ext], upsert: false });
        if (up.error) throw up.error;
        const ins = await sb.from("stories").insert({ title: title, author: author, genre: genre, file_path: path, status: "pending" });
        if (ins.error) throw ins.error;
        setStatus("Thank you! Your story was received and will appear once it has been reviewed.", "ok");
      }
      form.reset();
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong while uploading. Please try again.", "err");
    } finally {
      btn.disabled = false;
    }
  });

  loadStories();
})();
