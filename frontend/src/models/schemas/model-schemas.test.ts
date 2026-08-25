import { describe, expect, it } from 'vitest';
import { modelConnectionSchema, modelProfileSchema, parseOptionalNumberInput } from './model-schemas';

describe('model validation', () => {
  it('rejects provider URLs with embedded credentials or query data', () => {
    expect(modelConnectionSchema.safeParse({ name: 'OpenAI', baseUrl: 'https://user:pass@example.com/v1', apiKey: '' }).success).toBe(false);
    expect(modelConnectionSchema.safeParse({ name: 'OpenAI', baseUrl: 'https://example.com/v1?key=x', apiKey: '' }).success).toBe(false);
  });

  it('accepts optional API keys and bounded generation settings', () => {
    expect(modelConnectionSchema.safeParse({ name: 'Local', baseUrl: 'http://localhost:1234/v1', apiKey: '' }).success).toBe(true);
    expect(modelProfileSchema.safeParse({
      connectionId: 'c1',
      displayName: 'Analyst',
      modelName: 'gpt-x',
      enabled: true,
      isDefault: true,
      temperature: 0.2,
      maxTokens: 4000,
    }).success).toBe(true);
  });

  it('converts blank optional numeric form fields to undefined rather than zero', () => {
    expect(parseOptionalNumberInput('')).toBeUndefined();
    expect(parseOptionalNumberInput(undefined)).toBeUndefined();
    expect(parseOptionalNumberInput('0.2')).toBe(0.2);
    expect(parseOptionalNumberInput('4000')).toBe(4000);
  });
});
