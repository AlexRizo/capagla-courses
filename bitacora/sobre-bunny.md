# Bunny.net: pendientes para David
 
Estado (10-oct-2026): los 52 videos del curso (originales 1080p, 19.07 GB) están subidos a la **librería nueva** (Library ID 776045, colección 01-CURSO-NAVIDAD). La librería vieja (775935) se descarta cuando la nueva termine de procesar.
 
## Configuración actual de la librería nueva
- Almacenamiento: Frankfurt (principal) + Los Angeles. Costo ~$0.02/GB al mes. Las regiones no se pueden quitar después.
- Delivery: High Volume ($0.005/GB, igual en todo el mundo).
- Encoding: Free (H.264). Resoluciones 480p, 720p, 1080p. Keep original files: apagado.
- Sin Premium encoding ni Transcribing.
## Por revisar (David)
- MP4 fallback: está activo y suma ~1/3 del peso. Decidir si se deja (compatibilidad con dispositivos viejos) o se apaga.
- Seguridad: restringir reproducción a capagla.com (dominios permitidos) y URLs firmadas (token auth).
- Reproductor (menú Player): ajustes e integración en el LMS.
- API key de la librería: solo en variable de entorno del servidor (BUNNY_API_KEY), nunca en el código ni en el chat.
- Subtítulos (Transcribing, $0.10 por minuto y por idioma, ~448 min de curso): decidir después del lanzamiento.
- Premium encoding ($0.05/min): no se necesita por ahora.
- Proyección de costos con 1,000 y 10,000 alumnos: ver ~17 GB por alumno que ve todo en 1080p; a $0.005/GB son ~$0.085 USD por alumno.
## Archivos (en el NAS: 01-CAPAGLA/05-PROTOTIPO/01-BUNNY)
- subir_bunny.py: sube los .mp4 y genera el reporte. Uso: `python3 subir_bunny.py AccesoBunny-nueva.txt`.
- reporte-bunny-AccesoBunny-nueva.csv: GUID de cada video (archivo ↔ GUID), estado, duración y tamaños.