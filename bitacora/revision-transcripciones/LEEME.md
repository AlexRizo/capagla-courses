# Revisión de las transcripciones (cómo repetirla)

Las transcripciones automáticas de `bitacora/transcripciones/` se corrigieron con esto. Si el cliente
vuelve a exportarlas, se puede repetir desde la raíz del proyecto:

```
python3 bitacora/revision-transcripciones/apply.py /tmp/transcripciones-corregidas   # aplica y valida
python3 bitacora/revision-transcripciones/report.py /tmp/transcripciones-corregidas   # regenera el informe
cp /tmp/transcripciones-corregidas/*.vtt prisma/data/transcripciones/
```

- `corr_01.py` … `corr_05.py`: las correcciones puntuales (archivo, texto equivocado, texto correcto, motivo)
  y las dudas para la chef. Cada corrección puntual debe caer **exactamente una vez** y dentro de un solo
  subtítulo, o `apply.py` se detiene sin escribir nada.
- `apply.py`: aplica las correcciones puntuales, las reglas por archivo y las reglas ortográficas de todo el curso.
- Sin carpeta de salida (`apply.py` a secas) solo comprueba.
- Resultado de la primera revisión: ver `bitacora/correcciones-transcripciones.md`.
