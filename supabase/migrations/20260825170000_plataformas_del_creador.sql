-- Más formatos para el pipeline del creador.
--
-- `content_platform` tenía tres valores (instagram, tiktok, reels) porque nació
-- para el pipeline de Q·OS, donde el equipo publica en esas tres. El tablero
-- del creador comparte la columna y se queda corto: quien graba unas Stories o
-- una tanda de fotos no tiene dónde ponerlas.
--
-- Es aditivo a propósito: no se renombra ni se borra nada, así que las tareas y
-- los `content_items` que ya existen siguen exactamente igual. Q·OS y McLovin
-- ofrecen sus opciones desde constantes propias (`PLATAFORMAS` en agente.ts),
-- no desde el enum, así que ninguno de los dos empieza a mostrar valores nuevos
-- por su cuenta.
--
-- Nota: el campo mezcla dos ejes —Reel/Stories/Fotos son FORMATOS, TikTok e
-- Instagram y Facebook son REDES—. Se deja así porque es como lo piensa el
-- creador al planificar ("esto es un reel", "esto va a Facebook"), pero si
-- algún día hay que cruzar formato × red, esta es la columna que hay que
-- partir en dos.

alter type public.content_platform add value if not exists 'stories';
alter type public.content_platform add value if not exists 'photos';
alter type public.content_platform add value if not exists 'facebook';
