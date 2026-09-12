# 第五マッチ — Design system

## Reference update — supplied Tapple captures

The supplied three screenshots and 22-second screen recording supersede the initial editorial layout below. Use the reference composition directly: a tall photo-first home deck; overlaid name/bio/actions; recommended and received-like segments; a floating five-destination nav; horizontal discovery cards; centered profile; native bottom sheets for details and filters. Use navy text, white surfaces and coral actions. Keep the original Fifth Match icon, name and real service data. Do not reproduce point balances, paid plans, fabricated popularity, extra photos or other people's photos from the references.

The photo card has one progress segment because each current profile has one image. A horizontal swipe skips locally; likes and mate requests still require explicit buttons. The explore screen uses actual public profiles and role filters. Login and first setup behavior is unchanged.

## Initial direction (superseded layout and palette)
Reference: https://x.com/Voxyz_ai/status/2093766772029559077/video/1 introduces reusable DESIGN.md systems; https://styles.refero.design/ is the referenced approach. This implementation uses its explicit-token method, not a copy of an unrelated screen.

Metaphor: an invitation to meet a teammate. Quiet, contemporary and personal; not an imitation of the game's gothic artwork. Tapple informs only the simplicity and small-size legibility of the independent geometric icon.

## Tokens
- Canvas: #F7F6F5. Surface: #FFFFFF. Text: #292127. Secondary: #786E74.
- Primary: #851C3B. Accent: #EE7C82. Tint: #FAF0F2. Border: #E9E3E5.
- System Japanese sans-serif. Body 16px, labels 14px, page title 28–34px.
- Spacing: 4, 8, 12, 16, 24, 32, 48px. Panels 20px corners, controls 12px.
- Icons: 24px outline, 1.8px stroke; no emoji as navigation.

## Layout and behavior
- Desktop: restrained left navigation, one clear working column. Candidate photo and details sit side by side.
- Mobile: full-width content with safe-area-aware bottom navigation. No oversized hero.
- Profile actions distinguish skip, like and mate request. Explain outcomes in a compact guide.
- Empty states use real data only and offer a useful next action. Never fabricate activity.
- Account selection happens after an action; first-time player registration follows account linking.
- Recruitment uses an in-page form instead of browser prompts. Chat has a dedicated scroll region and a stable composer.
- Visible focus, reduced-motion support, 16px input type and meaningful accessible names.

## Boundaries
Styles stay scoped to Fifth Match. Shared APIs, database, authentication and other services are not duplicated. No official game assets or social share artwork changed.
