# 🎵 WebDAW — FL Studio Inspired Web DAW

Modern, dark themed Web Digital Audio Workstation (DAW) built with HTML/CSS/JS + Node.js.

## 🚀 Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Sunucuyu başlat
npm start

# 3. Tarayıcıda aç
# http://localhost:3000
```

## 🎛️ Özellikler

### Step Sequencer
- 8 kanallı varsayılan drum pattern (Kick, Snare, Hi-Hat, Tom, Clap, Bass, Crash...)
- 8 / 16 / 32 adımlık sequencer
- Swing kontrolü
- Drag-to-draw (tıkla ve sürükle ile adım çiz)
- Sağ-tık context menu (rename, duplicate, clear, delete, fill, randomize)

### Ses Motoru (Web Audio API)
- Yerleşik drum synthesizer (sample olmadan çalışır!)
- .wav / .mp3 / .ogg sample yükleme
- BPM kontrolü (40-300)
- Per-channel volume & pan
- Master compressor + analyser

### Mixer
- Her kanal için fader
- VU meter animasyonları
- Mute / Solo butonları

### Piano Roll
- 128 MIDI nota desteği
- Canvas tabanlı nota editörü
- Nota çizme ve silme
- Önizleme sesi

### Browser
- 4 kategori: Drums, Synth, Bass, FX
- Kullanıcı sample yükleme
- Drag & Drop (browser → channel)
- Arama filtresi

### Proje Yönetimi
- **Local Save**: JSON dosyası olarak indir
- **Local Load**: JSON dosyasından yükle
- **Server Save**: `POST /api/save-project`
- **Server Load**: `GET /api/get-projects`

## ⌨️ Klavye Kısayolları

| Tuş | İşlev |
|-----|-------|
| `Space` | Play / Stop |
| `Home` | Rewind |
| `↑ / ↓` | BPM +1 / -1 |
| `Shift + ↑/↓` | BPM +10 / -10 |
| `Ctrl/Cmd + S` | Projeyi kaydet |

## 🔌 API Endpoints

```
POST   /api/save-project     → Proje kaydet
GET    /api/get-projects     → Tüm projeleri listele
GET    /api/project/:id      → Proje getir
DELETE /api/project/:id      → Proje sil
GET    /api/health           → Sunucu durumu
```

### Örnek API Kullanımı (Frontend fetch)

```javascript
// Kaydet
const res = await fetch('/api/save-project', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sequencer.toJSON())
});

// Listele
const { projects } = await fetch('/api/get-projects').then(r => r.json());

// Yükle
const project = await fetch(`/api/project/${id}`).then(r => r.json());
sequencer.fromJSON(project);
```

## 📁 Proje Yapısı

```
webdaw/
├── public/
│   ├── index.html          ← Ana HTML
│   ├── css/
│   │   └── style.css       ← FL Studio dark theme
│   └── js/
│       ├── audio-engine.js ← Web Audio API motoru
│       ├── sequencer.js    ← Step sequencer + clock
│       ├── mixer.js        ← Mixer panel
│       ├── piano-roll.js   ← Piano roll editörü
│       ├── project.js      ← Save/Load yönetimi
│       ├── ui.js           ← UI render modülü
│       └── app.js          ← Ana uygulama
├── server/
│   └── index.js            ← Express.js backend
├── data/
│   └── projects.json       ← JSON database (otomatik oluşur)
└── package.json
```
