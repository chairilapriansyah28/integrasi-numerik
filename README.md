# NumeriCalc — Kalkulator Metode Numerik
> Project Mata Kuliah Metode Numerik

## 🗂️ Struktur Proyek

```
numerical-calculator/
├── frontend/
│   ├── index.html       ← Halaman utama
│   ├── style.css        ← Styling (CSS Variables, dark theme)
│   └── app.js           ← Logic: API call, visualisasi Canvas, history
│
└── backend/
    ├── pom.xml          ← Maven dependencies
    └── src/
        └── main/java/com/numeri/calc/
            ├── NumeriCalcApplication.java      ← Entry point Spring Boot
            ├── controller/
            │   └── IntegrationController.java  ← REST endpoint
            ├── service/
            │   └── IntegrationService.java     ← Logika metode numerik
            ├── dto/
            │   ├── IntegrationRequest.java     ← Input DTO
            │   └── IntegrationResponse.java    ← Output DTO
            ├── util/
            │   └── FunctionParser.java         ← Parser ekspresi matematika
            └── exception/
                └── GlobalExceptionHandler.java ← Error handling
```

---

## Alur Kerja (Flow)

```
User Input (f(x), a, b, n, method)
        │
        ▼
   [Frontend - app.js]
   Validasi input sisi client
        │
        ▼ POST /api/integration/calculate
   [IntegrationController]
   Terima request, delegasi ke Service
        │
        ▼
   [IntegrationService]
   ├── Validasi bounds (a < b)
   ├── Parse fungsi (FunctionParser)
   └── Pilih metode:
       ├── rectangleRule() → Kaidah Segiempat
       └── midpointRule()  → Kaidah Titik Tengah
        │
        ▼
   [IntegrationResponse]
   { result, h, n, method, steps[], errorEstimate }
        │
        ▼ JSON Response
   [Frontend - renderResult()]
   ├── Tampilkan hasil dengan animasi
   ├── Update stats (h, n, error)
   ├── Render langkah-langkah
   ├── Gambar grafik (Canvas API)
   └── Simpan ke history (localStorage)
```

---

##  Metode Numerik yang Diimplementasikan

### 1. Kaidah Segiempat (Rectangle Rule)

```
I ≈ h · Σ f(xᵢ)
h = (b - a) / n

Kiri  : xᵢ = a + i·h       (i = 0, 1, ..., n-1)
Kanan : xᵢ = a + (i+1)·h   (i = 0, 1, ..., n-1)
```
- **Error global**: O(h)
- **Cocok untuk**: n besar, fungsi sederhana

### 2. Kaidah Titik Tengah (Midpoint Rule)

```
I ≈ h · Σ f(xᵢ₊½)
xᵢ₊½ = a + (i + 0.5)·h   (i = 0, 1, ..., n-1)
```
- **Error global**: O(h²)
- **Lebih akurat** dari segiempat biasa dengan jumlah evaluasi yang sama

---

##  Cara Menjalankan

### Backend (Spring Boot)
```bash
cd backend
mvn clean install
mvn spring-boot:run
# Server berjalan di http://localhost:8080
```

### Frontend
```bash
cd frontend
# Buka langsung di browser, atau gunakan server lokal:
npx serve .
# Buka http://localhost:3000
```

---

## 🔌 API Endpoints

| Method | URL | Deskripsi |
|--------|-----|-----------|
| POST | /api/integration/calculate | Hitung integrasi |
| GET  | /api/integration/health | Cek status server |
| GET  | /api/integration/methods | Daftar metode |

### Contoh Request
```json
#POST /api/integration/calculate
{
  "function": "x^2",
  "lowerBound": 0,
  "upperBound": 2,
  "n": 100,
  "method": "midpoint",
  "variant": "left"
}
```

### Contoh Response
```json
{
  "result": 2.6668,
  "h": 0.02,
  "n": 100,
  "method": "midpoint",
  "errorEstimate": 0.00003,
  "steps": [
    { "index": 1, "xi": "0.010000", "fxi": "0.000100" },
    ...
  ]
}
```

---

##  Fitur Unggulan

| Fitur | Deskripsi |
|-------|-----------|
|  Dark UI | Desain futuristik dengan tema dark & neon |
|  Grafik Real-time | Visualisasi batang + kurva dengan Canvas API |
|  Konvergensi | Grafik error vs n untuk membuktikan konvergensi |
|  Step-by-step | Tampilkan langkah perhitungan per subinterval |
|  Riwayat | Simpan & export hasil ke CSV / TXT |
|  Offline Mode | Jika backend mati, hitung langsung di browser |
|  Error Estimasi | Estimasi error otomatis via Richardson Extrapolation |
|  Preset Fungsi | Tombol cepat untuk fungsi umum |

---

##  Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Canvas API |
| Backend | Java 17, Spring Boot 3.2, Maven |
| Parser | Recursive Descent Expression Parser (custom) |
| Storage | localStorage (riwayat) |
