import { describe, it, expect } from 'vitest';
import { validateTemplateVariables, VARIABLE_REGISTRY } from './variable-registry';

describe('Centralized Templates & Variable Validation', () => {
  it('validates template variables correctly when all are provided', () => {
    const text = 'Hello {{patient.firstName}}, welcome to {{practice.name}}!';
    const provided = ['patient.firstName', 'practice.name'];
    const result = validateTemplateVariables(text, provided);
    expect(result.isValid).toBe(true);
    expect(result.unresolved).toHaveLength(0);
  });

  it('detects unresolved template variables', () => {
    const text = 'Hello {{patient.firstName}}, your balance of {{payment.amount}} is due on {{payment.dueDate}}.';
    const provided = ['patient.firstName'];
    const result = validateTemplateVariables(text, provided);
    expect(result.isValid).toBe(false);
    expect(result.unresolved).toEqual(['payment.amount', 'payment.dueDate']);
  });

  it('contains comprehensive variable definitions in registry', () => {
    expect(VARIABLE_REGISTRY.length).toBeGreaterThan(10);
    expect(VARIABLE_REGISTRY.some((v) => v.key === 'patient.fullName')).toBe(true);
    expect(VARIABLE_REGISTRY.some((v) => v.key === 'practice.phone')).toBe(true);
  });
});
