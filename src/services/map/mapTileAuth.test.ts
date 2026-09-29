import { getTileAuthRules, TILE_AUTH_RULE_IDS } from './mapTileAuth';

describe('getTileAuthRules', () => {
  it('never registers a token for data-layer tiles — they go through the BFF proxy', () => {
    const rules = getTileAuthRules();
    expect(rules.find(rule => rule.id === 'dcu-huecity-auth')).toBeUndefined();
    // Chỉ còn (tuỳ .env) luật Basic của bản đồ nền map.huecity.vn:8280.
    rules.forEach(rule => expect(rule.id).toBe('map-huecity-tile-auth'));
  });

  it('still lists the retired rule id so an old header gets removed', () => {
    expect(TILE_AUTH_RULE_IDS).toContain('dcu-huecity-auth');
  });
});
