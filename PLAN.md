# PLAN.md — Website Portofolio 3D Sultan Faiz Ar Rasyid

Profil: Programmer — AI/LLM, game server, automation, financial.
Tema: dark, responsif (uji di lebar 390px), animasi GSAP ScrollTrigger + Lenis.

## Struktur folder

```
portfolio-sultan-faiz/
├── PLAN.md
├── index.html                 # root HTML, canvas 3D fixed di hero, section-section
├── package.json               # vite, three, gsap, lenis
├── public/
│   └── models/
│       └── README.md          # BELUM ada file .glb asli; letakkan ai.glb, game.glb,
│                              # automation.glb, financial.glb asli di sini
│                              # (tanpa file asli, loader mengabaikan error dan situs tetap jalan)
# Catatan koreksi 2026-10-26: tidak ada vite.config.js (pakai default Vite,
# preview port 4173 lewat CLI) dan tidak ada file .glb placeholder.
├── src/
│   ├── main.js                # bootstrap: Lenis, GSAP, scene, input, karakter
│   ├── style.css              # dark theme, layout section, responsif 390px
│   ├── scene.js               # renderer, kamera, loop, pause saat tab hidden, DPR maks 2
│   ├── input.js               # SATU handler pointer events untuk mouse + touch
│   ├── dragon.js              # rantai segmen, verlet/IK, mengikuti pointer dengan easing
│   ├── spider.js              # badan + kaki procedural, mengikuti pointer
│   └── hero3d.js              # partikel hero + parallax + loader ikon GLB
└── dist/                      # hasil `npm run build` (di-serve di port 4173)
```

## Modul

1. **Setup** — Node 24.22.1, Vite vanilla, `three`, `gsap`, `lenis`.
2. **scene.js** — WebGLRenderer antialias, `setPixelRatio(Math.min(devicePixelRatio, 2))`,
   kamera perspektif, `requestAnimationFrame`, pause saat `document.hidden`
   (visibilitychange), resize handler.
3. **input.js** — Satu handler `pointermove`/`pointerdown` di window, normalisasi
   ke koordinat NDC (-1..1) dan posisi dunia di bidang z=0. Satu sumber kebenaran
   pointer untuk dragon, spider, dan parallax. Touch bekerja lewat Pointer Events.
4. **dragon.js** — Rantai segmen (head + body). Head mengejar pointer dengan
   easing; segmen berikutnya dijaga jaraknya lewat constraint verlet/IK
   (follow-the-leader). Render sebagai bola/silinder antar segmen + kepala.
5. **spider.js** — Badan ellipsoid + 8 kaki procedural: tiap kaki punya target
   di sekeliling badan, melangkah (angkat + maju) saat badan bergerak cukup jauh.
   Mengikuti pointer dengan easing yang sama seperti dragon.
6. **hero3d.js** — Partikel bintang/debu di hero, parallax kamera mengikuti
   pointer (kecil, agar tidak mabuk), dan daftar ikon GLB di `/public/models`
   (GLTFLoader dipakai bila file GLB asli tersedia; placeholder saat ini hanya
   penanda, bukan geometri palsu yang diklaim sebagai GLB).
7. **Section** — Hero, About, Skills, Projects, Contact. GSAP ScrollTrigger
   untuk reveal per section, Lenis untuk smooth scroll, dark theme,
   breakpoint 390px (grid jadi 1 kolom, font mengecil, canvas tetap full).

## Checklist tugas

- [x] FASE 1 — PLAN.md ditulis
- [x] FASE 2.1 — Setup: node -v, Vite, three + gsap + lenis terpasang, build lolos
- [x] FASE 2.2 — scene.js, build lolos
- [x] FASE 2.3 — input.js, build lolos
- [x] FASE 2.4 — dragon.js, build lolos
- [x] FASE 2.5 — spider.js + tombol ganti karakter, build lolos
- [x] FASE 2.6 — hero3d.js + /public/models, build lolos
- [x] FASE 2.7 — Semua section + GSAP ScrollTrigger + Lenis + responsif 390px, build lolos
- [ ] FASE 3 — `npm run build`, serve dist di 4173, firewall, `curl -I` 200

## Aturan eksekusi

Setiap modul: tulis file → `npm run build` → baca error → perbaiki →
centang PLAN.md. Jangan lanjut kalau build gagal.
