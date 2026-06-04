const express = require('express');
const { auth } = require('../middleware/auth');
const router = express.Router();

// ── AI Code Assistant (Anthropic API) ────────────────────────────────────────
router.post('/assist', auth, async (req, res) => {
  const { code, language, action, error, question } = req.body;
  if (!code && !question) return res.status(400).json({ message: 'Code or question required' });

  const prompts = {
    explain: `You are a helpful coding tutor. Explain this ${language} code clearly and simply for a student:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nExplain what it does step by step in simple terms.`,
    debug: `You are a debugging assistant. This ${language} code has an error:\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nError:\n${error || 'Unknown error'}\n\nFind the bug and explain the fix clearly.`,
    optimize: `You are a code optimization expert. Improve this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nSuggest optimizations for readability, efficiency, and best practices. Show the improved code.`,
    complete: `You are a coding assistant. Complete this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nComplete it logically and explain what you added.`,
    ask: `You are a helpful ${language} programming tutor. Answer this question about the code:\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nQuestion: ${question}\n\nAnswer clearly and helpfully.`,
  };

  const prompt = prompts[action] || prompts.ask;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ message: err.error?.message || 'AI request failed' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'No response';
    res.json({ response: text });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
