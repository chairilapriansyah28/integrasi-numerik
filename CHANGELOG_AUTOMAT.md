# Changelog - Integrasi Numerik Auto n

## Versi: Modified (Otomatis n)

### 🔄 Perubahan Utama

#### 1. **Input n Menjadi Otomatis**
   - **SEBELUM**: User harus secara manual mengatur jumlah subinterval (n) menggunakan slider atau input field
   - **SESUDAH**: Sistem otomatis menghitung nilai n yang optimal berdasarkan toleransi error target (ε)

#### 2. **Input Toleransi Sebagai Parameter Utama**
   - **BARU**: Input field untuk "Toleransi Error Target (ε)" sekarang menjadi input utama
   - Nilai default: `0.001`
   - User dapat mengubah toleransi untuk mendapatkan nilai n yang berbeda
   - Semakin kecil toleransi → semakin besar n yang dihasilkan (lebih akurat)

#### 3. **Display Otomatis untuk n**
   - **BARU**: Ditampilkan dua informasi:
     - **Nilai n**: Jumlah subinterval yang sudah dihitung otomatis
     - **Status**: Menunjukkan status perhitungan (Optimal, Gagal, Dari riwayat)
   - Display ini bersifat read-only (tidak dapat diubah secara manual)

### 📋 File yang Dimodifikasi

#### `src/main/resources/static/index.html`
- **Dihapus**:
  - Slider untuk input n (range 1-100)
  - Input field manual untuk n
  - Bagian "CARI N OPTIMAL" (optional search button)
  
- **Ditambahkan**:
  - Input field untuk toleransi error target (ε)
  - Display area untuk nilai n otomatis (baca saja)
  - Status indicator untuk perhitungan n

#### `src/main/resources/static/js/app.js`
- **Ditambahkan Fungsi Baru**:
  - `calculateOptimalN(func, a, b, tolerance)`: Menghitung n optimal secara otomatis berdasarkan toleransi
    - Menggunakan algoritma binary search untuk efisiensi
    - Mendukung semua metode: Segiempat, Titik Tengah, Trapesium
  
- **Dimodifikasi Fungsi**:
  - `calculate()`: Sekarang menggunakan `calculateOptimalN()` untuk mendapatkan n sebelum menghitung integral
    - Menampilkan status "Menghitung n optimal..." saat proses
    - Update display dengan nilai n yang sudah dihitung
  
  - `reloadHistory(id)`: Update untuk menampilkan n dari riwayat di display otomatis
  
- **Dihapus Fungsi** (sudah tidak diperlukan):
  - `updateN()`: Fungsi slider synchronization
  - `syncSlider()`: Fungsi input synchronization
  - `findOptimalN()`: Manual search (sekarang dilakukan otomatis)
  - `showOptimalNError()`: Error display untuk manual search
  - `applyOptimalN()`: Apply result dari manual search

#### `src/main/resources/static/css/style.css`
- **Ditambahkan Style**:
  - `.input-hint`: Style untuk hint text di bawah input field
  - `.auto-n-display`: Grid layout untuk menampilkan n otomatis dan status
  - Styling untuk stat-card dalam konteks auto-n-display

### 🎯 Alur Kerja Baru

```
1. User masukkan:
   - Fungsi f(x)
   - Batas bawah (a) dan atas (b)
   - Toleransi error target (ε)
   - Pilih metode integrasi

2. User klik "HITUNG INTEGRAL"

3. Sistem otomatis:
   - Menghitung n optimal menggunakan algoritma binary search
   - Mencari nilai n minimum yang memenuhi: error(n) ≤ ε
   - Menampilkan nilai n di display otomatis
   - Mengirim request ke server dengan n yang sudah dihitung

4. Server memproses dan menampilkan hasil
```

### 💡 Keuntungan Perubahan

1. **Lebih User-Friendly**: User tidak perlu bingung tentang berapa nilai n yang seharusnya digunakan
2. **Adaptive**: Sistem secara otomatis menyesuaikan n berdasarkan akurasi yang diinginkan
3. **Konsisten**: Semua perhitungan menggunakan nilai n yang telah divalidasi
4. **Efisien**: Menggunakan nilai n minimum yang cukup untuk mencapai toleransi target
5. **Transparan**: User dapat melihat nilai n yang digunakan dalam hasil perhitungan

### ⚙️ Konfigurasi

#### Toleransi Default
- Nilai default: `0.001` (0.1%)
- Dapat diubah sesuai kebutuhan akurasi:
  - `0.01` (1%) - Akurasi rendah, n kecil, cepat
  - `0.001` (0.1%) - Akurasi sedang, n sedang, seimbang
  - `0.0001` (0.01%) - Akurasi tinggi, n besar, lebih lambat

#### Batas Maksimal n
- Hardcoded: `100,000` (MAX_N)
- Dapat dimodifikasi di fungsi `calculateOptimalN()` jika diperlukan

### 🧪 Testing Rekomendasi

1. **Fungsi Sederhana**: Test dengan `x^2` atau `sin(x)`
2. **Berbagai Toleransi**: Coba dengan nilai ε yang berbeda untuk melihat perubahan n
3. **Metode Berbeda**: Verifikasi bahwa semua metode (Segiempat, Titik Tengah, Trapesium) bekerja dengan baik
4. **Riwayat**: Pastikan reload dari riwayat menampilkan n dengan benar

### 📝 Catatan Penting

- Perubahan ini tidak mempengaruhi logika backend di Java
- Server masih menerima parameter `n` seperti sebelumnya, hanya sekarang nilai n dihitung di frontend
- History masih mencatat nilai n yang digunakan
- Semua fitur lainnya (visualisasi, teori, export) tetap bekerja normal

---
**Modified**: 2024
**Status**: ✅ Siap Digunakan
