# Ideas — backlog de mejoras para Q·OS

Ideas discutidas con el equipo que quedan en pausa. No implementar sin discutirlo primero.

## Métricas reales de videos publicados (views, likes, etc.)

**Origen:** reunión con el equipo (julio 2026). Quieren ver información real de cada
video que se publica por marca: visualizaciones y demás métricas relevantes.

### Camino A — carga manual con histórico (primer paso, barato)

- Tabla `content_metrics`: snapshots por pieza con fecha
  (`piece_id`, `recorded_at`, `views`, `likes`, `comments`, `saves`, `shares`).
- En el detalle de cada pieza publicada, un mini-form para registrar las métricas.
- Como son snapshots con fecha, se ve la evolución del video en el tiempo
  (ej: a los 7 días, a los 30 días).
- El equipo ya pega la `final_url` del video publicado, así que el flujo es natural.

### Camino B — integración con APIs oficiales (automático, proyecto grande)

- **Instagram (Graph API de Meta):** requiere cuenta Business/Creator del cliente
  vinculada a página de Facebook + app de Meta con permisos de insights aprobados
  en app review. Viable si Q Labs administra las cuentas vía Meta Business Suite,
  pero implica OAuth por cliente, refresh de tokens y un cron de sincronización.
- **TikTok (TikTok for Developers):** cada cuenta del cliente debe autorizar la
  app; también tiene app review.
- Sin atajos: el oEmbed público no expone views, y el scraping es frágil y viola
  términos de servicio.

### Recomendación

Construir el Camino A con el modelo de datos pensado para el B: la tabla de
snapshots es la misma la escriba un humano o un cron. Cuando el volumen lo
justifique, la integración escribe en las mismas filas y la UI no cambia.
