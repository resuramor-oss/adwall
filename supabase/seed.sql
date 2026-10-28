-- ============================================================================
--  AdWall — optional starter ads
--
--  Run this after schema.sql if you want the wall to look populated on day one.
--  Safe to run once; the ids are fixed so a second run changes nothing.
--
--  Delete these later from Table Editor → ads, or hide them with:
--     update public.ads set hidden = true where seller like '%';
-- ============================================================================

insert into public.ads
  (id, title, seller, category, price, unit, description, contact, emoji, gradient, owner_token, created_at)
values
  ('11111111-1111-4111-8111-000000000001', 'Chocolate chip cookies, box of 6', 'Mia''s Bakes', 'Food', 120, 'per box',
   'Freshly baked every afternoon. Soft center, slightly crisp edges, loaded with chocolate. Pick up at the covered court after class or meet at the gate.',
   'Messenger: @miabakes · 0917 555 0123', '🍪', 'linear-gradient(150deg, #fde9c9, #f6cf9a)',
   '00000000-0000-4000-8000-000000000000', now() - interval '3 hours'),

  ('11111111-1111-4111-8111-000000000002', 'Printing, lamination, and binding', 'Kuya J''s Prints', 'Services', 3, 'per page',
   'Colored or black and white printing, plus lamination and simple binding for projects and research papers. Send your file the night before and pick it up at recess.',
   'Messenger: @kuyajprints', '🖨️', 'linear-gradient(150deg, #dbe7f5, #b9cfe8)',
   '00000000-0000-4000-8000-000000000000', now() - interval '8 hours'),

  ('11111111-1111-4111-8111-000000000003', 'Preloved tops and jeans', 'Thrift Finds', 'Fashion', 150, 'each',
   'Curated ukay pieces, washed and steamed before posting. Sizes S to L. New drops every Sunday — message me for the full album.',
   'Instagram: @thriftfinds.ph', '👕', 'linear-gradient(150deg, #f5dfe8, #e8bccf)',
   '00000000-0000-4000-8000-000000000000', now() - interval '20 hours'),

  ('11111111-1111-4111-8111-000000000004', 'ABM reviewer notes (PDF)', 'Notes & Niche', 'Digital', 99, 'per subject',
   'Handwritten-style reviewer notes for Fundamentals of ABM, converted to a clean PDF. Covers the whole quarter with practice items and answer keys.',
   'Messenger: @notesandniche', '📚', 'linear-gradient(150deg, #e3e0f7, #c7c0ee)',
   '00000000-0000-4000-8000-000000000000', now() - interval '26 hours'),

  ('11111111-1111-4111-8111-000000000005', 'Snacks and cold drinks', 'Sari-Sari Corner', 'Food', 20, 'each',
   'Chips, biscuits, and iced drinks kept cold in a cooler. Open from 7am to 5pm near the covered walkway. Bulk orders for group projects are welcome.',
   'Look for the blue cart · 0928 441 7788', '🥤', 'linear-gradient(150deg, #d7ecdc, #a9d6b8)',
   '00000000-0000-4000-8000-000000000000', now() - interval '32 hours'),

  ('11111111-1111-4111-8111-000000000006', 'Handmade beaded bracelets', 'Bead & Bloom', 'Crafts', 80, 'each',
   'Beaded bracelets made to order — pick your colors and letter charm. Good for matching with friends or as a small gift. Takes 2 days to make.',
   'Messenger: @beadandbloom', '📿', 'linear-gradient(150deg, #fbe5d6, #f3c3ab)',
   '00000000-0000-4000-8000-000000000000', now() - interval '44 hours'),

  ('11111111-1111-4111-8111-000000000007', 'Graduation and ID photos', 'Lens by Ren', 'Services', 350, 'per set',
   'Natural-light portraits with basic retouching, taken on campus. Includes 5 edited photos sent within 48 hours. Bring your own outfit; toga available for borrowing.',
   'Messenger: @lensbyren', '📷', 'linear-gradient(150deg, #dfe6ec, #b9c6d4)',
   '00000000-0000-4000-8000-000000000000', now() - interval '52 hours'),

  ('11111111-1111-4111-8111-000000000008', 'Math tutoring, 1 hour', 'Study Hub', 'Services', 200, 'per hour',
   'One-on-one tutoring for General Math and Statistics. We go through your actual homework and past quizzes, not generic handouts. Small group rates available.',
   'Messenger: @studyhub.ph', '✏️', 'linear-gradient(150deg, #dfe9f7, #bed3ec)',
   '00000000-0000-4000-8000-000000000000', now() - interval '60 hours'),

  ('11111111-1111-4111-8111-000000000009', 'Milk tea, large cup', 'Milk Tea Club', 'Food', 75, 'per cup',
   'Wintermelon, Okinawa, and brown sugar variants with pearls cooked fresh each batch. Delivery inside campus for orders of 5 cups or more.',
   'Messenger: @milkteaclub', '🧋', 'linear-gradient(150deg, #f0e3d6, #dcc0a7)',
   '00000000-0000-4000-8000-000000000000', now() - interval '66 hours'),

  ('11111111-1111-4111-8111-000000000010', 'Laptop and journal stickers', 'Inkwell Stickers', 'Crafts', 40, 'each',
   'Matte vinyl stickers, weatherproof and easy to peel. Over 30 designs including hand-lettered study quotes and small doodles. Mix and match 5 for ₱150.',
   'Messenger: @inkwellstickers', '🏷️', 'linear-gradient(150deg, #e5e0f2, #c9c2e6)',
   '00000000-0000-4000-8000-000000000000', now() - interval '74 hours'),

  ('11111111-1111-4111-8111-000000000011', 'Succulents in painted pots', 'The Plant Shelf', 'Crafts', 120, 'per pot',
   'Small succulents in hand-painted terracotta pots. Low maintenance, good for dorm desks. Repotting tips included — message me if it looks sad.',
   'Messenger: @theplantshelf', '🪴', 'linear-gradient(150deg, #dcecd9, #b3d4ad)',
   '00000000-0000-4000-8000-000000000000', now() - interval '80 hours'),

  ('11111111-1111-4111-8111-000000000012', '2x2 ID pictures, 8 copies', 'Pixel Prints', 'Services', 60, 'per sheet',
   'White or blue background, printed on glossy photo paper. Walk in with a photo and get the sheet in 15 minutes. Bring your own file for a discount.',
   'Messenger: @pixelprints · 0905 223 6644', '🪪', 'linear-gradient(150deg, #e8eaee, #c8ced6)',
   '00000000-0000-4000-8000-000000000000', now() - interval '92 hours')
on conflict (id) do nothing;
