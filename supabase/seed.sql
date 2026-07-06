-- Seed data para desarrollo local (supabase db reset).
-- Crea usuarios de auth.users directamente con contraseña fija 'demo1234'
-- para poder iniciar sesión localmente con cualquiera de estos emails.

do $$
declare
  v_admin uuid := '00000000-0000-0000-0000-000000000001';

  v_zonna uuid          := '00000000-0000-0000-0000-0000000000a1';
  v_kosta uuid          := '00000000-0000-0000-0000-0000000000a2';
  v_arboleda uuid       := '00000000-0000-0000-0000-0000000000a3';
  v_snowty uuid         := '00000000-0000-0000-0000-0000000000a4';
  v_dulce_chilena uuid  := '00000000-0000-0000-0000-0000000000a5';
  v_entrecot uuid       := '00000000-0000-0000-0000-0000000000a6';

  v_vale uuid    := '00000000-0000-0000-0000-0000000000b1';
  v_pura uuid    := '00000000-0000-0000-0000-0000000000b2';
  v_carlos uuid  := '00000000-0000-0000-0000-0000000000b3';

  v_campaign_brunch uuid := '00000000-0000-0000-0000-0000000000c1';
  v_campaign_ramen uuid  := '00000000-0000-0000-0000-0000000000c2';
  v_campaign_draft uuid  := '00000000-0000-0000-0000-0000000000c3';

  v_users uuid[] := array[
    v_admin, v_zonna, v_kosta, v_arboleda, v_snowty, v_dulce_chilena, v_entrecot,
    v_vale, v_pura, v_carlos
  ];
  v_emails text[] := array[
    'admin@qlabsmethod.com',
    'zonna@example.com', 'kosta@example.com', 'arboleda@example.com',
    'snowty@example.com', 'dulcechilena@example.com', 'entrecot@example.com',
    'vale@example.com', 'pura@example.com', 'carlos@example.com'
  ];
  v_names text[] := array[
    'Q Labs Admin',
    'Zonna', 'Kosta Asiatika', 'La Arboleda', 'Snowty', 'Dulce Chilena', 'Entrecot',
    'Vale Creates', 'Pura Vida Foodie', 'Carlos Review'
  ];
  i int;
begin
  for i in 1 .. array_length(v_users, 1) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_users[i], 'authenticated', 'authenticated',
      v_emails[i], crypt('demo1234', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_names[i]),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at
    ) values (
      v_users[i], v_users[i], v_users[i]::text,
      jsonb_build_object('sub', v_users[i]::text, 'email', v_emails[i]),
      'email', now(), now(), now()
    );
  end loop;

  -- roles + display data (handle_new_user already inserted bare profiles rows)
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'brand', city = 'San José' where id = any(array[
    v_zonna, v_kosta, v_arboleda, v_snowty, v_dulce_chilena, v_entrecot
  ]);
  update public.profiles set role = 'creator' where id = any(array[v_vale, v_pura, v_carlos]);
  update public.profiles set city = 'San José' where id in (v_vale, v_carlos);
  update public.profiles set city = 'Heredia' where id = v_pura;

  insert into public.brand_profiles (profile_id, brand_name, industry, description) values
    (v_zonna, 'Zonna', 'Gastrobar', 'Gastrobar en Escazú con propuesta de brunch y coctelería de autor.'),
    (v_kosta, 'Kosta Asiatika', 'Restaurante asiático', 'Restaurante de cocina asiática contemporánea.'),
    (v_arboleda, 'La Arboleda', 'Restaurante', 'Experiencia de brunch al aire libre.'),
    (v_snowty, 'Snowty', 'Postres', 'Postres y helados artesanales.'),
    (v_dulce_chilena, 'Dulce Chilena', 'Repostería', 'Repostería chilena tradicional.'),
    (v_entrecot, 'Entrecot', 'Fine dining', 'Experiencia de fine dining y cortes premium.');

  insert into public.creator_profiles (profile_id, handle, followers_count, niches, instagram_handle, tiktok_handle, rate_min, rate_max, verified) values
    (v_vale, '@vale.creates', 12400, array['food', 'lifestyle'], '@vale.creates', '@vale.creates', 80000, 150000, true),
    (v_pura, '@pura.vida.foodie', 8100, array['food'], '@pura.vida.foodie', null, 60000, 110000, false),
    (v_carlos, '@carlosreview.cr', 22000, array['reviews', 'restaurantes'], '@carlosreview.cr', '@carlosreview.cr', 100000, 180000, true);

  insert into public.campaigns (id, brand_id, title, brief, budget_amount, deliverables, target_audience, deadline_days, status, published_at) values
    (v_campaign_brunch, v_zonna, 'Reel de brunch de domingo',
      'Mostrá la experiencia de brunch de domingo en Zonna: mood relajado, coctelería de autor, mesa completa.',
      150000, '[{"type":"reel","qty":1},{"type":"stories","qty":3}]',
      'Food & lifestyle, GAM, 5K+ seguidores', 15, 'published', now()),
    (v_campaign_ramen, v_kosta, 'UGC unboxing nuevo menú ramen',
      'Unboxing del nuevo menú de ramen: primer bocado, textura, reacción genuina.',
      120000, '[{"type":"tiktok","qty":1}]',
      'Food, GAM, 3K+ seguidores', 10, 'published', now());

  insert into public.campaigns (id, brand_id, title, brief, budget_amount, deliverables, target_audience, deadline_days, status) values
    (v_campaign_draft, v_entrecot, 'Experiencia fine dining',
      'Cena de degustación completa, ángulo de sobremesa y maridaje.',
      200000, '[{"type":"reel","qty":1},{"type":"photos","qty":5}]',
      'Food, 10K+ seguidores', 20, 'draft');
end $$;
