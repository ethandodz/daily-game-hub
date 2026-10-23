-- Play tab, step 3: more games with friends (Word Race, Trivia Showdown,
-- Higher or Lower, Mind Meld and Dial In). Safe to run again. Needs
-- 01_wordle_duel.sql first.
-- If you ever run 01 again, run this file again after it.
--
-- Same idea as Wordle Duel: you each play your own turn (the challenger
-- can start right away), and the answers stay in the database. Your
-- opponent's details stay hidden until you're both done.
--
-- Word list: SCOWL (Copyright 2000-2016 Kevin Atkinson; free to use with
-- this notice). Trivia questions and Higher or Lower facts written for
-- this app.

-- Let duels hold the new games and their private setup.
alter table public.duels drop constraint if exists duels_game_check;
alter table public.duels add constraint duels_game_check
  check (game in ('wordle_duel', 'word_race', 'trivia', 'higher_lower', 'mind_meld', 'dial_in'));
alter table public.duels add column if not exists setup jsonb;

-- Each player's turn in a game.
create table if not exists public.versus_plays (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer not null default 0,
  time_ms integer not null default 0,
  primary key (duel_id, user_id)
);

-- Every word found, question answered or pick made.
create table if not exists public.versus_moves (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  n integer not null check (n > 0),
  served_at timestamptz not null default now(),
  answered_at timestamptz,
  answer text,
  correct boolean,
  points integer not null default 0,
  primary key (duel_id, user_id, n)
);

-- Mind Meld: the word each player said in each round.
create table if not exists public.mind_meld_words (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  round integer not null check (round between 1 and 20),
  word text not null,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id, round)
);

alter table public.mind_meld_words enable row level security;
revoke all on public.mind_meld_words from anon, authenticated;

-- Dial In: the scales (two opposite ends) and each round's clue and guess.
create table if not exists public.dial_scales (
  id integer primary key,
  left_end text not null,
  right_end text not null
);

create table if not exists public.dial_rounds (
  duel_id uuid not null references public.duels (id) on delete cascade,
  round integer not null check (round between 1 and 6),
  clue text,
  clue_at timestamptz,
  guess integer check (guess between 0 and 100),
  guessed_at timestamptz,
  points integer,
  primary key (duel_id, round)
);

alter table public.dial_scales enable row level security;
alter table public.dial_rounds enable row level security;
revoke all on public.dial_scales from anon, authenticated;
revoke all on public.dial_rounds from anon, authenticated;

create table if not exists public.word_race_seeds (
  word text primary key check (word ~ '^[a-z]{9}$')
);

create table if not exists public.trivia_questions (
  id integer primary key,
  category text not null,
  question text not null,
  choices text[] not null check (cardinality(choices) = 4)  -- the right one first
);

create table if not exists public.hl_categories (
  category text primary key,
  prompt text not null,
  unit text not null
);

create table if not exists public.hl_items (
  id integer primary key,
  category text not null references public.hl_categories (category),
  name text not null,
  value numeric not null check (value > 0)
);

alter table public.versus_plays enable row level security;
alter table public.versus_moves enable row level security;
alter table public.word_race_seeds enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.hl_categories enable row level security;
alter table public.hl_items enable row level security;
revoke all on public.versus_plays from anon, authenticated;
revoke all on public.versus_moves from anon, authenticated;
revoke all on public.word_race_seeds from anon, authenticated;
revoke all on public.trivia_questions from anon, authenticated;
revoke all on public.hl_categories from anon, authenticated;
revoke all on public.hl_items from anon, authenticated;


-- ---------- Game data ----------

insert into public.word_race_seeds (word) values
  ('abandoned'),
  ('abilities'),
  ('abolition'),
  ('accustoms'),
  ('activated'),
  ('addresses'),
  ('adjusting'),
  ('admission'),
  ('adversely'),
  ('advertise'),
  ('advisable'),
  ('advocated'),
  ('algorithm'),
  ('allegedly'),
  ('ambitious'),
  ('amusement'),
  ('announced'),
  ('anomalies'),
  ('apologies'),
  ('apologize'),
  ('apparatus'),
  ('appealing'),
  ('appearing'),
  ('applicant'),
  ('appraisal'),
  ('archiving'),
  ('arresting'),
  ('arrogance'),
  ('asterisks'),
  ('attention'),
  ('attracted'),
  ('attribute'),
  ('authentic'),
  ('authorize'),
  ('automated'),
  ('automates'),
  ('bacterium'),
  ('balancing'),
  ('barrister'),
  ('beautiful'),
  ('beginners'),
  ('biography'),
  ('biologist'),
  ('bookstore'),
  ('borrowing'),
  ('brightest'),
  ('canceling'),
  ('candidate'),
  ('capturing'),
  ('cartridge'),
  ('celebrate'),
  ('censoring'),
  ('centrally'),
  ('certainly'),
  ('challenge'),
  ('champagne'),
  ('character'),
  ('chemicals'),
  ('circulate'),
  ('clarifies'),
  ('collating'),
  ('commented'),
  ('committed'),
  ('communist'),
  ('comparing'),
  ('competent'),
  ('competing'),
  ('complaint'),
  ('component'),
  ('composite'),
  ('comprised'),
  ('computers'),
  ('concealed'),
  ('conceived'),
  ('conceives'),
  ('concluded'),
  ('conductor'),
  ('configure'),
  ('conflicts'),
  ('confronts'),
  ('confusing'),
  ('congested'),
  ('consisted'),
  ('construct'),
  ('contacted'),
  ('contained'),
  ('continual'),
  ('contracts'),
  ('convicted'),
  ('convinced'),
  ('cooperate'),
  ('copyright'),
  ('correlate'),
  ('corrupted'),
  ('countless'),
  ('crossroad'),
  ('curiously'),
  ('currently'),
  ('customers'),
  ('debugging'),
  ('decreased'),
  ('decreases'),
  ('dedicated'),
  ('delicious'),
  ('delighted'),
  ('democracy'),
  ('deranging'),
  ('described'),
  ('deserving'),
  ('designate'),
  ('detaching'),
  ('detecting'),
  ('determine'),
  ('developer'),
  ('dimension'),
  ('disagrees'),
  ('disappear'),
  ('disasters'),
  ('discharge'),
  ('discovery'),
  ('dishonest'),
  ('displayed'),
  ('distances'),
  ('documents'),
  ('dominated'),
  ('donations'),
  ('doubtless'),
  ('editorial'),
  ('education'),
  ('elections'),
  ('elephants'),
  ('emotional'),
  ('enclosing'),
  ('enforcing'),
  ('enlarging'),
  ('envisaged'),
  ('equipment'),
  ('essential'),
  ('establish'),
  ('estimated'),
  ('evaluates'),
  ('evidently'),
  ('evolution'),
  ('excluding'),
  ('exclusion'),
  ('exclusive'),
  ('exhausted'),
  ('expansion'),
  ('expensive'),
  ('expertise'),
  ('exploding'),
  ('explosion'),
  ('extension'),
  ('factories'),
  ('fascinate'),
  ('fictional'),
  ('finalized'),
  ('followers'),
  ('following'),
  ('forbidden'),
  ('foreigner'),
  ('forgotten'),
  ('formation'),
  ('formatted'),
  ('forwarded'),
  ('fractions'),
  ('governing'),
  ('graphical'),
  ('guarantee'),
  ('guideline'),
  ('happiness'),
  ('hideously'),
  ('hindsight'),
  ('horrified'),
  ('hypocrisy'),
  ('immediate'),
  ('immensely'),
  ('important'),
  ('importing'),
  ('impresses'),
  ('inclusive'),
  ('increases'),
  ('indicated'),
  ('infantile'),
  ('inflation'),
  ('inhabited'),
  ('inherited'),
  ('inserting'),
  ('inspected'),
  ('instances'),
  ('insulting'),
  ('insurance'),
  ('integrate'),
  ('intellect'),
  ('intending'),
  ('intensely'),
  ('intensity'),
  ('interests'),
  ('interface'),
  ('interrupt'),
  ('intervene'),
  ('interview'),
  ('inverting'),
  ('judgments'),
  ('justified'),
  ('landscape'),
  ('lecturers'),
  ('legendary'),
  ('licensing'),
  ('lifestyle'),
  ('listening'),
  ('literally'),
  ('magnitude'),
  ('mainframe'),
  ('malicious'),
  ('mandatory'),
  ('materials'),
  ('meanwhile'),
  ('mechanics'),
  ('megabytes'),
  ('microwave'),
  ('migrating'),
  ('ministers'),
  ('misdirect'),
  ('misguided'),
  ('misguides'),
  ('misplaces'),
  ('mistaking'),
  ('modelings'),
  ('motivates'),
  ('motorways'),
  ('mountains'),
  ('movements'),
  ('mysteries'),
  ('narrowest'),
  ('necessary'),
  ('networked'),
  ('newspaper'),
  ('nominally'),
  ('nominates'),
  ('normality'),
  ('notorious'),
  ('numerical'),
  ('objecting'),
  ('objection'),
  ('obscurity'),
  ('observers'),
  ('obstructs'),
  ('obtaining'),
  ('offerings'),
  ('operating'),
  ('oppresses'),
  ('optimized'),
  ('organized'),
  ('orienting'),
  ('originals'),
  ('originate'),
  ('otherwise'),
  ('ourselves'),
  ('outlining'),
  ('overdraft'),
  ('overheads'),
  ('ownership'),
  ('paperback'),
  ('parochial'),
  ('perceived'),
  ('perfectly'),
  ('permitted'),
  ('persuaded'),
  ('planetary'),
  ('plausible'),
  ('poisoning'),
  ('political'),
  ('populated'),
  ('populates'),
  ('positions'),
  ('postponed'),
  ('postulate'),
  ('practices'),
  ('preaching'),
  ('preceding'),
  ('preparing'),
  ('prescribe'),
  ('preserved'),
  ('preserves'),
  ('president'),
  ('pressures'),
  ('presuming'),
  ('prevented'),
  ('printouts'),
  ('prisoners'),
  ('privately'),
  ('privilege'),
  ('proceeded'),
  ('processed'),
  ('processes'),
  ('producers'),
  ('prohibits'),
  ('prolonged'),
  ('promoting'),
  ('promotion'),
  ('proposals'),
  ('prosecute'),
  ('protocols'),
  ('prototype'),
  ('publisher'),
  ('purchased'),
  ('qualities'),
  ('questions'),
  ('radiation'),
  ('rationale'),
  ('recalling'),
  ('recognize'),
  ('recommend'),
  ('reconcile'),
  ('recovered'),
  ('recursive'),
  ('recycling'),
  ('redundant'),
  ('regarding'),
  ('relatives'),
  ('releasing'),
  ('religious'),
  ('rendition'),
  ('repairing'),
  ('repeating'),
  ('reporting'),
  ('represent'),
  ('repulsive'),
  ('residents'),
  ('resorting'),
  ('resources'),
  ('respected'),
  ('restarted'),
  ('restoring'),
  ('reversing'),
  ('sacrifice'),
  ('saddening'),
  ('salvation'),
  ('sarcastic'),
  ('satisfies'),
  ('schedules'),
  ('scratched'),
  ('scrolling'),
  ('selective'),
  ('sensation'),
  ('separates'),
  ('shortened'),
  ('signaling'),
  ('slightest'),
  ('sometimes'),
  ('somewhere'),
  ('specified'),
  ('sponsored'),
  ('stability'),
  ('staggered'),
  ('stimulate'),
  ('stretched'),
  ('stripping'),
  ('structure'),
  ('struggles'),
  ('subjected'),
  ('suffering'),
  ('supervise'),
  ('suppliers'),
  ('supplying'),
  ('suspected'),
  ('suspended'),
  ('suspicion'),
  ('switching'),
  ('syntactic'),
  ('taxpayers'),
  ('temporary'),
  ('terrorism'),
  ('terrorist'),
  ('thousands'),
  ('threatens'),
  ('threshold'),
  ('thrusting'),
  ('tolerated'),
  ('translate'),
  ('traveling'),
  ('typically'),
  ('uncertain'),
  ('undefined'),
  ('undergoes'),
  ('uniformly'),
  ('unlimited'),
  ('vacancies'),
  ('vacations'),
  ('variables'),
  ('vegetable'),
  ('violation'),
  ('voluntary'),
  ('volunteer'),
  ('wandering'),
  ('withdraws'),
  ('witnessed'),
  ('witnesses'),
  ('worldwide')
