-- 주문 번호 화면에 김밥 마는 법 영상을 답니다. 관리자가 이미 채운 행은 두고 빈 행만 채웁니다.
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then '재료를 받으면 직접 돌돌 말아봐.
처음이어도 영상 보면서 따라 하면 돼.' else body end, version=version+1
 where id='experience' and language='ko' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then 'Once you have your ingredients, roll it yourself.
First time? Just follow along with the video.' else body end, version=version+1
 where id='experience' and language='en' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then '拿到食材后，亲手卷一卷。
第一次也没关系，跟着影片做就好。' else body end, version=version+1
 where id='experience' and language='zh-Hans' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then '拿到食材後，親手捲一捲。
第一次也沒關係，跟著影片做就好。' else body end, version=version+1
 where id='experience' and language='zh-Hant' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then '具材を受け取ったら、自分で巻いてみて。
はじめてでも動画を見ながらで大丈夫。' else body end, version=version+1
 where id='experience' and language='ja' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then 'Setelah menerima bahannya, gulung sendiri.
Baru pertama kali? Ikuti saja videonya.' else body end, version=version+1
 where id='experience' and language='id' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then 'حين تستلم المكوّنات، لُفّها بيدك.
أهي المرة الأولى؟ اتبع الفيديو فحسب.' else body end, version=version+1
 where id='experience' and language='ar' and btrim(video_url)='';
update public.contents set video_url='https://youtu.be/2yJgwwDcgV8', body=case when btrim(body)='' then 'Setelah menerima bahannya, gulung sendiri.
Kali pertama? Ikut sahaja videonya.' else body end, version=version+1
 where id='experience' and language='ms' and btrim(video_url)='';
