"""
descargar_libs.py — Descarga las librerias JS minificadas para uso offline.
Ejecutar UNA SOLA VEZ al instalar el dashboard en una PC con internet.
Despues, el dashboard funciona offline con doble clic en index.html.
"""
import urllib.request
import os
import sys

LIBS = {
    "apexcharts.min.js": "https://cdn.jsdelivr.net/npm/apexcharts@3.49.1/dist/apexcharts.min.js",
    "xlsx.full.min.js":  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    "lucide.min.js":     "https://cdn.jsdelivr.net/npm/lucide@0.378.0/dist/umd/lucide.min.js",
    "jspdf.umd.min.js":  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "html2canvas.min.js":"https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
}

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "libs")
os.makedirs(DEST, exist_ok=True)

print(f"Descargando {len(LIBS)} librerias en {DEST}\n")
ok = 0
for nombre, url in LIBS.items():
    destino = os.path.join(DEST, nombre)
    try:
        print(f"  -> {nombre} ... ", end="", flush=True)
        urllib.request.urlretrieve(url, destino)
        size_kb = os.path.getsize(destino) / 1024
        print(f"OK ({size_kb:.1f} KB)")
        ok += 1
    except Exception as e:
        print(f"ERROR: {e}")

print(f"\n{ok}/{len(LIBS)} librerias descargadas.")
if ok < len(LIBS):
    print("Algunas librerias fallaron. Revisa la conexion a internet.")
    sys.exit(1)
print("Listo. Ya podes abrir index.html con doble clic.")
