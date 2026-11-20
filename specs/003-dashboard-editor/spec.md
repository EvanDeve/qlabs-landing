# Spec 003 — Dashboard del editor y panel de editores

**Estado:** aprobada por Evan (v2) · **Fecha:** 2026-11-18

## 1. Contexto y por qué

La agencia quiere **ir adelantada en edición**: como mínimo, editar un mes antes de que se publique. No se está logrando. Hoy se edita casi siempre lo que sale ese mismo día, y eso deja al equipo sin margen.

Con tres editores, la meta es que **cada uno termine 8 videos por día, de lunes a viernes**, con el trabajo repartido parejo. Hoy nada de eso se ve ni se reparte:

- **El Dashboard es igual para todos.** Un editor entra y tiene que ir al Pipeline a buscar qué le toca, sin saber cuánto lleva.
- **Nadie reparte.** En noviembre, 106 de 152 videos del board de video no tenían responsable.
- **No queda registro de cuándo un video llegó a Terminado**, así que no se puede contar cuántos terminó cada uno ni armar un historial.
- **Un editor nuevo puede no ver nada.** El editor que se sumó el 2026-11-18 no es miembro del board de video, y con los permisos actuales no ve ninguna tarjeta.

Medido en prod el 2026-11-18, lo que frena ir adelantado no es solo de los editores:
- **Hay 121 tarjetas en Por editar**: 51 de noviembre, 46 atrasadas de septiembre y octubre, y 24 sin fecha.
- **En los cronogramas hay 706 videos planificados para diciembre y 579 para enero**, pero todavía **no tienen tarjeta**, porque la tarjeta nace cuando el cliente aprueba el mes. Aunque los editores quisieran adelantarse, hoy no tienen de dónde agarrar.
- **La capacidad no alcanza para diciembre.** Tres editores a 8 por día son unos 500 videos por mes, y diciembre tiene 706 planificados.

Qué se busca:
1. Que cada editor sepa al abrir Q·OS qué le toca hoy y cuánto lleva de la meta.
2. Que el reparto lo haga el sistema, empezando siempre por lo que se publica antes, para que el equipo vaya ganando distancia.
3. Que los directores vean si los editores cumplen, y **cuántos días de adelanto** lleva cada uno.

Ya existe una "agenda por persona" (la que arma el recordatorio diario por WhatsApp). Esta funcionalidad reusa su criterio de pendiente y terminado, no inventa otro.

## 2. Decisiones de Evan (2026-11-18)

| Tema | Decisión |
|---|---|
| El día del editor | **No es la fecha de publicación.** Son los videos que tiene asignados en su fila, empezando por los de publicación más cercana. Así, cumplir la meta todos los días hace que el equipo se vaya adelantando. |
| Quién asigna | **El sistema, cada mañana de lunes a viernes**, parejo entre los editores. El jefe de editores (o un director) puede reasignar a mano, y un editor puede ponerse como responsable desde la ficha. |
| Qué entra en la fila | **Cualquier video en Por editar** del board de video, grabado o no. |
| Cronogramas pendientes | **No entran.** Se edita solo lo que el cliente aprobó, que es lo que ya tiene tarjeta. El panel muestra cuánto está trabado esperando aprobación. |
| Cuándo cuenta para la meta | Cuando el video **llega a Terminado** (o más adelante, a Publicado). Mandarlo a Revisión **no** cuenta. |
| La meta | **8 terminados por día hábil**, igual para todos los editores. |
| Lo atrasado | Lo que ya se tendría que haber publicado y sigue sin terminar **aparece arriba de todo**. |
| Fines de semana | El sistema no reparte ni mide la meta sábado ni domingo. Un video con fecha de fin de semana entra en la fila como cualquier otro. No asignarle fechas de fin de semana a los videos es una regla del equipo, no del sistema. |
| Directores | **Panel de editores** con: hoy, historial por día, totales y cumplimiento por semana y por mes, y días de adelanto. |

## 3. Alcance

**Dentro**
- El reparto automático de cada mañana.
- La vista del editor en el Dashboard: su fila, lo atrasado y el avance contra la meta.
- El registro del momento en que cada video llega a Terminado.
- El panel de editores para directores.
- Que todo editor activo pueda ver el board de video.

**Fuera**
- El rol "jefe de editores". Hasta que se defina, reasignan los directores desde el Pipeline o la ficha (ver P-01).
- Repartir videos de cronogramas sin aprobar.
- Repartir según lo que tarda cada video, o según su tipo (grabado o voice over).
- Una meta configurable por editor o por día.
- Contar los videos devueltos por el cliente.
- Avisar o bloquear fechas de fin de semana.
- Historial anterior al día en que esto salga a prod (ver CL-08).
- Cambios en el recordatorio de WhatsApp.

## 4. Glosario

