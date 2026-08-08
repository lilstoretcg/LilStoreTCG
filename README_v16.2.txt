LilStore TCG v16.2 - Códigos especiales de Vendetta

Corrección realizada:
- El importador de catálogo ahora admite identificadores alfanuméricos después del prefijo de set, siempre que contengan un número.
- Esto incluye VEN-SP1 a VEN-SP6 y futuros códigos como VEN-SP12A, sin una lista manual de cartas.
- Se conserva el soporte existente para códigos numéricos y de runas (por ejemplo, OGN-001 y SFD-R01A).
- La sincronización de precios, la auditoría DotGG y la restauración de respaldos usan la misma regla de código.

Causa anterior:
- La validación anterior permitía solo una letra opcional antes de dos o tres dígitos; por ello VEN-SP1 se descartaba antes de llegar al filtro del set Vendetta.
- El filtro de sets ya incluía VEN/Vendetta y no fue modificado.

Verificación después del deploy:
1. Abrir /admin.html.
2. Presionar Actualizar catálogo DotGG.
3. Filtrar Vendetta y buscar VEN-SP.
4. Confirmar que aparecen las cartas especiales disponibles en DotGG.
