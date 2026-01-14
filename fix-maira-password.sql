UPDATE users_auth 
SET password = '$2b$10$bgtSBrEvKQD84VpdayVVs.Si30FBZni/RSPX1t0TvN.A7CsO23ma2' 
WHERE username = 'maira';

SELECT username, LENGTH(password) as hash_length 
FROM users_auth 
WHERE username = 'maira';