- **Editor:** miembro activo del equipo con rol de editor.
- **Video:** tarjeta del board de video del Pipeline.
- **Día hábil:** de lunes a viernes, en hora de Costa Rica.
- **Disponible:** video en Por editar y sin responsable.
- **Fila del editor:** sus videos del board de video que todavía no llegaron a Terminado, en cualquier columna (Por editar, En curso, En revisión…), en orden de reparto (RF-05). *(Corregido por Evan el 2026-11-20: antes era solo Por editar, y el video se le borraba al pasarlo a En curso.)*
- **Terminado:** el video está en Terminado o en una columna posterior (Publicado).
- **Momento de terminado:** cuándo el video entró por última vez a Terminado o a una columna posterior, viniendo de una anterior.
- **Terminados del día (de un editor):** videos que lo tienen como responsable y cuyo momento de terminado cae ese día.
- **Atrasado:** video con fecha de publicación anterior a hoy que todavía no está terminado.
- **Días de adelanto (de un editor):** cuántos días faltan para la fecha de publicación del primer video de su fila con fecha. Si ese video está atrasado, da negativo y se muestra como "N días de atraso". Si no tiene ninguno con fecha, no se calcula.

## 5. Requisitos funcionales

### Registro de terminado
- **RF-01** CUANDO un video pasa de una columna anterior a Terminado (o a una posterior), EL SISTEMA registra ese momento en el video, entre por la puerta que entre (el Pipeline, la ficha, McLovin).
- **RF-02** CUANDO un video terminado vuelve a una columna anterior a Terminado, EL SISTEMA borra su momento de terminado. Así deja de contar como terminado, también el día en que se había registrado.
- **RF-03** CUANDO un video pasa de Terminado a Publicado, EL SISTEMA conserva el momento de terminado original.

### Reparto automático
- **RF-04** CUANDO empieza un día hábil, a una hora fija antes de la jornada (ver P-02), EL SISTEMA reparte los videos disponibles entre los editores activos.
- **RF-05** EL SISTEMA reparte en este orden: primero los atrasados, después los que tienen fecha de publicación, de la más cercana a la más lejana, y por último los que no tienen fecha.
- **RF-06** EL SISTEMA le completa a cada editor hasta 8 videos pendientes en su fila. Si le quedaron 3 sin terminar del día anterior, ese día recibe 5 nuevos. Si ya tiene 8 o más, no recibe ninguno. Lo que está en una columna que espera al cliente (hoy En revisión) no cuenta como pendiente: una demora del cliente no le frena el trabajo (Evan, 2026-11-20).
- **RF-07** EL SISTEMA reparte parejo: cada video siguiente va al editor que en ese momento tiene menos pendientes en su fila. Si empatan, va a cualquiera de ellos en un orden fijo.
- **RF-08** CUANDO el sistema le asigna un video a un editor, EL SISTEMA lo deja como responsable de la tarjeta, igual que si se lo hubiera puesto una persona.
- **RF-09** SI no alcanzan los disponibles para darle 8 a todos, ENTONCES EL SISTEMA reparte los que hay con el mismo criterio, y ese día algún editor queda con menos de 8.
- **RF-10** EL SISTEMA no toca los videos que ya tienen responsable, ni los que están fuera de Por editar, ni los de otros boards.
- **RF-11** SI el reparto de un día no corrió (por una falla), ENTONCES CUANDO corre el siguiente reparto EL SISTEMA reparte con el estado de ese momento, sin repartir dos veces lo que faltó.
- **RF-12** EL SISTEMA no reparte sábado ni domingo.

### Vista del editor (Dashboard)
- **RF-13** CUANDO un editor abre el Dashboard, EL SISTEMA le muestra su vista de editor en vez del Dashboard de la agencia.
- **RF-14** EL SISTEMA muestra el avance del día con el formato "llevás N de 8": N son sus terminados del día.
- **RF-15** MIENTRAS el día no es hábil, EL SISTEMA muestra los terminados del día sin la meta de 8 ni el avance contra ella.
- **RF-16** EL SISTEMA muestra la fila del editor en el orden de RF-05. Cada video muestra en qué columna está, cliente, título, fecha de publicación, plataforma, si está grabado, y cuántos días faltan para publicarse. Abrirlo lleva a la ficha.
- **RF-17** SI el editor tiene atrasados en su fila, ENTONCES EL SISTEMA los muestra destacados arriba de todo, con los días de atraso de cada uno.
- **RF-18** EL SISTEMA muestra también, como terminados, los videos que el editor terminó hoy, para que vea lo que ya completó.
- **RF-19** EL SISTEMA muestra los días de adelanto del editor.
- **RF-20** SI la fila del editor está vacía, ENTONCES EL SISTEMA lo dice en un estado vacío, y si hay videos disponibles indica cuántos.
- **RF-21** EL SISTEMA calcula "hoy" y "día hábil" en hora de Costa Rica. Después de la medianoche de Costa Rica, la próxima vez que se carga la vista ya muestra el día nuevo. Una pestaña que quedó abierta no se actualiza sola.
- **RF-22** EL SISTEMA no le muestra al editor las vistas ni los datos de la agencia del Dashboard actual (estado de las cuentas, meta del mes por cliente).

### Acceso
- **RF-23** EL SISTEMA da acceso al board de video a todo editor activo, aunque nadie lo haya agregado a mano como miembro.

