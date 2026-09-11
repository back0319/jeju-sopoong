-- 영상 뒤 문구에서 원물 목록 줄을 뺍니다. 바로 다음 장이 원물 소개라 겹칩니다.
update public.contents set body='안녕! 나는 제주 농사의 신의 후예, 자청이야.
제주 동서남북에서
제주의 맛을 만드는 우리 가족을 소개할게.
내가 진짜 제주를 보여줄게!

이제, 제주를 맛볼 차례야.
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='ko' and body like '%MEET THE TASTE OF JEJU%' and body <> '안녕! 나는 제주 농사의 신의 후예, 자청이야.
제주 동서남북에서
제주의 맛을 만드는 우리 가족을 소개할게.
내가 진짜 제주를 보여줄게!

이제, 제주를 맛볼 차례야.
MEET THE TASTE OF JEJU';
update public.contents set body='Hi! I am Jacheongi, descendant of the god of farming in Jeju.
From every corner of Jeju — east, west, south and north —
let me introduce the family who make the taste of Jeju.
I will show you the real Jeju!

Now it is time to taste Jeju.
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='en' and body like '%MEET THE TASTE OF JEJU%' and body <> 'Hi! I am Jacheongi, descendant of the god of farming in Jeju.
From every corner of Jeju — east, west, south and north —
let me introduce the family who make the taste of Jeju.
I will show you the real Jeju!

Now it is time to taste Jeju.
MEET THE TASTE OF JEJU';
update public.contents set body='こんにちは！わたしは済州の農業の神の子孫、チャチョンイです。
済州の東西南北で
済州の味をつくる家族を紹介します。
本当の済州をお見せします！

さあ、済州を味わう番です。
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='ja' and body like '%MEET THE TASTE OF JEJU%' and body <> 'こんにちは！わたしは済州の農業の神の子孫、チャチョンイです。
済州の東西南北で
済州の味をつくる家族を紹介します。
本当の済州をお見せします！

さあ、済州を味わう番です。
MEET THE TASTE OF JEJU';
update public.contents set body='你好！我是济州农耕之神的后裔，慈清。
在济州的东西南北，
让我来介绍做出济州味道的我们一家人。
我带你看看真正的济州！

现在，该品尝济州了。
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='zh-Hans' and body like '%MEET THE TASTE OF JEJU%' and body <> '你好！我是济州农耕之神的后裔，慈清。
在济州的东西南北，
让我来介绍做出济州味道的我们一家人。
我带你看看真正的济州！

现在，该品尝济州了。
MEET THE TASTE OF JEJU';
update public.contents set body='你好！我是濟州農耕之神的後裔，慈清。
在濟州的東西南北，
讓我來介紹做出濟州味道的我們一家人。
我帶你看看真正的濟州！

現在，該品嚐濟州了。
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='zh-Hant' and body like '%MEET THE TASTE OF JEJU%' and body <> '你好！我是濟州農耕之神的後裔，慈清。
在濟州的東西南北，
讓我來介紹做出濟州味道的我們一家人。
我帶你看看真正的濟州！

現在，該品嚐濟州了。
MEET THE TASTE OF JEJU';
update public.contents set body='Halo! Aku Jacheongi, keturunan dewa pertanian Jeju.
Dari timur, barat, selatan dan utara Jeju,
izinkan aku memperkenalkan keluarga yang menciptakan rasa Jeju.
Aku akan menunjukkan Jeju yang sesungguhnya!

Sekarang, saatnya mencicipi Jeju.
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='id' and body like '%MEET THE TASTE OF JEJU%' and body <> 'Halo! Aku Jacheongi, keturunan dewa pertanian Jeju.
Dari timur, barat, selatan dan utara Jeju,
izinkan aku memperkenalkan keluarga yang menciptakan rasa Jeju.
Aku akan menunjukkan Jeju yang sesungguhnya!

Sekarang, saatnya mencicipi Jeju.
MEET THE TASTE OF JEJU';
update public.contents set body='مرحبًا! أنا جاتشونغي، من نسل إله الزراعة في جيجو.
من شرق جيجو وغربها وجنوبها وشمالها،
دعني أعرّفك بعائلتنا التي تصنع مذاق جيجو.
سأريك جيجو الحقيقية!

والآن، حان وقت تذوّق جيجو.
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='ar' and body like '%MEET THE TASTE OF JEJU%' and body <> 'مرحبًا! أنا جاتشونغي، من نسل إله الزراعة في جيجو.
من شرق جيجو وغربها وجنوبها وشمالها،
دعني أعرّفك بعائلتنا التي تصنع مذاق جيجو.
سأريك جيجو الحقيقية!

والآن، حان وقت تذوّق جيجو.
MEET THE TASTE OF JEJU';
update public.contents set body='Hai! Saya Jacheongi, keturunan dewa pertanian Jeju.
Dari timur, barat, selatan dan utara Jeju,
izinkan saya memperkenalkan keluarga yang mencipta rasa Jeju.
Saya akan tunjukkan Jeju yang sebenar!

Kini, tibalah masanya merasai Jeju.
MEET THE TASTE OF JEJU', version=version+1
 where id='producer' and language='ms' and body like '%MEET THE TASTE OF JEJU%' and body <> 'Hai! Saya Jacheongi, keturunan dewa pertanian Jeju.
Dari timur, barat, selatan dan utara Jeju,
izinkan saya memperkenalkan keluarga yang mencipta rasa Jeju.
Saya akan tunjukkan Jeju yang sebenar!

Kini, tibalah masanya merasai Jeju.
MEET THE TASTE OF JEJU';
