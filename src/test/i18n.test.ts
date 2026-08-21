import { describe, expect, it } from 'vitest';

import { createInitialGameSnapshot, getAnimalPreview } from '../ui/gameBridge';
import { copyFor } from '../ui/i18n';

describe('interface localization', () => {
  it('builds localized initial snapshots and animal previews', () => {
    const chinese = createInitialGameSnapshot('zh');
    const english = createInitialGameSnapshot('en');

    expect(chinese.currentAnimal.name).toBe('小兔');
    expect(english.currentAnimal.name).toBe('Rabbit');
    expect(getAnimalPreview('crocodile', 'zh').trait).toBe('超长桥梁');
    expect(getAnimalPreview('crocodile', 'en').trait).toBe('Long Bridge');
  });

  it('covers the settings and gameplay controls in both languages', () => {
    const chinese = copyFor('zh');
    const english = copyFor('en');

    expect(chinese.language).toBe('语言');
    expect(chinese.drop).toBe('投放');
    expect(english.language).toBe('Language');
    expect(english.drop).toBe('DROP');
    expect(english.viewAllAnimals(13)).toContain('13');
  });
});
