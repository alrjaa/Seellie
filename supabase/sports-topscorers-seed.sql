-- Seed topscorers for operational window until API-Football daily quota resets.
-- Edge sync_topscorers will overwrite when the provider succeeds.

insert into public.sports_season_payloads (league_id, season, kind, payload, updated_at)
values
(307, 2024, 'topscorers', '{
  "rows": [
    {"rank":1,"playerId":874,"playerName":"C. Ronaldo","playerPhoto":"https://media.api-sports.io/football/players/874.png","teamId":2939,"teamName":"Al-Nassr","teamLogo":"https://media.api-sports.io/football/teams/2939.png","goals":25,"assists":3,"appearances":30},
    {"rank":2,"playerId":19333,"playerName":"I. Toney","playerPhoto":"https://media.api-sports.io/football/players/19333.png","teamId":2929,"teamName":"Al-Ahli Jeddah","teamLogo":"https://media.api-sports.io/football/teams/2929.png","goals":23,"assists":4,"appearances":30},
    {"rank":3,"playerId":765,"playerName":"K. Benzema","playerPhoto":"https://media.api-sports.io/football/players/765.png","teamId":2938,"teamName":"Al-Ittihad FC","teamLogo":"https://media.api-sports.io/football/teams/2938.png","goals":21,"assists":9,"appearances":29},
    {"rank":4,"playerId":25391,"playerName":"A. Hamdallah","playerPhoto":"https://media.api-sports.io/football/players/25391.png","teamId":2940,"teamName":"Al Shabab","teamLogo":"https://media.api-sports.io/football/teams/2940.png","goals":21,"assists":2,"appearances":26},
    {"rank":5,"playerId":162466,"playerName":"J. Quinones","playerPhoto":"https://media.api-sports.io/football/players/162466.png","teamId":2933,"teamName":"Al-Qadisiyah FC","teamLogo":"https://media.api-sports.io/football/teams/2933.png","goals":20,"assists":5,"appearances":28},
    {"rank":6,"playerId":1485,"playerName":"A. Mitrovic","playerPhoto":"https://media.api-sports.io/football/players/1485.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":19,"assists":4,"appearances":24},
    {"rank":7,"playerId":304,"playerName":"S. Mane","playerPhoto":"https://media.api-sports.io/football/players/304.png","teamId":2939,"teamName":"Al-Nassr","teamLogo":"https://media.api-sports.io/football/teams/2939.png","goals":17,"assists":8,"appearances":32},
    {"rank":8,"playerId":1165,"playerName":"Malcom","playerPhoto":"https://media.api-sports.io/football/players/1165.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":17,"assists":6,"appearances":25},
    {"rank":9,"playerId":1600,"playerName":"S. Al-Dawsari","playerPhoto":"https://media.api-sports.io/football/players/1600.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":15,"assists":10,"appearances":32},
    {"rank":10,"playerId":22224,"playerName":"G. Di Maria","playerPhoto":"https://media.api-sports.io/football/players/22224.png","teamId":2938,"teamName":"Al-Ittihad FC","teamLogo":"https://media.api-sports.io/football/teams/2938.png","goals":15,"assists":12,"appearances":34}
  ]
}'::jsonb, now()),
(307, 2023, 'topscorers', '{
  "rows": [
    {"rank":1,"playerId":874,"playerName":"C. Ronaldo","playerPhoto":"https://media.api-sports.io/football/players/874.png","teamId":2939,"teamName":"Al-Nassr","teamLogo":"https://media.api-sports.io/football/teams/2939.png","goals":35,"assists":11,"appearances":31},
    {"rank":2,"playerId":1485,"playerName":"A. Mitrovic","playerPhoto":"https://media.api-sports.io/football/players/1485.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":28,"assists":8,"appearances":28},
    {"rank":3,"playerId":25391,"playerName":"A. Hamdallah","playerPhoto":"https://media.api-sports.io/football/players/25391.png","teamId":2938,"teamName":"Al-Ittihad FC","teamLogo":"https://media.api-sports.io/football/teams/2938.png","goals":21,"assists":4,"appearances":28},
    {"rank":4,"playerId":765,"playerName":"K. Benzema","playerPhoto":"https://media.api-sports.io/football/players/765.png","teamId":2938,"teamName":"Al-Ittihad FC","teamLogo":"https://media.api-sports.io/football/teams/2938.png","goals":18,"assists":9,"appearances":21},
    {"rank":5,"playerId":304,"playerName":"S. Mane","playerPhoto":"https://media.api-sports.io/football/players/304.png","teamId":2939,"teamName":"Al-Nassr","teamLogo":"https://media.api-sports.io/football/teams/2939.png","goals":13,"assists":8,"appearances":30},
    {"rank":6,"playerId":1600,"playerName":"S. Al-Dawsari","playerPhoto":"https://media.api-sports.io/football/players/1600.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":14,"assists":9,"appearances":30},
    {"rank":7,"playerId":1165,"playerName":"Malcom","playerPhoto":"https://media.api-sports.io/football/players/1165.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":14,"assists":5,"appearances":28},
    {"rank":8,"playerId":22224,"playerName":"G. Di Maria","playerPhoto":"https://media.api-sports.io/football/players/22224.png","teamId":2938,"teamName":"Al-Ittihad FC","teamLogo":"https://media.api-sports.io/football/teams/2938.png","goals":12,"assists":11,"appearances":28},
    {"rank":9,"playerId":843,"playerName":"R. Mahrez","playerPhoto":"https://media.api-sports.io/football/players/843.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":11,"assists":10,"appearances":31},
    {"rank":10,"playerId":276,"playerName":"Neymar","playerPhoto":"https://media.api-sports.io/football/players/276.png","teamId":2932,"teamName":"Al-Hilal Saudi FC","teamLogo":"https://media.api-sports.io/football/teams/2932.png","goals":10,"assists":8,"appearances":18}
  ]
}'::jsonb, now()),
(39, 2024, 'topscorers', '{
  "rows": [
    {"rank":1,"playerId":306,"playerName":"M. Salah","playerPhoto":"https://media.api-sports.io/football/players/306.png","teamId":40,"teamName":"Liverpool","teamLogo":"https://media.api-sports.io/football/teams/40.png","goals":29,"assists":18,"appearances":38},
    {"rank":2,"playerId":184,"playerName":"E. Haaland","playerPhoto":"https://media.api-sports.io/football/players/184.png","teamId":50,"teamName":"Manchester City","teamLogo":"https://media.api-sports.io/football/teams/50.png","goals":22,"assists":3,"appearances":31},
    {"rank":3,"playerId":278,"playerName":"A. Isak","playerPhoto":"https://media.api-sports.io/football/players/278.png","teamId":34,"teamName":"Newcastle","teamLogo":"https://media.api-sports.io/football/teams/34.png","goals":23,"assists":6,"appearances":34},
    {"rank":4,"playerId":152982,"playerName":"C. Palmer","playerPhoto":"https://media.api-sports.io/football/players/152982.png","teamId":49,"teamName":"Chelsea","teamLogo":"https://media.api-sports.io/football/teams/49.png","goals":15,"assists":8,"appearances":37},
    {"rank":5,"playerId":1466,"playerName":"B. Saka","playerPhoto":"https://media.api-sports.io/football/players/1466.png","teamId":42,"teamName":"Arsenal","teamLogo":"https://media.api-sports.io/football/teams/42.png","goals":12,"assists":12,"appearances":35},
    {"rank":6,"playerId":18896,"playerName":"C. Wood","playerPhoto":"https://media.api-sports.io/football/players/18896.png","teamId":65,"teamName":"Nottingham Forest","teamLogo":"https://media.api-sports.io/football/teams/65.png","goals":20,"assists":3,"appearances":36},
    {"rank":7,"playerId":18971,"playerName":"B. Mbeumo","playerPhoto":"https://media.api-sports.io/football/players/18971.png","teamId":55,"teamName":"Brentford","teamLogo":"https://media.api-sports.io/football/teams/55.png","goals":20,"assists":7,"appearances":38},
    {"rank":8,"playerId":129718,"playerName":"Y. Wissa","playerPhoto":"https://media.api-sports.io/football/players/129718.png","teamId":55,"teamName":"Brentford","teamLogo":"https://media.api-sports.io/football/teams/55.png","goals":19,"assists":4,"appearances":35},
    {"rank":9,"playerId":629,"playerName":"O. Watkins","playerPhoto":"https://media.api-sports.io/football/players/629.png","teamId":66,"teamName":"Aston Villa","teamLogo":"https://media.api-sports.io/football/teams/66.png","goals":16,"assists":8,"appearances":38},
    {"rank":10,"playerId":1478,"playerName":"M. Cunha","playerPhoto":"https://media.api-sports.io/football/players/1478.png","teamId":39,"teamName":"Wolves","teamLogo":"https://media.api-sports.io/football/teams/39.png","goals":15,"assists":6,"appearances":33}
  ]
}'::jsonb, now()),
(39, 2023, 'topscorers', '{
  "rows": [
    {"rank":1,"playerId":184,"playerName":"E. Haaland","playerPhoto":"https://media.api-sports.io/football/players/184.png","teamId":50,"teamName":"Manchester City","teamLogo":"https://media.api-sports.io/football/teams/50.png","goals":27,"assists":5,"appearances":31},
    {"rank":2,"playerId":152982,"playerName":"C. Palmer","playerPhoto":"https://media.api-sports.io/football/players/152982.png","teamId":49,"teamName":"Chelsea","teamLogo":"https://media.api-sports.io/football/teams/49.png","goals":22,"assists":11,"appearances":34},
    {"rank":3,"playerId":629,"playerName":"O. Watkins","playerPhoto":"https://media.api-sports.io/football/players/629.png","teamId":66,"teamName":"Aston Villa","teamLogo":"https://media.api-sports.io/football/teams/66.png","goals":19,"assists":13,"appearances":37},
    {"rank":4,"playerId":306,"playerName":"M. Salah","playerPhoto":"https://media.api-sports.io/football/players/306.png","teamId":40,"teamName":"Liverpool","teamLogo":"https://media.api-sports.io/football/teams/40.png","goals":18,"assists":10,"appearances":32},
    {"rank":5,"playerId":1466,"playerName":"B. Saka","playerPhoto":"https://media.api-sports.io/football/players/1466.png","teamId":42,"teamName":"Arsenal","teamLogo":"https://media.api-sports.io/football/teams/42.png","goals":16,"assists":9,"appearances":35},
    {"rank":6,"playerId":19245,"playerName":"D. Solanke","playerPhoto":"https://media.api-sports.io/football/players/19245.png","teamId":35,"teamName":"Bournemouth","teamLogo":"https://media.api-sports.io/football/teams/35.png","goals":19,"assists":3,"appearances":38},
    {"rank":7,"playerId":186,"playerName":"Son Heung-Min","playerPhoto":"https://media.api-sports.io/football/players/186.png","teamId":47,"teamName":"Tottenham","teamLogo":"https://media.api-sports.io/football/teams/47.png","goals":17,"assists":10,"appearances":35},
    {"rank":8,"playerId":1464,"playerName":"J. Mateta","playerPhoto":"https://media.api-sports.io/football/players/1464.png","teamId":52,"teamName":"Crystal Palace","teamLogo":"https://media.api-sports.io/football/teams/52.png","goals":16,"assists":5,"appearances":35},
    {"rank":9,"playerId":18971,"playerName":"B. Mbeumo","playerPhoto":"https://media.api-sports.io/football/players/18971.png","teamId":55,"teamName":"Brentford","teamLogo":"https://media.api-sports.io/football/teams/55.png","goals":15,"assists":6,"appearances":25},
    {"rank":10,"playerId":18896,"playerName":"C. Wood","playerPhoto":"https://media.api-sports.io/football/players/18896.png","teamId":65,"teamName":"Nottingham Forest","teamLogo":"https://media.api-sports.io/football/teams/65.png","goals":14,"assists":1,"appearances":31}
  ]
}'::jsonb, now())
on conflict (league_id, season, kind) do update
set payload = excluded.payload,
    updated_at = now();