### Panel de editores
- **RF-24** EL SISTEMA ofrece a los directores un panel de editores dentro de Q·OS. Nadie más lo puede abrir.
- **RF-25** EL SISTEMA muestra en el panel, por editor: terminados de hoy contra 8, videos pendientes en su fila, atrasados y días de adelanto.
- **RF-26** EL SISTEMA muestra en el panel el historial por día de cada editor de los últimos días hábiles: terminados de cada día y si llegó a 8.
- **RF-27** EL SISTEMA muestra en el panel, por editor y por semana y por mes: el total de terminados, la meta del período (8 × días hábiles del período) y el porcentaje de cumplimiento.
- **RF-28** MIENTRAS el período está en curso, EL SISTEMA calcula su meta solo con los días hábiles ya transcurridos, hoy incluido.
- **RF-29** EL SISTEMA cuenta los terminados para el editor que es responsable del video en el momento de mirar (ver CL-05 y P-03).
- **RF-30** EL SISTEMA muestra en el panel, para todo el equipo:
  - cuántos videos disponibles quedan sin repartir;
  - cuántos de esos están atrasados;
  - cuántos videos de cronogramas sin aprobar están esperando para nacer como tarjeta, por mes.
- **RF-31** EL SISTEMA muestra en el panel a todos los editores activos, también a los que hoy tienen cero.
- **RF-32** EL SISTEMA no cuenta para el historial ni para el cumplimiento los días anteriores a la salida de esta funcionalidad, y lo dice en el panel.

## 6. Casos límite

- **CL-01 — Ida y vuelta en el mismo día:** el video llega a Terminado, vuelve a Por editar y vuelve a Terminado. Cuenta una sola vez, con el último momento.
- **CL-02 — Devuelto otro día:** terminado el lunes y devuelto el martes. El lunes deja de contarlo; vuelve a la fila del mismo editor, porque conserva el responsable.
- **CL-03 — Arrastre por varias columnas:** de Por editar directo a Publicado. Cuenta como terminado en ese momento.
- **CL-04 — Un video que nace terminado:** se crea directamente en Terminado o Publicado. No cuenta.
- **CL-05 — Reasignación después de terminado:** el terminado se cuenta para el responsable actual, así que reasignar videos viejos cambia el historial.
- **CL-06 — El cliente tarda en aprobar la edición:** como cuenta Terminado y no Revisión, un editor puede quedar debajo de 8 por demoras del cliente, y el video le cuenta el día en que se aprueba. Es lo que Evan eligió.
- **CL-07 — Un editor desactivado:** no recibe más reparto y sale del panel. Sus videos pendientes quedan con él como responsable hasta que alguien los reasigne (ver P-04).
- **CL-08 — Videos que ya estaban terminados cuando sale esto:** no tienen momento de terminado y no cuentan en ningún historial.
- **CL-09 — Un editor de vacaciones o enfermo:** el sistema le sigue completando hasta 8, que se quedan quietos (ver P-05).
- **CL-10 — Un video sin grabar en la fila:** entra igual, porque Evan eligió no exigir grabación. La fila muestra si está grabado o no para que el editor lo vea.
- **CL-11 — Un director con rol de editor:** el rol del equipo es uno solo. Un director ve el Dashboard de la agencia y el panel, no recibe reparto.
- **CL-12 — Un video que va y vuelve de En revisión:** nunca sale de la fila del editor. Mientras está en En revisión no cuenta en sus 8 pendientes; al volver a Por editar o En curso, sí (RF-06).
- **CL-13 — Más de 8 terminados en un día:** el avance puede pasar de 8 ("llevás 10 de 8").
- **CL-14 — Un editor que se pone como responsable a mano:** el video entra en su fila y cuenta en sus pendientes para el reparto del día siguiente.
- **CL-15 — Una tarjeta que nace de un cronograma aprobado a mitad del día:** queda disponible y entra en el reparto de la mañana siguiente. Alguien puede tomarla antes desde la ficha.
- **CL-16 — El primer reparto:** con 121 tarjetas en Por editar y 3 editores, la primera mañana se reparten 24. Los atrasados de septiembre y octubre salen primero, así que el editor arranca viendo atrasados (ver P-06).

## 7. Preguntas abiertas

- **P-01 — Jefe de editores:** ¿es un rol nuevo o un editor con un permiso extra? ¿Ve el panel? ¿Reasigna desde una pantalla propia? Va en su propia spec. Mientras tanto reasignan los directores.
- **P-02 — Hora del reparto:** yo propongo las 6:00 de Costa Rica.
- **P-03 — Quién lo terminó:** ¿alcanza con el responsable actual (CL-05), o hay que guardar quién era el responsable cuando se terminó?
- **P-04 — Pendientes de alguien que se va:** ¿los videos de un editor desactivado vuelven solos a disponibles?
- **P-05 — Ausencias:** ¿hace falta pausar a un editor para que no reciba reparto mientras no está?
- **P-06 — Los atrasados de septiembre y octubre:** son 46 tarjetas en Por editar con fecha que ya pasó. ¿Se editan igual, o el equipo las limpia antes del primer reparto para que el arranque no sea de puro atraso?
- **P-07 — Cuántos días de historial:** propongo las últimas 2 semanas hábiles.