on conflict do nothing;

insert into public.trivia_questions (id, category, question, choices) values
  (1, 'Geography', 'What is the capital of Australia?', array['Canberra', 'Sydney', 'Melbourne', 'Perth']),
  (2, 'Geography', 'What is the largest ocean on Earth?', array['Pacific', 'Atlantic', 'Indian', 'Arctic']),
  (3, 'Geography', 'Which country has the most people?', array['India', 'China', 'United States', 'Indonesia']),
  (4, 'Geography', 'What is the longest river in South America?', array['Amazon', 'Paraná', 'Orinoco', 'Magdalena']),
  (5, 'Geography', 'Which US state is the largest by area?', array['Alaska', 'Texas', 'California', 'Montana']),
  (6, 'Geography', 'What is the capital of Canada?', array['Ottawa', 'Toronto', 'Vancouver', 'Montreal']),
  (7, 'Geography', 'Mount Kilimanjaro is in which country?', array['Tanzania', 'Kenya', 'Uganda', 'Ethiopia']),
  (8, 'Geography', 'Which is the smallest country in the world?', array['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein']),
  (9, 'Geography', 'What is the capital of Japan?', array['Tokyo', 'Kyoto', 'Osaka', 'Hiroshima']),
  (10, 'Geography', 'The Sahara Desert is on which continent?', array['Africa', 'Asia', 'Australia', 'South America']),
  (11, 'Geography', 'Which country is home to the city of Marrakesh?', array['Morocco', 'Egypt', 'Tunisia', 'Algeria']),
  (12, 'Geography', 'What is the capital of Spain?', array['Madrid', 'Barcelona', 'Seville', 'Valencia']),
  (13, 'Geography', 'Which US state is known as the Sunshine State?', array['Florida', 'California', 'Arizona', 'Hawaii']),
  (14, 'Geography', 'How many continents are there?', array['7', '5', '6', '8']),
  (15, 'Geography', 'Which river flows through Paris?', array['Seine', 'Thames', 'Rhine', 'Danube']),
  (16, 'Geography', 'What is the capital of Italy?', array['Rome', 'Milan', 'Venice', 'Florence']),
  (17, 'Geography', 'Which country is shaped like a boot?', array['Italy', 'Greece', 'Portugal', 'Chile']),
  (18, 'Geography', 'What is the tallest mountain in the world?', array['Mount Everest', 'K2', 'Kangchenjunga', 'Denali']),
  (19, 'Geography', 'Which US state has the most people?', array['California', 'Texas', 'Florida', 'New York']),
  (20, 'Geography', 'What is the capital of Brazil?', array['Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador']),
  (21, 'Geography', 'The Great Barrier Reef is off the coast of which country?', array['Australia', 'Indonesia', 'Philippines', 'New Zealand']),
  (22, 'Geography', 'Havana is the capital of which country?', array['Cuba', 'Jamaica', 'Dominican Republic', 'Puerto Rico']),
  (23, 'Geography', 'What is the capital of Egypt?', array['Cairo', 'Alexandria', 'Luxor', 'Giza']),
  (24, 'Geography', 'Which ocean lies between Africa and Australia?', array['Indian', 'Pacific', 'Atlantic', 'Southern']),
  (25, 'Geography', 'What is the capital of Germany?', array['Berlin', 'Munich', 'Frankfurt', 'Hamburg']),
  (26, 'Geography', 'Which country is both in Europe and Asia and has Istanbul as its largest city?', array['Turkey', 'Greece', 'Russia', 'Georgia']),
  (27, 'Geography', 'Which Great Lake is the largest by area?', array['Superior', 'Michigan', 'Huron', 'Erie']),
  (28, 'Geography', 'What is the capital of South Korea?', array['Seoul', 'Busan', 'Incheon', 'Daegu']),
  (29, 'Science', 'What planet is known as the Red Planet?', array['Mars', 'Venus', 'Jupiter', 'Mercury']),
  (30, 'Science', 'What gas do plants take in from the air?', array['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium']),
  (31, 'Science', 'What is H2O better known as?', array['Water', 'Salt', 'Hydrogen peroxide', 'Ammonia']),
  (32, 'Science', 'How many bones are in the adult human body?', array['206', '186', '226', '256']),
  (33, 'Science', 'What is the largest planet in our solar system?', array['Jupiter', 'Saturn', 'Neptune', 'Earth']),
  (34, 'Science', 'What is the chemical symbol for gold?', array['Au', 'Ag', 'Gd', 'Go']),
  (35, 'Science', 'What is the hardest natural substance?', array['Diamond', 'Quartz', 'Granite', 'Steel']),
  (36, 'Science', 'Which organ pumps blood around the body?', array['Heart', 'Liver', 'Lungs', 'Kidneys']),
  (37, 'Science', 'What is the closest star to Earth?', array['The Sun', 'Proxima Centauri', 'Sirius', 'Polaris']),
  (38, 'Science', 'At what temperature does water boil at sea level in Celsius?', array['100°', '90°', '110°', '212°']),
  (39, 'Science', 'Which planet has the most famous rings?', array['Saturn', 'Jupiter', 'Uranus', 'Mars']),
  (40, 'Science', 'What is the largest organ of the human body?', array['Skin', 'Liver', 'Brain', 'Lungs']),
  (41, 'Science', 'What do bees make?', array['Honey', 'Silk', 'Wax paper', 'Pollen tea']),
  (42, 'Science', 'Which animal is the largest mammal?', array['Blue whale', 'African elephant', 'Giraffe', 'Sperm whale']),
  (43, 'Science', 'How many legs does a spider have?', array['8', '6', '10', '12']),
  (44, 'Science', 'What is the chemical symbol for sodium?', array['Na', 'So', 'Sd', 'S']),
  (45, 'Science', 'What is the fastest land animal?', array['Cheetah', 'Lion', 'Pronghorn', 'Greyhound']),
  (46, 'Science', 'Which planet is closest to the Sun?', array['Mercury', 'Venus', 'Mars', 'Earth']),
  (47, 'Science', 'What part of the plant makes food using sunlight?', array['Leaves', 'Roots', 'Stem', 'Flowers']),
  (48, 'Science', 'What kind of animal is a Komodo dragon?', array['Lizard', 'Snake', 'Crocodile', 'Turtle']),
  (49, 'Science', 'How many hearts does an octopus have?', array['3', '1', '2', '4']),
  (50, 'Science', 'What force keeps us on the ground?', array['Gravity', 'Magnetism', 'Friction', 'Inertia']),
  (51, 'Science', 'Which blood type is known as the universal donor?', array['O negative', 'AB positive', 'A positive', 'B negative']),
  (52, 'Science', 'What is the freezing point of water in Fahrenheit?', array['32°', '0°', '10°', '45°']),
  (53, 'Science', 'Which element does the symbol O stand for?', array['Oxygen', 'Osmium', 'Gold', 'Oganesson']),
  (54, 'Science', 'What is a baby kangaroo called?', array['Joey', 'Kit', 'Cub', 'Calf']),
  (55, 'Science', 'Light from the Sun takes about how long to reach Earth?', array['8 minutes', '8 seconds', '8 hours', '1 day']),
  (56, 'Movies & TV', 'Which movie features the line "I''ll be back"?', array['The Terminator', 'Rambo', 'Predator', 'Die Hard']),
  (57, 'Movies & TV', 'Who directed Jaws and Jurassic Park?', array['Steven Spielberg', 'George Lucas', 'James Cameron', 'Ridley Scott']),
  (58, 'Movies & TV', 'What is the name of the toy cowboy in Toy Story?', array['Woody', 'Buzz', 'Jessie', 'Bullseye']),
  (59, 'Movies & TV', 'In The Wizard of Oz, what color are Dorothy''s slippers?', array['Ruby red', 'Silver', 'Emerald green', 'Gold']),
  (60, 'Movies & TV', 'Which movie is the highest-grossing film of all time worldwide?', array['Avatar', 'Avengers: Endgame', 'Titanic', 'Star Wars: The Force Awakens']),
  (61, 'Movies & TV', 'What is the name of the coffee shop in Friends?', array['Central Perk', 'The Daily Grind', 'Java Joe''s', 'Monk''s']),
  (62, 'Movies & TV', 'Who played Jack in Titanic?', array['Leonardo DiCaprio', 'Brad Pitt', 'Matt Damon', 'Johnny Depp']),
  (63, 'Movies & TV', 'In which movie does a shark terrorize Amity Island?', array['Jaws', 'The Meg', 'Deep Blue Sea', 'The Shallows']),
  (64, 'Movies & TV', 'What is Simba''s father''s name in The Lion King?', array['Mufasa', 'Scar', 'Rafiki', 'Zazu']),
  (65, 'Movies & TV', 'Which TV show features the Dunder Mifflin paper company?', array['The Office', 'Parks and Recreation', 'Seinfeld', 'Scrubs']),
  (66, 'Movies & TV', 'Who plays Iron Man in the Marvel movies?', array['Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo']),
  (67, 'Movies & TV', 'What is the name of Harry Potter''s owl?', array['Hedwig', 'Errol', 'Crookshanks', 'Fawkes']),
  (68, 'Movies & TV', 'Which film won the first Academy Award for Best Picture?', array['Wings', 'Casablanca', 'Gone with the Wind', 'Sunrise']),
  (69, 'Movies & TV', 'In Finding Nemo, what kind of fish is Nemo?', array['Clownfish', 'Blue tang', 'Goldfish', 'Angelfish']),
  (70, 'Movies & TV', 'What is the name of the kingdom in Frozen?', array['Arendelle', 'Corona', 'Agrabah', 'DunBroch']),
  (71, 'Movies & TV', 'Which actor played the Joker in The Dark Knight?', array['Heath Ledger', 'Jack Nicholson', 'Joaquin Phoenix', 'Jared Leto']),
  (72, 'Movies & TV', 'In Star Wars, who is Luke Skywalker''s father?', array['Darth Vader', 'Obi-Wan Kenobi', 'Han Solo', 'Yoda']),
  (73, 'Movies & TV', 'Which show is set in the town of Hawkins, Indiana?', array['Stranger Things', 'Riverdale', 'Twin Peaks', 'Gilmore Girls']),
  (74, 'Movies & TV', 'What is the name of the wizarding school in Harry Potter?', array['Hogwarts', 'Durmstrang', 'Beauxbatons', 'Ilvermorny']),
  (75, 'Movies & TV', 'Which animated movie features the song "Let It Go"?', array['Frozen', 'Moana', 'Tangled', 'Encanto']),
  (76, 'Movies & TV', 'In Back to the Future, what car is the time machine?', array['DeLorean', 'Mustang', 'Corvette', 'Camaro']),
  (77, 'Movies & TV', 'Who is the main character of Breaking Bad?', array['Walter White', 'Jesse Pinkman', 'Saul Goodman', 'Hank Schrader']),
  (78, 'Movies & TV', 'Which family lives at 742 Evergreen Terrace?', array['The Simpsons', 'The Griffins', 'The Belchers', 'The Flintstones']),
  (79, 'Movies & TV', 'What color is Shrek?', array['Green', 'Blue', 'Brown', 'Gray']),
  (80, 'Music', 'Which band sang "Hey Jude"?', array['The Beatles', 'The Rolling Stones', 'The Beach Boys', 'Queen']),
  (81, 'Music', 'Who is known as the King of Pop?', array['Michael Jackson', 'Elvis Presley', 'Prince', 'Justin Timberlake']),
  (82, 'Music', 'How many strings does a standard guitar have?', array['6', '4', '5', '8']),
  (83, 'Music', 'Which singer''s fans are called Swifties?', array['Taylor Swift', 'Selena Gomez', 'Katy Perry', 'Ariana Grande']),
  (84, 'Music', 'Freddie Mercury was the lead singer of which band?', array['Queen', 'Aerosmith', 'Journey', 'Def Leppard']),
  (85, 'Music', 'Which instrument has 88 keys?', array['Piano', 'Organ', 'Accordion', 'Harpsichord']),
  (86, 'Music', 'Who sang "Purple Rain"?', array['Prince', 'Michael Jackson', 'David Bowie', 'Stevie Wonder']),
  (87, 'Music', 'Which rapper''s real name is Marshall Mathers?', array['Eminem', 'Drake', '50 Cent', 'Jay-Z']),
  (88, 'Music', 'Elvis Presley''s home is called what?', array['Graceland', 'Neverland', 'Paisley Park', 'Dollywood']),
  (89, 'Music', 'Which country is the band ABBA from?', array['Sweden', 'Norway', 'Denmark', 'Finland']),
  (90, 'Music', 'Beyoncé was in which group before going solo?', array['Destiny''s Child', 'TLC', 'En Vogue', 'Spice Girls']),
  (91, 'Music', 'Who composed the Moonlight Sonata?', array['Beethoven', 'Mozart', 'Bach', 'Chopin']),
  (92, 'Music', 'What is the highest female singing voice?', array['Soprano', 'Alto', 'Mezzo-soprano', 'Tenor']),
  (93, 'Music', 'Which band released "Smells Like Teen Spirit"?', array['Nirvana', 'Pearl Jam', 'Soundgarden', 'Foo Fighters']),
  (94, 'Sports', 'How many players are on a soccer team on the field?', array['11', '9', '10', '12']),
  (95, 'Sports', 'In which sport would you hit a shuttlecock?', array['Badminton', 'Tennis', 'Squash', 'Table tennis']),
  (96, 'Sports', 'How many points is a touchdown worth in American football?', array['6', '3', '7', '2']),
  (97, 'Sports', 'Which country has won the most FIFA World Cups?', array['Brazil', 'Germany', 'Italy', 'Argentina']),
  (98, 'Sports', 'How many holes are on a standard golf course?', array['18', '9', '12', '24']),
  (99, 'Sports', 'Which sport is played at Wimbledon?', array['Tennis', 'Golf', 'Cricket', 'Polo']),
  (100, 'Sports', 'How long is a marathon, in miles (about)?', array['26.2', '13.1', '20', '30']),
  (101, 'Sports', 'Which team has won the most Super Bowls (tied)?', array['Patriots and Steelers', 'Cowboys and 49ers', 'Packers and Giants', 'Broncos and Raiders']),
  (102, 'Sports', 'In basketball, how many points is a shot from behind the arc?', array['3', '2', '4', '1']),
  (103, 'Sports', 'Which country hosted the 2016 Summer Olympics?', array['Brazil', 'China', 'United Kingdom', 'Japan']),
  (104, 'Sports', 'What is the national sport of Japan?', array['Sumo', 'Judo', 'Baseball', 'Karate']),
  (105, 'Sports', 'How many rings are on the Olympic flag?', array['5', '4', '6', '7']),
  (106, 'Sports', 'In bowling, what is it called when you knock down all pins on the first throw?', array['Strike', 'Spare', 'Split', 'Turkey']),
  (107, 'Sports', 'Which athlete has won the most Olympic gold medals?', array['Michael Phelps', 'Usain Bolt', 'Carl Lewis', 'Mark Spitz']),
  (108, 'Sports', 'What sport do the New York Yankees play?', array['Baseball', 'Football', 'Basketball', 'Hockey']),
  (109, 'Sports', 'How many periods are in a regular NHL hockey game?', array['3', '2', '4', '5']),
  (110, 'Sports', 'What is Tiger Woods'' real first name?', array['Eldrick', 'Tyler', 'Edward', 'Thomas']),
  (111, 'Sports', 'The Stanley Cup is the trophy for which sport?', array['Ice hockey', 'Baseball', 'Basketball', 'Soccer']),
  (112, 'History', 'In which year did World War II end?', array['1945', '1944', '1939', '1950']),
  (113, 'History', 'Who was the first President of the United States?', array['George Washington', 'Thomas Jefferson', 'John Adams', 'Abraham Lincoln']),
  (114, 'History', 'In which year did humans first land on the Moon?', array['1969', '1965', '1972', '1959']),
  (115, 'History', 'The ancient city of Rome was built on how many hills?', array['7', '3', '5', '12']),
  (116, 'History', 'Which ship sank in 1912 after hitting an iceberg?', array['Titanic', 'Lusitania', 'Britannic', 'Queen Mary']),
  (117, 'History', 'Who painted the Mona Lisa?', array['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Van Gogh']),
  (118, 'History', 'The Berlin Wall fell in which year?', array['1989', '1991', '1985', '1979']),
  (119, 'History', 'Which civilization built Machu Picchu?', array['Inca', 'Aztec', 'Maya', 'Olmec']),
  (120, 'History', 'Who was the first woman to fly solo across the Atlantic?', array['Amelia Earhart', 'Bessie Coleman', 'Harriet Quimby', 'Jacqueline Cochran']),
  (121, 'History', 'The Declaration of Independence was signed in which year?', array['1776', '1789', '1765', '1801']),
  (122, 'History', 'Which country gave the Statue of Liberty to the US?', array['France', 'United Kingdom', 'Spain', 'Italy']),
  (123, 'History', 'Who invented the telephone (patent 1876)?', array['Alexander Graham Bell', 'Thomas Edison', 'Nikola Tesla', 'Samuel Morse']),
  (124, 'History', 'What was the name of the first artificial satellite?', array['Sputnik 1', 'Explorer 1', 'Vostok 1', 'Apollo 1']),
  (125, 'History', 'Which wonder of the ancient world still stands today?', array['Great Pyramid of Giza', 'Colossus of Rhodes', 'Hanging Gardens of Babylon', 'Lighthouse of Alexandria']),
  (126, 'History', 'Who was the British Prime Minister for most of World War II?', array['Winston Churchill', 'Neville Chamberlain', 'Clement Attlee', 'Margaret Thatcher']),
  (127, 'History', 'Which emperor was the first ruler of a unified China?', array['Qin Shi Huang', 'Kublai Khan', 'Sun Yat-sen', 'Wu Zetian']),
  (128, 'Food', 'What is the main ingredient in guacamole?', array['Avocado', 'Lime', 'Tomato', 'Pea']),
  (129, 'Food', 'Sushi comes from which country?', array['Japan', 'China', 'Korea', 'Thailand']),
  (130, 'Food', 'What kind of pastry is a croissant made from?', array['Laminated (puff-style) dough', 'Choux pastry', 'Shortcrust', 'Filo']),
  (131, 'Food', 'Which nut is used to make marzipan?', array['Almond', 'Peanut', 'Cashew', 'Walnut']),
  (132, 'Food', 'What is the main ingredient of hummus?', array['Chickpeas', 'Lentils', 'Black beans', 'Peas']),
  (133, 'Food', 'Which fruit is known for having its seeds on the outside?', array['Strawberry', 'Raspberry', 'Kiwi', 'Blueberry']),
  (134, 'Food', 'What does a sommelier specialize in?', array['Wine', 'Cheese', 'Bread', 'Coffee']),
  (135, 'Food', 'Which spice gives curry its yellow color?', array['Turmeric', 'Saffron', 'Paprika', 'Cumin']),
  (136, 'Food', 'Parmesan cheese comes from which country?', array['Italy', 'France', 'Switzerland', 'Spain']),
  (137, 'Food', 'What is the most consumed drink in the world after water?', array['Tea', 'Coffee', 'Beer', 'Soda']),
  (138, 'Food', 'Which vegetable is used to make sauerkraut?', array['Cabbage', 'Cucumber', 'Carrot', 'Onion']),
  (139, 'Food', 'A Margherita pizza is topped with tomato, basil and what?', array['Mozzarella', 'Pepperoni', 'Mushrooms', 'Ham']),
  (140, 'Words', 'What is the plural of "mouse" (the animal)?', array['Mice', 'Mouses', 'Meese', 'Mousen']),
  (141, 'Words', 'Which word is a synonym for "happy"?', array['Joyful', 'Somber', 'Weary', 'Hasty']),
  (142, 'Words', 'How many letters are in the English alphabet?', array['26', '24', '25', '28']),
  (143, 'Words', 'What is a word that reads the same backward and forward?', array['Palindrome', 'Anagram', 'Acronym', 'Homonym']),
  (144, 'Words', 'Which of these is a noun?', array['Mountain', 'Quickly', 'Bright', 'Run']),
  (145, 'Words', 'What does "bonjour" mean?', array['Hello', 'Goodbye', 'Thank you', 'Please']),
  (146, 'Words', 'Which language has the most native speakers?', array['Mandarin Chinese', 'English', 'Spanish', 'Hindi']),
  (147, 'Words', '"Hola" means hello in which language?', array['Spanish', 'Italian', 'Portuguese', 'French']),
  (148, 'Words', 'What is the opposite of "ancient"?', array['Modern', 'Old', 'Historic', 'Antique']),
  (149, 'Words', 'Which word is spelled correctly?', array['Necessary', 'Neccessary', 'Necesary', 'Neccesary']),
  (150, 'General', 'How many days are in a leap year?', array['366', '365', '364', '367']),
  (151, 'General', 'How many sides does a hexagon have?', array['6', '5', '7', '8']),
  (152, 'General', 'What color do you get by mixing blue and yellow?', array['Green', 'Purple', 'Orange', 'Brown']),
  (153, 'General', 'How many minutes are in a day?', array['1,440', '1,200', '1,600', '2,400']),
  (154, 'General', 'Which is the largest of these numbers?', array['A million', 'A thousand', 'Ten thousand', 'A hundred thousand']),
  (155, 'General', 'What is the square root of 81?', array['9', '8', '7', '11']),
  (156, 'General', 'How many hours are in a week?', array['168', '144', '120', '196']),
  (157, 'General', 'What shape has three sides?', array['Triangle', 'Square', 'Pentagon', 'Circle']),
  (158, 'General', 'Which month has the fewest days?', array['February', 'April', 'June', 'November']),
  (159, 'General', 'What is 15% of 200?', array['30', '15', '20', '25']),
  (160, 'General', 'How many zeros are in one billion?', array['9', '6', '8', '12']),
  (161, 'General', 'Which planet do we live on?', array['Earth', 'Mars', 'Venus', 'Jupiter']),
  (162, 'General', 'What is the name of the fairy in Peter Pan?', array['Tinker Bell', 'Fauna', 'Navi', 'Silvermist']),
  (163, 'General', 'Which chess piece can only move diagonally?', array['Bishop', 'Rook', 'Knight', 'King']),
  (164, 'General', 'How many cards are in a standard deck (no jokers)?', array['52', '48', '54', '56']),
  (165, 'General', 'What is the currency of Japan?', array['Yen', 'Won', 'Yuan', 'Ringgit']),
  (166, 'General', 'What is the currency of the United Kingdom?', array['Pound sterling', 'Euro', 'Dollar', 'Franc']),
  (167, 'General', 'Which company makes the iPhone?', array['Apple', 'Samsung', 'Google', 'Microsoft']),
  (168, 'General', 'What does the "www" in a web address stand for?', array['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide']),
  (169, 'General', 'Which social app''s logo is a little ghost?', array['Snapchat', 'Instagram', 'TikTok', 'Pinterest'])
