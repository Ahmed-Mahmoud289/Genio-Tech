-- Optional sample courses. Run after schema.sql. Safe to skip.
with c as (
  insert into public.courses (title_en,title_ar,desc_en,desc_ar,category,age_track,level,thumb_path) values
  ('Robotics Foundations','أساسيات الروبوتات','Learn the basics of robotics through hands-on building and programming.','تعلّم أساسيات الروبوتات من خلال البناء والبرمجة العملية.','robotics',7,'beginner','/img/c1.jpg'),
  ('Python for Beginners','بايثون للمبتدئين','Start your coding journey with Python and build fun, real-world projects.','ابدأ رحلتك في البرمجة مع بايثون وابنِ مشاريع ممتعة وواقعية.','programming',10,'beginner','/img/c2.jpg'),
  ('Build Your First Smart Project','ابنِ مشروعك الذكي الأول','Combine electronics and programming to create your own smart device.','اجمع بين الإلكترونيات والبرمجة لتصنع جهازك الذكي.','robotics',10,'intermediate','/img/c3.jpg'),
  ('Game Design Basics','أساسيات تصميم الألعاب','Design characters, levels and rules, then build a simple game.','صمّم الشخصيات والمراحل والقواعد ثم ابنِ لعبة بسيطة.','game',7,'beginner',null),
  ('Little Coders','المبرمجون الصغار','Play with colorful blocks and learn how computers follow steps.','العب بالمكعبات الملونة وتعلّم كيف يتبع الحاسوب الخطوات.','programming',4,'beginner',null)
  returning id, title_en
), l as (
  insert into public.lessons (course_id,position,title_en,title_ar,demo_seconds)
  select id,0,'Lesson 1','الدرس 1',30 from c union all
  select id,1,'Lesson 2','الدرس 2',30 from c
  returning id, position
)
insert into public.quizzes (lesson_id,at_second,question,options,correct_index)
select id,10,'Sample question: which one is a robot?','["A toaster that sings","A machine that follows instructions","A sleeping cat"]'::jsonb,1 from l;
