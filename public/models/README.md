# Ikon GLB

Letakkan file .glb ASLI di folder ini dengan nama persis:
- ai.glb — ikon AI / LLM
- game.glb — ikon Game Server
- automation.glb — ikon Automation
- financial.glb — ikon Financial

Saat ini belum ada file .glb asli, jadi loader di src/hero3d.js
akan mengabaikan 404/error dan situs tetap jalan (kartu skill di DOM tetap tampil).
Jangan menaruh file teks kosong berekstensi .glb — itu bukan GLB valid.