on conflict (id) do update
set category = excluded.category, question = excluded.question, choices = excluded.choices;

insert into public.dial_scales (id, left_end, right_end) values
  (1, 'Cold', 'Hot'),
  (2, 'Bad', 'Good'),
  (3, 'Useless', 'Useful'),
  (4, 'Underrated', 'Overrated'),
  (5, 'Boring', 'Exciting'),
  (6, 'Cheap', 'Expensive'),
  (7, 'Easy to do', 'Hard to do'),
  (8, 'Quiet', 'Loud'),
  (9, 'Tiny', 'Huge'),
  (10, 'Soft', 'Hard'),
  (11, 'Slow', 'Fast'),
  (12, 'Weak', 'Strong'),
  (13, 'Old-fashioned', 'Modern'),
  (14, 'Rough', 'Smooth'),
  (15, 'Dry', 'Wet'),
  (16, 'Light', 'Heavy'),
  (17, 'Smells bad', 'Smells good'),
  (18, 'Unhealthy', 'Healthy'),
  (19, 'Ugly', 'Beautiful'),
  (20, 'Casual', 'Formal'),
  (21, 'Sad', 'Happy'),
  (22, 'Normal', 'Weird'),
  (23, 'Rare', 'Common'),
  (24, 'Mild', 'Spicy'),
  (25, 'Bad movie', 'Great movie'),
  (26, 'Villain', 'Hero'),
  (27, 'Hated', 'Loved'),
  (28, 'Kid food', 'Grown-up food'),
  (29, 'Ordinary', 'Extraordinary'),
  (30, 'Useless superpower', 'Amazing superpower'),
  (31, 'Bad pizza topping', 'Great pizza topping'),
  (32, 'Bad gift', 'Great gift'),
  (33, 'Bad pet', 'Great pet'),
  (34, 'Bad habit', 'Good habit'),
  (35, 'Bad first date', 'Great first date'),
  (36, 'Boring job', 'Dream job'),
  (37, 'Bad song', 'Great song'),
  (38, 'Hard to spell', 'Easy to spell'),
  (39, 'Unknown', 'Famous'),
  (40, 'Sweet', 'Salty'),
  (41, 'Dangerous', 'Safe'),
  (42, 'Messy', 'Tidy'),
  (43, 'Nerdy', 'Cool'),
  (44, 'Lazy', 'Hardworking'),
  (45, 'Introvert thing', 'Extrovert thing'),
  (46, 'Morning thing', 'Night thing'),
  (47, 'Summer thing', 'Winter thing'),
  (48, 'Indoor activity', 'Outdoor activity'),
  (49, 'City thing', 'Country thing'),
  (50, 'Calm', 'Chaotic'),
  (51, 'Cute', 'Scary'),
  (52, 'Predictable', 'Surprising'),
  (53, 'Serious', 'Funny'),
  (54, 'Simple', 'Complicated'),
  (55, 'Short', 'Long'),
  (56, 'Low quality', 'High quality'),
  (57, 'Temporary', 'Permanent'),
  (58, 'Forgettable', 'Unforgettable'),
  (59, 'Mainstream', 'Niche'),
  (60, 'Bad advice', 'Good advice'),
  (61, 'Worst chore', 'Least bad chore'),
  (62, 'Rude', 'Polite'),
  (63, 'Underpaid job', 'Overpaid job'),
  (64, 'Bad breakfast', 'Great breakfast'),
  (65, 'Easy sport', 'Hard sport'),
  (66, 'Boring hobby', 'Fun hobby'),
  (67, 'Not worth it', 'Worth it'),
  (68, 'Childish', 'Mature'),
  (69, 'Uncomfortable', 'Comfortable'),
  (70, 'Ugly animal', 'Cute animal'),
  (71, 'Bad invention', 'Great invention'),
  (72, 'Unimportant', 'Important'),
  (73, 'Normal pet', 'Weird pet'),
  (74, 'Tastes bad', 'Tastes good'),
  (75, 'Bad snack', 'Great snack'),
  (76, 'Harmless', 'Deadly'),
  (77, 'Budget', 'Luxury'),
  (78, 'Low-tech', 'High-tech'),
  (79, 'Bargain', 'Rip-off'),
  (80, 'Couch potato', 'Athlete'),
  (81, 'Ancient', 'Futuristic'),
  (82, 'Wallflower', 'Life of the party'),
  (83, 'Least romantic', 'Most romantic'),
  (84, 'Hard to find', 'Easy to find'),
  (85, 'Mean', 'Nice'),
  (86, 'Clean', 'Dirty'),
  (87, 'Plain', 'Fancy'),
  (88, 'Natural', 'Artificial'),
  (89, 'Low-key', 'Extra'),
  (90, 'Worst Disney movie', 'Best Disney movie'),
  (91, 'Worst fast food', 'Best fast food'),
  (92, 'Worst board game', 'Best board game'),
  (93, 'Worst holiday', 'Best holiday'),
  (94, 'Worst day of the week', 'Best day of the week'),
  (95, 'Worst ice cream flavor', 'Best ice cream flavor'),
  (96, 'Worst candy', 'Best candy'),
  (97, 'Worst sport to watch', 'Best sport to watch'),
  (98, 'Worst vegetable', 'Best vegetable'),
  (99, 'Bland', 'Flavorful'),
  (100, 'Unlucky', 'Lucky'),
  (101, 'Obvious', 'Mysterious'),
  (102, 'Peaceful', 'Intense'),
  (103, 'Not a sandwich', 'A sandwich'),
  (104, 'Not a sport', 'A sport'),
  (105, 'Snack', 'Meal'),
  (106, 'Hobby', 'Job'),
  (107, 'Breakfast food', 'Dinner food'),
  (108, 'Easy to draw', 'Hard to draw'),
  (109, 'Overdressed', 'Underdressed'),
  (110, 'Fragile', 'Indestructible'),
  (111, 'Relaxing', 'Stressful'),
  (112, 'Worst smell', 'Best smell'),
  (113, 'Worst place to live', 'Best place to live'),
  (114, 'Bad TV show', 'Great TV show'),
  (115, 'Weird thing to collect', 'Normal thing to collect')
