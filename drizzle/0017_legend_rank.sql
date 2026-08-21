UPDATE `profiles`
SET `highest_rate` = CASE `highest_rate`
  WHEN 'マスター 1600〜1799' THEN 'レジェンド 1000〜1199'
  WHEN 'マスター 1800〜1999' THEN 'レジェンド 1200〜1399'
  WHEN 'マスター 2000〜' THEN 'レジェンド 1400〜'
  ELSE `highest_rate`
END
WHERE `highest_rate` IN ('マスター 1600〜1799', 'マスター 1800〜1999', 'マスター 2000〜');
--> statement-breakpoint
UPDATE `recruits`
SET `rank` = CASE `rank`
  WHEN 'マスター 1600〜1799' THEN 'レジェンド 1000〜1199'
  WHEN 'マスター 1800〜1999' THEN 'レジェンド 1200〜1399'
  WHEN 'マスター 2000〜' THEN 'レジェンド 1400〜'
  WHEN 'マスター 1600〜' THEN 'レジェンド 1000〜'
  ELSE `rank`
END
WHERE `rank` IN ('マスター 1600〜1799', 'マスター 1800〜1999', 'マスター 2000〜', 'マスター 1600〜');
