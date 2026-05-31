import { describe, it, expect } from 'vitest';
import type { GoalConfig } from '../types';

// Unit tests for goals CRUD logic used in settings page
// These test the pure functions extracted from the component's state management

function addGoal(goals: GoalConfig[]): GoalConfig[] {
  return [...goals, { name: 'New Goal' as any, weight: 0, keywords: [] }];
}

function removeGoal(goals: GoalConfig[], index: number): GoalConfig[] {
  return goals.filter((_, i) => i !== index);
}

function moveGoal(goals: GoalConfig[], index: number, direction: 'up' | 'down'): GoalConfig[] {
  const newGoals = [...goals];
  const swap = direction === 'up' ? index - 1 : index + 1;
  if (swap < 0 || swap >= newGoals.length) return newGoals;
  [newGoals[index], newGoals[swap]] = [newGoals[swap], newGoals[index]];
  return newGoals;
}

function totalWeight(goals: GoalConfig[]): number {
  return goals.reduce((sum, g) => sum + g.weight, 0);
}

const sampleGoals: GoalConfig[] = [
  { name: '401k' as any, weight: 0.3, keywords: ['401k'] },
  { name: 'Roth IRA' as any, weight: 0.3, keywords: ['roth'] },
  { name: 'Emergency Fund' as any, weight: 0.4, keywords: ['savings'] },
];

describe('Goals CRUD logic', () => {
  describe('addGoal', () => {
    it('appends a new goal with weight 0', () => {
      const result = addGoal(sampleGoals);
      expect(result).toHaveLength(4);
      expect(result[3].name).toBe('New Goal');
      expect(result[3].weight).toBe(0);
    });

    it('does not mutate original array', () => {
      const original = [...sampleGoals];
      addGoal(sampleGoals);
      expect(sampleGoals).toEqual(original);
    });
  });

  describe('removeGoal', () => {
    it('removes goal at specified index', () => {
      const result = removeGoal(sampleGoals, 1);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('401k');
      expect(result[1].name).toBe('Emergency Fund');
    });

    it('preserves total weight minus removed goal', () => {
      const result = removeGoal(sampleGoals, 1);
      expect(totalWeight(result)).toBeCloseTo(0.7);
    });
  });

  describe('moveGoal', () => {
    it('moves goal up', () => {
      const result = moveGoal(sampleGoals, 2, 'up');
      expect(result[1].name).toBe('Emergency Fund');
      expect(result[2].name).toBe('Roth IRA');
    });

    it('moves goal down', () => {
      const result = moveGoal(sampleGoals, 0, 'down');
      expect(result[0].name).toBe('Roth IRA');
      expect(result[1].name).toBe('401k');
    });

    it('no-ops when moving first goal up', () => {
      const result = moveGoal(sampleGoals, 0, 'up');
      expect(result).toEqual(sampleGoals);
    });

    it('no-ops when moving last goal down', () => {
      const result = moveGoal(sampleGoals, 2, 'down');
      expect(result).toEqual(sampleGoals);
    });

    it('preserves total weight after reorder', () => {
      const result = moveGoal(sampleGoals, 1, 'up');
      expect(totalWeight(result)).toBeCloseTo(1.0);
    });
  });

  describe('weight validation', () => {
    it('detects weights summing to 1.0', () => {
      expect(Math.abs(totalWeight(sampleGoals) - 1)).toBeLessThanOrEqual(0.01);
    });

    it('detects weights not summing to 1.0 after removal', () => {
      const result = removeGoal(sampleGoals, 0);
      expect(Math.abs(totalWeight(result) - 1)).toBeGreaterThan(0.01);
    });
  });
});