on conflict (id) do update
set left_end = excluded.left_end, right_end = excluded.right_end;

insert into public.hl_categories (category, prompt, unit) values
  ('population', 'Which country has more people?', 'people'),
  ('us_state', 'Which US state has more people? (2020 census)', 'people'),
  ('box_office', 'Which movie made more at the box office worldwide?', 'dollars'),
  ('nba_points', 'Who scored more NBA career points?', 'points'),
  ('mlb_home_runs', 'Who hit more MLB career home runs?', 'home runs'),
  ('grand_slams', 'Who won more Grand Slam singles titles?', 'titles'),
  ('mountain', 'Which mountain is taller?', 'meters')
on conflict (category) do update
set prompt = excluded.prompt, unit = excluded.unit;

insert into public.hl_items (id, category, name, value) values
  (1, 'population', 'India', 1428000000),
  (2, 'population', 'China', 1425000000),
  (3, 'population', 'United States', 340000000),
  (4, 'population', 'Indonesia', 278000000),
  (5, 'population', 'Pakistan', 240000000),
  (6, 'population', 'Nigeria', 224000000),
  (7, 'population', 'Brazil', 216000000),
  (8, 'population', 'Bangladesh', 173000000),
  (9, 'population', 'Russia', 144000000),
  (10, 'population', 'Mexico', 128000000),
  (11, 'population', 'Japan', 124000000),
  (12, 'population', 'Philippines', 117000000),
  (13, 'population', 'Egypt', 113000000),
  (14, 'population', 'Vietnam', 99000000),
  (15, 'population', 'Germany', 84000000),
  (16, 'population', 'Turkey', 85000000),
  (17, 'population', 'Thailand', 72000000),
  (18, 'population', 'United Kingdom', 68000000),
  (19, 'population', 'France', 65000000),
  (20, 'population', 'Italy', 59000000),
  (21, 'population', 'South Africa', 60000000),
  (22, 'population', 'South Korea', 52000000),
  (23, 'population', 'Colombia', 52000000),
  (24, 'population', 'Spain', 48000000),
  (25, 'population', 'Argentina', 46000000),
  (26, 'population', 'Canada', 39000000),
  (27, 'population', 'Saudi Arabia', 37000000),
  (28, 'population', 'Peru', 34000000),
  (29, 'population', 'Australia', 26600000),
  (30, 'population', 'Chile', 19600000),
  (31, 'population', 'Netherlands', 17600000),
  (32, 'population', 'Cuba', 11200000),
  (33, 'population', 'Belgium', 11700000),
  (34, 'population', 'Sweden', 10600000),
  (35, 'population', 'Greece', 10300000),
  (36, 'population', 'Portugal', 10300000),
  (37, 'population', 'Switzerland', 8800000),
  (38, 'population', 'Denmark', 5900000),
  (39, 'population', 'Finland', 5500000),
  (40, 'population', 'Norway', 5500000),
  (41, 'population', 'New Zealand', 5200000),
  (42, 'population', 'Ireland', 5100000),
  (43, 'population', 'Jamaica', 2800000),
  (44, 'population', 'Iceland', 380000),
  (45, 'us_state', 'California', 39500000),
  (46, 'us_state', 'Texas', 29100000),
  (47, 'us_state', 'Florida', 21500000),
  (48, 'us_state', 'New York', 20200000),
  (49, 'us_state', 'Pennsylvania', 13000000),
  (50, 'us_state', 'Illinois', 12800000),
  (51, 'us_state', 'Ohio', 11800000),
  (52, 'us_state', 'Georgia', 10700000),
  (53, 'us_state', 'North Carolina', 10400000),
  (54, 'us_state', 'Michigan', 10100000),
  (55, 'us_state', 'New Jersey', 9300000),
  (56, 'us_state', 'Virginia', 8600000),
  (57, 'us_state', 'Washington', 7700000),
  (58, 'us_state', 'Arizona', 7200000),
  (59, 'us_state', 'Massachusetts', 7000000),
  (60, 'us_state', 'Tennessee', 6900000),
  (61, 'us_state', 'Colorado', 5800000),
  (62, 'us_state', 'Minnesota', 5700000),
  (63, 'us_state', 'Alabama', 5000000),
  (64, 'us_state', 'Louisiana', 4700000),
  (65, 'us_state', 'Oregon', 4200000),
  (66, 'us_state', 'Oklahoma', 4000000),
  (67, 'us_state', 'Utah', 3300000),
  (68, 'us_state', 'Nevada', 3100000),
  (69, 'us_state', 'Kansas', 2900000),
  (70, 'us_state', 'New Mexico', 2100000),
  (71, 'us_state', 'Nebraska', 1960000),
  (72, 'us_state', 'Idaho', 1840000),
  (73, 'us_state', 'Hawaii', 1460000),
  (74, 'us_state', 'Maine', 1360000),
  (75, 'us_state', 'Montana', 1080000),
  (76, 'us_state', 'Delaware', 990000),
  (77, 'us_state', 'South Dakota', 890000),
  (78, 'us_state', 'Alaska', 730000),
  (79, 'us_state', 'Vermont', 640000),
  (80, 'us_state', 'Wyoming', 580000),
  (81, 'box_office', 'Avatar', 2920000000),
  (82, 'box_office', 'Avengers: Endgame', 2800000000),
  (83, 'box_office', 'Avatar: The Way of Water', 2320000000),
  (84, 'box_office', 'Titanic', 2260000000),
  (85, 'box_office', 'Star Wars: The Force Awakens', 2070000000),
  (86, 'box_office', 'Spider-Man: No Way Home', 1920000000),
  (87, 'box_office', 'Jurassic World', 1670000000),
  (88, 'box_office', 'The Lion King (2019)', 1660000000),
  (89, 'box_office', 'The Avengers', 1520000000),
  (90, 'box_office', 'Top Gun: Maverick', 1500000000),
  (91, 'box_office', 'Frozen II', 1450000000),
  (92, 'box_office', 'Barbie', 1450000000),
  (93, 'box_office', 'The Super Mario Bros. Movie', 1360000000),
  (94, 'box_office', 'Black Panther', 1350000000),
  (95, 'box_office', 'Harry Potter and the Deathly Hallows – Part 2', 1340000000),
  (96, 'box_office', 'Frozen', 1280000000),
  (97, 'box_office', 'Incredibles 2', 1240000000),
  (98, 'box_office', 'Minions', 1160000000),
  (99, 'box_office', 'The Dark Knight Rises', 1080000000),
  (100, 'box_office', 'Joker', 1080000000),
  (101, 'box_office', 'Toy Story 4', 1070000000),
  (102, 'box_office', 'Finding Dory', 1030000000),
  (103, 'box_office', 'The Dark Knight', 1010000000),
  (104, 'box_office', 'Oppenheimer', 976000000),
  (105, 'box_office', 'Shrek 2', 930000000),
  (106, 'box_office', 'Inception', 837000000),
  (107, 'box_office', 'Coco', 814000000),
  (108, 'box_office', 'E.T. the Extra-Terrestrial', 797000000),
  (109, 'box_office', 'Deadpool', 783000000),
  (110, 'box_office', 'Up', 735000000),
  (111, 'box_office', 'Forrest Gump', 678000000),
  (112, 'box_office', 'Jaws', 476000000),
  (113, 'box_office', 'Home Alone', 476000000),
  (114, 'box_office', 'The Matrix', 467000000),
  (115, 'box_office', 'Gladiator', 465000000),
  (116, 'box_office', 'Grease', 396000000),
  (117, 'box_office', 'Toy Story', 394000000),
  (118, 'box_office', 'Back to the Future', 381000000),
  (119, 'box_office', 'Elf', 223000000),
  (120, 'box_office', 'Pulp Fiction', 214000000),
  (121, 'box_office', 'Fight Club', 101000000),
  (122, 'box_office', 'Mean Girls', 130000000),
  (123, 'box_office', 'Napoleon Dynamite', 46000000),
  (124, 'nba_points', 'LeBron James', 40474),
  (125, 'nba_points', 'Kareem Abdul-Jabbar', 38387),
  (126, 'nba_points', 'Karl Malone', 36928),
  (127, 'nba_points', 'Kobe Bryant', 33643),
  (128, 'nba_points', 'Michael Jordan', 32292),
  (129, 'nba_points', 'Dirk Nowitzki', 31560),
  (130, 'nba_points', 'Wilt Chamberlain', 31419),
  (131, 'nba_points', 'Shaquille O''Neal', 28596),
  (132, 'nba_points', 'Hakeem Olajuwon', 26946),
  (133, 'nba_points', 'Tim Duncan', 26496),
  (134, 'nba_points', 'Allen Iverson', 24368),
  (135, 'nba_points', 'Larry Bird', 21791),
  (136, 'nba_points', 'Magic Johnson', 17707),
  (137, 'nba_points', 'Yao Ming', 9247),
  (138, 'nba_points', 'Dennis Rodman', 6683),
  (139, 'mlb_home_runs', 'Barry Bonds', 762),
  (140, 'mlb_home_runs', 'Hank Aaron', 755),
  (141, 'mlb_home_runs', 'Babe Ruth', 714),
  (142, 'mlb_home_runs', 'Albert Pujols', 703),
  (143, 'mlb_home_runs', 'Willie Mays', 660),
  (144, 'mlb_home_runs', 'Ken Griffey Jr.', 630),
  (145, 'mlb_home_runs', 'Sammy Sosa', 609),
  (146, 'mlb_home_runs', 'Mickey Mantle', 536),
  (147, 'mlb_home_runs', 'David Ortiz', 541),
  (148, 'mlb_home_runs', 'Ted Williams', 521),
  (149, 'mlb_home_runs', 'Lou Gehrig', 493),
  (150, 'mlb_home_runs', 'Cal Ripken Jr.', 431),
  (151, 'mlb_home_runs', 'Mike Piazza', 427),
  (152, 'mlb_home_runs', 'Joe DiMaggio', 361),
  (153, 'mlb_home_runs', 'Rickey Henderson', 297),
  (154, 'mlb_home_runs', 'Derek Jeter', 260),
  (155, 'mlb_home_runs', 'Pete Rose', 160),
  (156, 'mlb_home_runs', 'Jackie Robinson', 137),
  (157, 'mlb_home_runs', 'Tony Gwynn', 135),
  (158, 'mlb_home_runs', 'Ichiro Suzuki', 117),
  (159, 'grand_slams', 'Novak Djokovic', 24),
  (160, 'grand_slams', 'Serena Williams', 23),
  (161, 'grand_slams', 'Rafael Nadal', 22),
  (162, 'grand_slams', 'Steffi Graf', 22),
  (163, 'grand_slams', 'Roger Federer', 20),
  (164, 'grand_slams', 'Martina Navratilova', 18),
  (165, 'grand_slams', 'Chris Evert', 18),
  (166, 'grand_slams', 'Pete Sampras', 14),
  (167, 'grand_slams', 'Björn Borg', 11),
  (168, 'grand_slams', 'Rod Laver', 11),
  (169, 'grand_slams', 'Andre Agassi', 8),
  (170, 'grand_slams', 'Jimmy Connors', 8),
  (171, 'grand_slams', 'Ivan Lendl', 8),
  (172, 'grand_slams', 'Venus Williams', 7),
  (173, 'grand_slams', 'John McEnroe', 7),
  (174, 'grand_slams', 'Maria Sharapova', 5),
  (175, 'grand_slams', 'Andy Murray', 3),
  (176, 'mountain', 'Mount Everest', 8849),
  (177, 'mountain', 'K2', 8611),
  (178, 'mountain', 'Aconcagua', 6961),
  (179, 'mountain', 'Denali', 6190),
  (180, 'mountain', 'Kilimanjaro', 5895),
  (181, 'mountain', 'Mount Elbrus', 5642),
  (182, 'mountain', 'Mount Kenya', 5199),
  (183, 'mountain', 'Mont Blanc', 4806),
  (184, 'mountain', 'Matterhorn', 4478),
  (185, 'mountain', 'Mount Whitney', 4421),
  (186, 'mountain', 'Mount Rainier', 4392),
  (187, 'mountain', 'Pikes Peak', 4302),
  (188, 'mountain', 'Mount Fuji', 3776),
  (189, 'mountain', 'Aoraki / Mount Cook', 3724),
  (190, 'mountain', 'Mount Olympus (Greece)', 2918),
  (191, 'mountain', 'Mount St. Helens', 2549),
  (192, 'mountain', 'Mount Kosciuszko', 2228),
  (193, 'mountain', 'Mount Washington', 1917),
  (194, 'mountain', 'Ben Nevis', 1345),
  (195, 'mountain', 'Mount Vesuvius', 1281),
  (196, 'mountain', 'Table Mountain', 1085)
