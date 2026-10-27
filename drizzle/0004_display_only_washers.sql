-- Washers 3 and 4 exist for the floor status board demo only: they stay out of order.
INSERT INTO washers (id, name, location, state) VALUES
  ('3', '3번 세탁기', '기숙사 세탁실', 'OUT_OF_ORDER'),
  ('4', '4번 세탁기', '기숙사 세탁실', 'OUT_OF_ORDER')
ON CONFLICT (id) DO NOTHING;
