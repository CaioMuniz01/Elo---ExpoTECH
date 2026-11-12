import { createApp } from './app.mjs';
// Deterministic UI fixture: never spends API credits or sends notifications.
createApp(':memory:', { askAI: async ({ context }) => ({ reply: `Olá, ${context.firstName}. Seu contato ${context.trustedContactConfigured ? 'está cadastrado' : 'ainda não está cadastrado'}. Use Preparar SOS se precisar avisá-lo.`, origin: 'ai', provider: 'openai', model: 'ui-test-double', category: 'general' }) }).listen(3002, '127.0.0.1');
