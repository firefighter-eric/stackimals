import { describe, expect, it } from 'vitest';

import { createInitialGameSnapshot, getAnimalPreview } from '../ui/gameBridge';
import { copyFor } from '../ui/i18n';

describe('interface localization', () => {
  it('builds localized initial snapshots and animal previews', () => {
    const chinese = createInitialGameSnapshot('zh');
    const english = createInitialGameSnapshot('en');

    expect(chinese.currentAnimal.name).toBe('小兔');
    expect(english.currentAnimal.name).toBe('Rabbit');
    expect(chinese.swapsHuman).toBe(3);
    expect(chinese.swapsAi).toBe(3);
    expect(getAnimalPreview('crocodile', 'zh').trait).toBe('超长桥梁');
    expect(getAnimalPreview('crocodile', 'en').trait).toBe('Long Bridge');
    expect(getAnimalPreview('tiger', 'zh').trait).toBe('虎尾支撑');
    expect(getAnimalPreview('mouse', 'en').trait).toBe('Tail Filler');
  });

  it('covers the settings and gameplay controls in both languages', () => {
    const chinese = copyFor('zh');
    const english = copyFor('en');

    expect(chinese.language).toBe('语言');
    expect(chinese.gameTitle).toBe('动物叠叠乐');
    expect(chinese.guideLinesOff).toBe('已关闭');
    expect(chinese.drop).toBe('投放');
    expect(chinese.swapAnimalWithCount(3)).toContain('3');
    expect(chinese.chooseAnimal).toBe('选择我的动物');
    expect(chinese.chooseAnimalBody(15)).toContain('不同的动物');
    expect(english.language).toBe('Language');
    expect(english.gameTitle).toBe('STACKIMALS');
    expect(english.guideLinesOn).toBe('On');
    expect(english.drop).toBe('DROP');
    expect(english.swapsRemaining(2)).toContain('2');
    expect(english.chooseAnimal).toBe('Choose My Animal');
    expect(english.chooseAnimalBody(15)).toContain('different animal');
    expect(english.viewAllAnimals(15)).toContain('15');
  });
});