on conflict (id) do update
set category = excluded.category, name = excluded.name, value = excluded.value;


-- ---------- Rules ----------

-- Seconds you get: the whole Word Race, each trivia question, each pick.
create or replace function public.dgh_versus_seconds(p_game text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_game
    when 'word_race' then 120
    when 'trivia' then 12
    when 'higher_lower' then 10
  end;
$$;


create or replace function public.dgh_word_points(p_word text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case length(p_word)
    when 3 then 1 when 4 then 2 when 5 then 4 when 6 then 7
    when 7 then 10 when 8 then 14 when 9 then 20 else 0
  end;
$$;


-- True when p_word only uses the letters in p_letters (each one once).
create or replace function public.dgh_uses_letters(p_word text, p_letters text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  left_over text := p_letters;
  pos integer;
  i integer;
begin
  for i in 1..length(p_word) loop
    pos := strpos(left_over, substr(p_word, i, 1));
    if pos = 0 then
      return false;
    end if;
    left_over := overlay(left_over placing '' from pos for 1);
  end loop;

  return true;
end;
$$;


-- The private setup for a new game: the letters, the questions or
-- the pairs. Both players get the same one.
create or replace function public.dgh_versus_setup(p_game text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  seed text;
  pairs jsonb := '[]'::jsonb;
  pick_category text;
  pair integer[];
  i integer;
begin
  if p_game = 'word_race' then
    select word into seed from public.word_race_seeds order by random() limit 1;

    return jsonb_build_object(
      'word', seed,
      'letters', (select string_agg(c, '' order by random()) from regexp_split_to_table(seed, '') c)
    );
  end if;

  if p_game = 'trivia' then
    return jsonb_build_object('questions', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'order', (select jsonb_agg(x order by random()) from generate_series(0, 3) x)
      ))
      from (select id from public.trivia_questions order by random() limit 10) q
    ));
  end if;

  if p_game = 'mind_meld' then
    return '{}'::jsonb;
  end if;

  if p_game = 'dial_in' then
    -- 6 different scales, each with a hidden target from 3 to 97.
    return jsonb_build_object('rounds', (
      select jsonb_agg(jsonb_build_object('scale', id, 'target', 3 + floor(random() * 95)::integer))
      from (select id from public.dial_scales order by random() limit 6) s
    ));
  end if;

  if p_game = 'higher_lower' then
    -- 40 pairs from the same category, at least 25% apart.
    for i in 1..40 loop
      select category into pick_category
      from public.hl_categories order by random() limit 1;

      select case when random() < 0.5 then array[a.id, b.id] else array[b.id, a.id] end
      into pair
      from public.hl_items a
      join public.hl_items b on b.category = a.category and a.value >= b.value * 1.25
      where a.category = pick_category
      order by random()
      limit 1;

      pairs := pairs || jsonb_build_array(to_jsonb(pair));
    end loop;

    return jsonb_build_object('pairs', pairs);
  end if;

  raise exception 'Unknown game.';
end;
$$;

revoke all on function public.dgh_versus_setup(text) from public, anon, authenticated;


-- Trivia: a point for each question you got right faster than them.
create or replace function public.dgh_trivia_points(p_duel uuid, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.versus_moves m
  where m.duel_id = p_duel
    and m.user_id = p_user
    and m.correct
    and not exists (
      select 1 from public.versus_moves o
      where o.duel_id = p_duel
        and o.user_id <> p_user
        and o.n = m.n
        and o.correct
        and o.answered_at - o.served_at < m.answered_at - m.served_at
    );
$$;

revoke all on function public.dgh_trivia_points(uuid, uuid) from public, anon, authenticated;


-- Close turns that ran out of time, and finish the game once both
-- players are done.
create or replace function public.dgh_versus_settle(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
  secs integer;
  a public.versus_plays;
  b public.versus_plays;
  a_points integer;
  b_points integer;
  champ uuid;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or d.game in ('wordle_duel', 'mind_meld', 'dial_in') then
    return;
  end if;

  secs := public.dgh_versus_seconds(d.game);

  -- Questions or picks left unanswered past the time count as wrong.
  update public.versus_moves
  set answered_at = served_at + make_interval(secs => secs), correct = false
  where duel_id = d.id
    and answered_at is null
    and served_at + make_interval(secs => secs + 1) < now();

  -- Finished turns: Word Race when the clock runs out; Higher or Lower
  -- after a miss; Trivia after question 10. A turn left for 15 minutes
  -- also ends.
  update public.versus_plays p
  set finished_at = now()
  where p.duel_id = d.id
    and p.finished_at is null
    and (
      (d.game = 'word_race' and p.started_at + make_interval(secs => secs + 3) < now())
      or (d.game = 'higher_lower' and exists (
        select 1 from public.versus_moves m
        where m.duel_id = d.id and m.user_id = p.user_id and m.correct = false))
      or (d.game = 'trivia' and (
        select count(*) from public.versus_moves m
        where m.duel_id = d.id and m.user_id = p.user_id and m.answered_at is not null) >= 10)
      or p.started_at + interval '15 minutes' < now()
    );

  if d.status <> 'active' then
    return;
  end if;

  select * into a from public.versus_plays where duel_id = d.id and user_id = d.challenger;
  select * into b from public.versus_plays where duel_id = d.id and user_id = d.opponent;

  if a.finished_at is null or b.finished_at is null then
    return;
  end if;

  if d.game = 'trivia' then
    a_points := public.dgh_trivia_points(d.id, d.challenger);
    b_points := public.dgh_trivia_points(d.id, d.opponent);
  else
    a_points := a.score;
    b_points := b.score;
  end if;

  champ := case
    when a_points > b_points then d.challenger
    when b_points > a_points then d.opponent
    -- Higher or Lower tie: the quicker player wins.
    when d.game = 'higher_lower' and a.time_ms < b.time_ms then d.challenger
    when d.game = 'higher_lower' and b.time_ms < a.time_ms then d.opponent
  end;

  update public.duels
  set status = 'finished', finished_at = now(), winner = champ
  where id = d.id;
end;
$$;

revoke all on function public.dgh_versus_settle(uuid) from public, anon, authenticated;


-- A player's turn as they see it.
create or replace function public.dgh_versus_turn(d public.duels, p_user uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'started', p.started_at is not null,
    'finished', p.finished_at is not null,
    'score', case
      when d.game = 'trivia' and d.status = 'finished' then public.dgh_trivia_points(d.id, p_user)
      else coalesce(p.score, 0)
    end,
    'correct', (select count(*) from public.versus_moves m where m.duel_id = d.id and m.user_id = p_user and m.correct),
    'time_ms', coalesce(p.time_ms, 0)
  )
  from (select 1) one
  left join public.versus_plays p on p.duel_id = d.id and p.user_id = p_user;
$$;

revoke all on function public.dgh_versus_turn(public.duels, uuid) from public, anon, authenticated;


-- Mind Meld as one player sees it: the rounds you've both revealed,
-- your word for this round (theirs stays hidden until you've both
-- said one), and the word you matched on.
create or replace function public.dgh_meld_view(d public.duels, me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select round, word from public.mind_meld_words where duel_id = d.id and user_id = me
  ),
  theirs as (
    select round, word from public.mind_meld_words where duel_id = d.id and user_id <> me
  ),
  done as (
    select m.round, m.word as mine, t.word as theirs
    from mine m join theirs t using (round)
  ),
  now_round as (
    select coalesce(max(round), 0) + 1 as round from done
  )
  select json_build_object(
    'rounds', coalesce((select json_agg(json_build_object('mine', mine, 'theirs', theirs) order by round) from done), '[]'::json),
    'round', (select round from now_round),
    'my_word', (select word from mine where round = (select round from now_round)),
    'they_ready', exists (select 1 from theirs where round = (select round from now_round)),
    'matched', case when d.status = 'finished' then nullif(d.answer, '') end
  );
$$;

revoke all on function public.dgh_meld_view(public.duels, uuid) from public, anon, authenticated;


-- Dial In: points for how close the guess is to the target.
create or replace function public.dgh_dial_points(p_guess integer, p_target integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when abs(p_guess - p_target) <= 4 then 4
    when abs(p_guess - p_target) <= 12 then 3
    when abs(p_guess - p_target) <= 20 then 2
    else 0
  end;
$$;


-- Dial In as one player sees it. The challenger gives the clue in odd
-- rounds, the other player in even rounds. You only see the target
-- when you're the one giving the clue, or once the round is guessed.
create or replace function public.dgh_dial_view(d public.duels, me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with plan as (
    select (r.i)::integer as round,
           (r.x ->> 'target')::integer as target,
           sc.left_end, sc.right_end,
           ((r.i % 2 = 1) = (d.challenger = me)) as my_clue
    from jsonb_array_elements(d.setup -> 'rounds') with ordinality r(x, i)
    join public.dial_scales sc on sc.id = (r.x ->> 'scale')::integer
  ),
  played as (
    select p.*, dr.clue, dr.guess, dr.points
    from plan p
    left join public.dial_rounds dr on dr.duel_id = d.id and dr.round = p.round
  ),
  now_round as (
    select coalesce(min(round) filter (where guess is null), 7) as round from played
  )
  select json_build_object(
    'round', (select round from now_round),
    'total', coalesce((select sum(points) from played), 0),
    'rounds', coalesce((
      select json_agg(json_build_object(
        'round', round,
        'left', left_end,
        'right', right_end,
        'my_clue', my_clue,
        'clue', clue,
        'guess', guess,
        'points', points,
        'target', case when guess is not null or my_clue then target end
      ) order by round)
      from played where round <= (select round from now_round)
    ), '[]'::json)
  );
$$;

revoke all on function public.dgh_dial_view(public.duels, uuid) from public, anon, authenticated;


-- Everything one player may see about a duel (all games). Replaces the
-- Wordle-only version from step 1; Wordle Duel fields stay the same.
create or replace function public.dgh_duel_view(d public.duels, me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select n, guess, pattern from public.duel_guesses
    where duel_id = d.id and user_id = me
  ),
  theirs as (
    select n, pattern from public.duel_guesses
    where duel_id = d.id and user_id <> me
  ),
  them as (
    select case when d.challenger = me then d.opponent else d.challenger end as id
  )
  select json_build_object(
    'id', d.id,
    'game', d.game,
    'status', d.status,
    'is_challenger', d.challenger = me,
    'opponent', (select id from them),
    'winner', d.winner,
    'created_at', d.created_at,
    'finished_at', d.finished_at,
    'my_guesses', coalesce((select json_agg(json_build_object('guess', guess, 'pattern', pattern) order by n) from mine), '[]'::json),
    'their_patterns', coalesce((select json_agg(pattern order by n) from theirs), '[]'::json),
    'last_move_at', (select max(created_at) from public.duel_guesses where duel_id = d.id),
    'answer', case when d.status = 'finished' then d.answer end,
    'meld', case when d.game = 'mind_meld' then public.dgh_meld_view(d, me) end,
    'dial', case when d.game = 'dial_in' then public.dgh_dial_view(d, me) end,
    'me', case when d.game <> 'wordle_duel' then public.dgh_versus_turn(d, me) end,
    -- Their score shows once they're done.
    'them', case when d.game <> 'wordle_duel' then (
      select json_build_object(
        'started', (t ->> 'started')::boolean,
        'finished', (t ->> 'finished')::boolean,
        'score', case when (t ->> 'finished')::boolean then (t ->> 'score')::integer end
      )
      from (select public.dgh_versus_turn(d, (select id from them))::jsonb as t) x
    ) end
  );
$$;

revoke all on function public.dgh_duel_view(public.duels, uuid) from public, anon, authenticated;


-- Lets a computer player take its turn, in the test database only:
-- supabase/test-setup/03_bots.sql adds dgh_bot_play. Here (and in the
-- real database) it does nothing.
create or replace function public.dgh_bot_hook(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regprocedure('public.dgh_bot_play(uuid)') is not null
     and coalesce(current_setting('dgh.bot_busy', true), '') <> '1' then
    -- A problem with the bot never stops you seeing or playing games.
    begin
      execute 'select public.dgh_bot_play($1)' using p_duel;
    exception when others then
      raise warning 'Bot skipped: %', sqlerrm;

      if to_regclass('public.dgh_bot_log') is not null then
        execute 'insert into public.dgh_bot_log (duel_id, error) values ($1, $2)' using p_duel, sqlerrm;
      end if;
    end;
  end if;
end;
$$;

revoke all on function public.dgh_bot_hook(uuid) from public, anon, authenticated;


-- Look up a duel you're in, after closing anything that timed out.
create or replace function public.dgh_my_duel(p_duel uuid)
returns public.duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  perform public.dgh_bot_hook(p_duel);
  perform public.dgh_versus_settle(p_duel);

  select * into d from public.duels where id = p_duel;

  if not found or (select auth.uid()) not in (d.challenger, d.opponent) then
    raise exception 'That game was not found.';
  end if;

  return d;
end;
$$;

revoke all on function public.dgh_my_duel(uuid) from public, anon, authenticated;


create or replace function public.duel_state(p_duel uuid)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  -- Two steps so the view sees anything the settle step just closed.
  d := public.dgh_my_duel(p_duel);

  return public.dgh_duel_view(d, (select auth.uid()));
end;
$$;


-- Your duels: open ones, plus finished ones from the last 3 days.
create or replace function public.my_duels()
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  open_id uuid;
begin
  for open_id in
    select id from public.duels
    where (select auth.uid()) in (challenger, opponent)
      and status in ('pending', 'active')
  loop
    perform public.dgh_bot_hook(open_id);
    perform public.dgh_versus_settle(open_id);
  end loop;

  return (
    select coalesce(json_agg(public.dgh_duel_view(d, (select auth.uid())) order by d.created_at desc), '[]'::json)
    from public.duels d
    where (select auth.uid()) in (d.challenger, d.opponent)
      and (d.status in ('pending', 'active') or d.finished_at > now() - interval '3 days')
  );
end;
$$;


-- Challenge someone to one of the new games.
create or replace function public.create_versus(p_opponent uuid, p_game text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  setup jsonb;
  new_id uuid;
begin
  if me is null then
    raise exception 'Log in first';
  end if;

  if p_game not in ('word_race', 'trivia', 'higher_lower', 'mind_meld', 'dial_in') then
    raise exception 'Unknown game.';
  end if;

  if p_opponent is null or p_opponent = me or not public.shares_server_with(p_opponent) then
    raise exception 'You can only challenge people in your servers.';
  end if;

  setup := public.dgh_versus_setup(p_game);

  insert into public.duels (game, challenger, opponent, answer, setup)
  values (p_game, me, p_opponent, coalesce(setup ->> 'word', ''), setup)
  returning id into new_id;

  return new_id;
end;
$$;


-- Load the duel for a move: it must be yours, open, and your turn
-- must have started and not finished.
create or replace function public.dgh_versus_for_move(p_duel uuid, p_game text, p_need_started boolean)
returns public.duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  p public.versus_plays;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game <> p_game then
    raise exception 'That game was not found.';
  end if;

  if not (d.status = 'active' or (d.status = 'pending' and me = d.challenger)) then
    raise exception 'This game is not open.';
  end if;

  select * into p from public.versus_plays where duel_id = d.id and user_id = me;

  if p_need_started and not found then
    raise exception 'Start the game first.';
  end if;

  if p.finished_at is not null then
    raise exception 'Your turn is over.';
  end if;

  return d;
end;
$$;

revoke all on function public.dgh_versus_for_move(uuid, text, boolean) from public, anon, authenticated;


-- Your own turn: what you need to keep playing.
create or replace function public.dgh_versus_mine(d public.duels)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'duel', public.dgh_duel_view(d, (select auth.uid())),
    'letters', case when d.game = 'word_race' and p.started_at is not null then d.setup ->> 'letters' end,
    'seconds_left', case when d.game = 'word_race' and p.started_at is not null and p.finished_at is null then
      greatest(0, ceil(extract(epoch from (p.started_at + interval '120 seconds' - now()))))::integer end,
    'words', case when d.game = 'word_race' then (
      select coalesce(json_agg(json_build_object('word', m.answer, 'points', m.points) order by m.n), '[]'::json)
      from public.versus_moves m where m.duel_id = d.id and m.user_id = (select auth.uid())) end,
    'answered', (select count(*) from public.versus_moves m
      where m.duel_id = d.id and m.user_id = (select auth.uid()) and m.answered_at is not null)
  )
  from (select 1) one
  left join public.versus_plays p on p.duel_id = d.id and p.user_id = (select auth.uid());
$$;

revoke all on function public.dgh_versus_mine(public.duels) from public, anon, authenticated;


-- Start your turn (or pick it back up).
create or replace function public.versus_start(p_duel uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game = 'wordle_duel' then
    raise exception 'That game was not found.';
  end if;

  if d.status = 'active' or (d.status = 'pending' and (select auth.uid()) = d.challenger) then
    insert into public.versus_plays (duel_id, user_id)
    values (d.id, (select auth.uid()))
    on conflict do nothing;
  end if;

  return public.dgh_versus_mine(d);
end;
$$;


-- Word Race: send a word you found.
create or replace function public.word_race_word(p_duel uuid, p_word text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  word text := lower(trim(p_word));
  next_n integer;
  pts integer;
begin
  d := public.dgh_versus_for_move(p_duel, 'word_race', true);

  if word !~ '^[a-z]{3,9}$' then
    raise exception 'Words are 3 to 9 letters.';
  end if;

  if not public.dgh_uses_letters(word, d.setup ->> 'letters') then
    raise exception 'Use only the letters you have.';
  end if;

  if exists (select 1 from public.versus_moves where duel_id = d.id and user_id = me and answer = word) then
    raise exception 'You already found that one.';
  end if;

  select coalesce(max(n), 0) + 1 into next_n
  from public.versus_moves where duel_id = d.id and user_id = me;

  pts := public.dgh_word_points(word);

  insert into public.versus_moves (duel_id, user_id, n, answered_at, answer, correct, points)
  values (d.id, me, next_n, now(), word, true, pts);

  update public.versus_plays set score = score + pts
  where duel_id = d.id and user_id = me;

  return public.dgh_versus_mine(d);
end;
$$;


-- Trivia and Higher or Lower: get your next question or pair. Asking
-- again before answering gives the same one (the clock keeps running).
create or replace function public.versus_next(p_duel uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  last_move public.versus_moves;
  next_n integer;
  q public.trivia_questions;
  ord jsonb;
  pair jsonb;
  a public.hl_items;
  b public.hl_items;
  total integer;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game not in ('trivia', 'higher_lower') then
    raise exception 'That game was not found.';
  end if;

  d := public.dgh_versus_for_move(p_duel, d.game, true);

  select * into last_move from public.versus_moves
  where duel_id = d.id and user_id = me
  order by n desc limit 1;

  if found and last_move.answered_at is null then
    next_n := last_move.n;
  else
    next_n := coalesce(last_move.n, 0) + 1;
    total := case d.game when 'trivia' then 10 else jsonb_array_length(d.setup -> 'pairs') end;

    if next_n > total then
      update public.versus_plays set finished_at = now()
      where duel_id = d.id and user_id = me and finished_at is null;
      perform public.dgh_versus_settle(d.id);
      return json_build_object('done', true);
    end if;

    insert into public.versus_moves (duel_id, user_id, n) values (d.id, me, next_n)
    returning * into last_move;
  end if;

  if d.game = 'trivia' then
    select * into q from public.trivia_questions
    where id = (d.setup -> 'questions' -> (next_n - 1) ->> 'id')::integer;
    ord := d.setup -> 'questions' -> (next_n - 1) -> 'order';

    return json_build_object(
      'n', next_n,
      'total', 10,
      'category', q.category,
      'question', q.question,
      'choices', (select json_agg(q.choices[(x::text)::integer + 1] order by i)
                  from jsonb_array_elements(ord) with ordinality e(x, i)),
      'seconds_left', greatest(0, public.dgh_versus_seconds(d.game)
        - extract(epoch from (now() - last_move.served_at)))
    );
  end if;

  pair := d.setup -> 'pairs' -> (next_n - 1);
  select * into a from public.hl_items where id = (pair ->> 0)::integer;
  select * into b from public.hl_items where id = (pair ->> 1)::integer;

  return json_build_object(
    'n', next_n,
    'streak', next_n - 1,
    'prompt', (select prompt from public.hl_categories where category = a.category),
    'category', a.category,
    'choices', json_build_array(a.name, b.name),
    'seconds_left', greatest(0, public.dgh_versus_seconds(d.game)
      - extract(epoch from (now() - last_move.served_at)))
  );
end;
$$;


-- Answer the current question (trivia) or pick (higher or lower).
-- p_choice is the position you tapped: 0-3 for trivia, 0-1 for pairs.
create or replace function public.versus_answer(p_duel uuid, p_n integer, p_choice integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  m public.versus_moves;
  late boolean;
  is_right boolean;
  right_choice integer;
  pair jsonb;
  a public.hl_items;
  b public.hl_items;
  took integer;
  result json;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game not in ('trivia', 'higher_lower') then
    raise exception 'That game was not found.';
  end if;

  select * into m from public.versus_moves
  where duel_id = d.id and user_id = me and n = p_n
  for update;

  if not found or m.answer is not null then
    raise exception 'That question is closed.';
  end if;

  -- Already closed for running out of time: still say what was right.
  late := m.answered_at is not null
    or now() > m.served_at + make_interval(secs => public.dgh_versus_seconds(d.game) + 1);

  if not late then
    d := public.dgh_versus_for_move(p_duel, d.game, true);
  end if;
  took := least(
    public.dgh_versus_seconds(d.game) * 1000,
    (extract(epoch from (now() - m.served_at)) * 1000)::integer
  );

  if d.game = 'trivia' then
    -- The right answer is wherever choice 0 ended up.
    select (i - 1)::integer into right_choice
    from jsonb_array_elements(d.setup -> 'questions' -> (p_n - 1) -> 'order') with ordinality e(x, i)
    where (x::text)::integer = 0;

    is_right := not late and p_choice = right_choice;

    result := json_build_object('correct', is_right, 'late', late, 'right_choice', right_choice, 'ms', took);
  else
    pair := d.setup -> 'pairs' -> (p_n - 1);
    select * into a from public.hl_items where id = (pair ->> 0)::integer;
    select * into b from public.hl_items where id = (pair ->> 1)::integer;

    right_choice := case when a.value > b.value then 0 else 1 end;
    is_right := not late and p_choice = right_choice;

    result := json_build_object(
      'correct', is_right,
      'late', late,
      'right_choice', right_choice,
      'values', json_build_array(a.value, b.value),
      'unit', (select unit from public.hl_categories where category = a.category),
      'ms', took
    );
  end if;

  update public.versus_moves
  set answered_at = coalesce(answered_at, now()), answer = p_choice::text, correct = is_right,
      points = case when is_right then 1 else 0 end
  where duel_id = d.id and user_id = me and n = p_n;

  update public.versus_plays
  set score = score + case when is_right then 1 else 0 end,
      time_ms = time_ms + took,
      finished_at = coalesce(finished_at, case
        when d.game = 'higher_lower' and not is_right then now()
        when d.game = 'trivia' and p_n >= 10 then now()
      end)
  where duel_id = d.id and user_id = me;

  perform public.dgh_versus_settle(d.id);

  return result;
end;
$$;


-- How it went, for both of you, once the game is over.
create or replace function public.versus_result(p_duel uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  them uuid;
begin
  d := public.dgh_my_duel(p_duel);

  if d.status <> 'finished' or d.game = 'wordle_duel' then
    raise exception 'The results show when the game is over.';
  end if;

  them := case when d.challenger = me then d.opponent else d.challenger end;

  if d.game = 'word_race' then
    return json_build_object(
      'letters', d.setup ->> 'letters',
      'word', d.setup ->> 'word',
      'mine', (select coalesce(json_agg(json_build_object('word', answer, 'points', points) order by points desc, answer), '[]'::json)
               from public.versus_moves where duel_id = d.id and user_id = me),
      'theirs', (select coalesce(json_agg(json_build_object('word', answer, 'points', points) order by points desc, answer), '[]'::json)
                 from public.versus_moves where duel_id = d.id and user_id = them)
    );
  end if;

  if d.game = 'trivia' then
    return json_build_object('questions', (
      select json_agg(json_build_object(
        'n', q.i,
        'question', t.question,
        'answer', t.choices[1],
        'mine', (select json_build_object('correct', coalesce(m.correct, false),
                   'ms', (extract(epoch from (m.answered_at - m.served_at)) * 1000)::integer)
                 from public.versus_moves m where m.duel_id = d.id and m.user_id = me and m.n = q.i),
        'theirs', (select json_build_object('correct', coalesce(m.correct, false),
                   'ms', (extract(epoch from (m.answered_at - m.served_at)) * 1000)::integer)
                   from public.versus_moves m where m.duel_id = d.id and m.user_id = them and m.n = q.i)
      ) order by q.i)
      from jsonb_array_elements(d.setup -> 'questions') with ordinality q(x, i)
      join public.trivia_questions t on t.id = (q.x ->> 'id')::integer
    ));
  end if;

  return json_build_object(
    'mine', (select json_build_object('streak', score, 'ms', time_ms) from public.versus_plays where duel_id = d.id and user_id = me),
    'theirs', (select json_build_object('streak', score, 'ms', time_ms) from public.versus_plays where duel_id = d.id and user_id = them)
  );
end;
$$;


-- Mind Meld: say your word for this round. When you've both said one,
-- they're shown to both of you; the same word means you matched.
-- A word can't be used again once it's been said. Ends after 20 rounds.
create or replace function public.mind_meld_say(p_duel uuid, p_word text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  said text := lower(regexp_replace(trim(p_word), '\s+', ' ', 'g'));
  this_round integer;
  their_word text;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) or d.game <> 'mind_meld' then
    raise exception 'That game was not found.';
  end if;

  if not (d.status = 'active' or (d.status = 'pending' and me = d.challenger)) then
    raise exception 'This game is not open.';
  end if;

  if said !~ '^[a-z]+([ ''-][a-z]+)*$' or length(said) > 30 then
    raise exception 'Use a word (letters only).';
  end if;

  -- The round you're both on: one past the last one you both answered.
  select coalesce(max(m.round), 0) + 1 into this_round
  from public.mind_meld_words m
  join public.mind_meld_words t on t.duel_id = m.duel_id and t.round = m.round and t.user_id <> m.user_id
  where m.duel_id = d.id and m.user_id = me;

  if exists (select 1 from public.mind_meld_words where duel_id = d.id and user_id = me and round = this_round) then
    raise exception 'You already said a word this round.';
  end if;

  if exists (
    select 1 from public.mind_meld_words
    where duel_id = d.id and round < this_round and word = said
  ) then
    raise exception 'That word was already said. Try another.';
  end if;

  insert into public.mind_meld_words (duel_id, user_id, round, word)
  values (d.id, me, this_round, said);

  select m.word into their_word
  from public.mind_meld_words m
  where m.duel_id = d.id and m.user_id <> me and m.round = this_round;

  if d.status = 'active' and their_word is not null and (their_word = said or this_round >= 20) then
    update public.duels
    set status = 'finished',
        finished_at = now(),
        winner = null,
        answer = case when their_word = said then said else '' end
    where id = d.id
    returning * into d;
  end if;

  return public.dgh_duel_view(d, me);
end;
$$;


-- Dial In: the round's clue-giver sends a clue (a word or short phrase).
create or replace function public.dial_clue(p_duel uuid, p_clue text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  clue_text text := regexp_replace(trim(p_clue), '\s+', ' ', 'g');
  this_round integer;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) or d.game <> 'dial_in' then
    raise exception 'That game was not found.';
  end if;

  this_round := (public.dgh_dial_view(d, me) ->> 'round')::integer;

  if not (d.status = 'active' or (d.status = 'pending' and me = d.challenger and this_round = 1)) then
    raise exception 'This game is not open.';
  end if;

  if (this_round % 2 = 1) <> (d.challenger = me) then
    raise exception 'It''s their turn to give the clue.';
  end if;

  if clue_text = '' or length(clue_text) > 40 then
    raise exception 'Clues are 1 to 40 characters.';
  end if;

  if exists (select 1 from public.dial_rounds where duel_id = d.id and round = this_round and clue is not null) then
    raise exception 'You already gave a clue this round.';
  end if;

  insert into public.dial_rounds (duel_id, round, clue, clue_at)
  values (d.id, this_round, clue_text, now());

  return public.dgh_duel_view(d, me);
end;
$$;


-- Dial In: the other player sets the dial (0 = left end, 100 = right).
create or replace function public.dial_guess(p_duel uuid, p_guess integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  this_round integer;
  target integer;
  pts integer;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) or d.game <> 'dial_in' then
    raise exception 'That game was not found.';
  end if;

  if d.status <> 'active' then
    raise exception 'This game is not open.';
  end if;

  if p_guess is null or p_guess not between 0 and 100 then
    raise exception 'Set the dial first.';
  end if;

  this_round := (public.dgh_dial_view(d, me) ->> 'round')::integer;

  if (this_round % 2 = 1) = (d.challenger = me) then
    raise exception 'You gave the clue this round, so they guess.';
  end if;

  if not exists (select 1 from public.dial_rounds where duel_id = d.id and round = this_round and clue is not null) then
    raise exception 'Wait for the clue first.';
  end if;

  target := (d.setup -> 'rounds' -> (this_round - 1) ->> 'target')::integer;
  pts := public.dgh_dial_points(p_guess, target);

  update public.dial_rounds
  set guess = p_guess, guessed_at = now(), points = pts
  where duel_id = d.id and round = this_round and guess is null;

  if this_round >= 6 then
    update public.duels
    set status = 'finished', finished_at = now(), winner = null,
        answer = (select sum(points)::text from public.dial_rounds where duel_id = d.id)
    where id = d.id
    returning * into d;
  end if;

  return public.dgh_duel_view(d, me);
end;
$$;


-- Same as step 1, except ending Mind Meld early has no winner
-- (you play it together).
create or replace function public.cancel_duel(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) then
    raise exception 'That game was not found.';
  end if;

  if d.status = 'pending' and me = d.challenger then
    update public.duels set status = 'cancelled', finished_at = now() where id = p_duel;
  elsif d.status = 'pending' and me = d.opponent then
    update public.duels set status = 'declined', finished_at = now() where id = p_duel;
  elsif d.status = 'active' then
    update public.duels
    set status = 'finished',
        finished_at = now(),
        answer = case when d.game = 'mind_meld' then '' else d.answer end,
        winner = case
          when d.game in ('mind_meld', 'dial_in') then null
          when me = d.challenger then d.opponent
          else d.challenger
        end
    where id = p_duel;
  else
    raise exception 'That game is already over.';
  end if;
end;
$$;


revoke all on function public.dial_clue(uuid, text) from public, anon;
revoke all on function public.dial_guess(uuid, integer) from public, anon;
grant execute on function public.dial_clue(uuid, text) to authenticated;
grant execute on function public.dial_guess(uuid, integer) to authenticated;
revoke all on function public.mind_meld_say(uuid, text) from public, anon;
grant execute on function public.mind_meld_say(uuid, text) to authenticated;
revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;
revoke all on function public.create_versus(uuid, text) from public, anon;
revoke all on function public.versus_start(uuid) from public, anon;
revoke all on function public.word_race_word(uuid, text) from public, anon;
revoke all on function public.versus_next(uuid) from public, anon;
revoke all on function public.versus_answer(uuid, integer, integer) from public, anon;
revoke all on function public.versus_result(uuid) from public, anon;
revoke all on function public.duel_state(uuid) from public, anon;
revoke all on function public.my_duels() from public, anon;
grant execute on function public.create_versus(uuid, text) to authenticated;
grant execute on function public.versus_start(uuid) to authenticated;
grant execute on function public.word_race_word(uuid, text) to authenticated;
grant execute on function public.versus_next(uuid) to authenticated;
grant execute on function public.versus_answer(uuid, integer, integer) to authenticated;
grant execute on function public.versus_result(uuid) to authenticated;
grant execute on function public.duel_state(uuid) to authenticated;
grant execute on function public.my_duels() to authenticated;

-- Check: the game data is loaded.
select 'Word Race starting words' as item, (select count(*) from public.word_race_seeds)::text as value
union all
select 'Trivia questions', (select count(*) from public.trivia_questions)::text
union all
select 'Higher or Lower facts', (select count(*) from public.hl_items)::text
union all
select 'Dial In scales', (select count(*) from public.dial_scales)::text;
