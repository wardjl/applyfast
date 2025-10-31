/**
 * Chrome AI Provider - Vercel AI SDK adapter for Chrome's built-in Gemini Nano
 *
 * This module creates a custom language model provider that integrates Chrome's
 * built-in AI API with the Vercel AI SDK, allowing us to use the same API patterns
 * as our server-side AI calls while running entirely on-device.
 */

/* global LanguageModel */

declare global {
  interface ChromeAISession {
    prompt: (text: string, options?: { responseConstraint?: any }) => Promise<string>;
    promptStreaming: (text: string, options?: { responseConstraint?: any }) => ReadableStream;
    destroy: () => Promise<void>;
  }

  interface ChromeAICapabilities {
    available: 'readily' | 'after-download' | 'no';
    defaultTemperature: number;
    defaultTopK: number;
    maxTopK: number;
  }

  interface ChromeLanguageModel {
    create: (options?: {
      temperature?: number;
      topK?: number;
      initialPrompts?: Array<{ role: string; content: string }>;
    }) => Promise<ChromeAISession>;
    capabilities: () => Promise<ChromeAICapabilities>;
  }

  // Chrome exposes LanguageModel as a global (not under window.ai)
  const LanguageModel: ChromeLanguageModel;
}

export interface ChromeAIModel {
  specificationVersion: 'v2';
  provider: 'chrome-ai';
  modelId: 'gemini-nano';
  doGenerate: (options: any) => Promise<any>;
  doStream: (options: any) => Promise<any>;
}

/**
 * Check if Chrome AI is available in the browser
 */
export async function isChromeAIAvailable(): Promise<boolean> {
  // Try window.ai.languageModel pattern (newer API)
  if ((window as any).ai?.languageModel) {
    try {
      const capabilities = await (window as any).ai.languageModel.capabilities();
      return capabilities.available === 'readily' || capabilities.available === 'after-download';
    } catch (error) {
      // Silently fail - try next method
    }
  }

  // Try self.ai.languageModel
  if ((self as any).ai?.languageModel) {
    try {
      const capabilities = await (self as any).ai.languageModel.capabilities();
      return capabilities.available === 'readily' || capabilities.available === 'after-download';
    } catch (error) {
      // Silently fail - try next method
    }
  }

  // Try LanguageModel constructor (Chrome's built-in AI API)
  if ('LanguageModel' in self) {
    const LM = (self as any).LanguageModel;

    // Chrome AI API uses params() not capabilities()
    if (typeof LM.params === 'function') {
      try {
        await LM.params();
        // If params() works, the API is available
        return true;
      } catch (error) {
        return false;
      }
    }

    // Fallback: try capabilities() if it exists
    if (typeof LM.capabilities === 'function') {
      try {
        const capabilities = await LM.capabilities();
        return capabilities.available === 'readily' || capabilities.available === 'after-download';
      } catch (error) {
        // Silently fail
      }
    }

    return false;
  }

  return false;
}

/**
 * Get Chrome AI capabilities/params
 */
export async function getChromeAICapabilities(): Promise<ChromeAICapabilities> {
  // Try window.ai.languageModel first (newer API)
  if ((window as any).ai?.languageModel?.capabilities) {
    return await (window as any).ai.languageModel.capabilities();
  }

  // Try self.ai.languageModel
  if ((self as any).ai?.languageModel?.capabilities) {
    return await (self as any).ai.languageModel.capabilities();
  }

  // Try LanguageModel.params() (current Chrome API)
  if ('LanguageModel' in self && typeof (self as any).LanguageModel?.params === 'function') {
    const params = await (self as any).LanguageModel.params();
    // params() returns {defaultTemperature, defaultTopK, maxTopK}
    // Convert to capabilities format
    return {
      available: 'readily', // If params() works, it's available
      defaultTemperature: params.defaultTemperature,
      defaultTopK: params.defaultTopK,
      maxTopK: params.maxTopK,
    };
  }

  // Fallback: try capabilities() if it exists
  if ('LanguageModel' in self && typeof (self as any).LanguageModel?.capabilities === 'function') {
    return await (self as any).LanguageModel.capabilities();
  }

  throw new Error('Chrome AI is not available');
}

/**
 * Extract text content from Vercel AI SDK message parts
 */
function extractTextFromParts(parts: any): string {
  if (!Array.isArray(parts)) {
    return '';
  }
  return parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Convert Vercel AI SDK messages to Chrome AI format
 */
function convertPromptToLocalPrompts(messages: any[]) {
  const systemSegments: string[] = [];
  let lastUserMessage = '';

  (messages || []).forEach((message) => {
    if (message.role === 'system') {
      if (typeof message.content === 'string') {
        systemSegments.push(message.content);
      }
      return;
    }
    if (message.role === 'user') {
      const text = extractTextFromParts(message.content);
      if (text) {
        lastUserMessage = text;
      }
    }
  });

  const systemPrompt = systemSegments.filter(Boolean).join('\n\n').trim();
  const userPrompt = lastUserMessage || 'Provide the requested response.';

  return {
    systemPrompt,
    userPrompt,
  };
}

/**
 * Get response constraint from response format (for JSON mode)
 */
function getResponseConstraint(responseFormat: any) {
  if (!responseFormat || typeof responseFormat !== 'object') {
    return undefined;
  }
  if (responseFormat.type === 'json' && responseFormat.schema) {
    return responseFormat.schema;
  }
  return undefined;
}

/**
 * Generate text using Chrome AI (non-streaming)
 */
async function generateWithChromeModel(options: {
  prompt: any[];
  temperature?: number;
  topK?: number;
  responseFormat?: any;
}) {
  const { prompt, temperature = 0.3, topK = 1, responseFormat } = options;
  const { systemPrompt, userPrompt } = convertPromptToLocalPrompts(prompt);

  const createParams: {
    temperature: number;
    topK: number;
    initialPrompts?: Array<{ role: string; content: string }>;
  } = {
    temperature,
    topK: Math.max(1, Math.round(topK)),
  };

  if (systemPrompt) {
    createParams.initialPrompts = [{ role: 'system', content: systemPrompt }];
  }

  // Get the language model API
  let languageModel: ChromeLanguageModel;
  if ((window as any).ai?.languageModel) {
    languageModel = (window as any).ai.languageModel;
  } else if ((self as any).ai?.languageModel) {
    languageModel = (self as any).ai.languageModel;
  } else if ('LanguageModel' in self) {
    languageModel = (self as any).LanguageModel;
  } else {
    throw new Error('LanguageModel API is not available in this browser.');
  }

  let session: ChromeAISession | undefined;
  try {
    session = await languageModel.create(createParams);
    const constraint = getResponseConstraint(responseFormat);
    const text = await session.prompt(
      userPrompt,
      constraint ? { responseConstraint: constraint } : undefined
    );

    return {
      text,
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
      warnings: [],
      response: {
        modelId: 'gemini-nano',
        timestamp: new Date(),
      },
      request: {},
    };
  } finally {
    if (session) {
      try {
        await session.destroy();
      } catch (error) {
        console.warn('Failed to destroy Chrome AI session', error);
      }
    }
  }
}

/**
 * Generate text using Chrome AI with streaming
 */
async function generateWithChromeModelStream(options: {
  prompt: any[];
  temperature?: number;
  topK?: number;
  responseFormat?: any;
}) {
  const { prompt, temperature = 0.3, topK = 1, responseFormat } = options;
  const { systemPrompt, userPrompt } = convertPromptToLocalPrompts(prompt);

  const createParams: {
    temperature: number;
    topK: number;
    initialPrompts?: Array<{ role: string; content: string }>;
  } = {
    temperature,
    topK: Math.max(1, Math.round(topK)),
  };

  if (systemPrompt) {
    createParams.initialPrompts = [{ role: 'system', content: systemPrompt }];
  }

  // Get the language model API
  let languageModel: ChromeLanguageModel;
  if ((window as any).ai?.languageModel) {
    languageModel = (window as any).ai.languageModel;
  } else if ((self as any).ai?.languageModel) {
    languageModel = (self as any).ai.languageModel;
  } else if ('LanguageModel' in self) {
    languageModel = (self as any).LanguageModel;
  } else {
    throw new Error('LanguageModel API is not available in this browser.');
  }

  const responseConstraint = getResponseConstraint(responseFormat);

  let session: ChromeAISession | undefined;
  try {
    session = await languageModel.create(createParams);

    // Check if streaming is supported
    if (typeof session.promptStreaming !== 'function') {
      // Fallback to non-streaming
      const text = await session.prompt(
        userPrompt,
        responseConstraint ? { responseConstraint } : undefined
      );
      return {
        stream: createStaticTextStream(text),
        usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
        warnings: [],
        response: { modelId: 'gemini-nano', timestamp: new Date() },
        request: {},
      };
    }

    const chromeStream = await session.promptStreaming(
      userPrompt,
      responseConstraint ? { responseConstraint } : undefined
    );
    const streamId = `chunk-${Math.random().toString(36).slice(2)}`;
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue({ type: 'text-start', id: streamId });
        let encounteredError = false;
        try {
          // Use for-await to iterate over Chrome's async iterable stream
          for await (const chunk of chromeStream) {
            if (closed) {
              break;
            }
            const delta = typeof chunk === 'string' ? chunk : chunk != null ? String(chunk) : '';
            if (delta) {
              controller.enqueue({ type: 'text-delta', id: streamId, delta });
            }
          }
          if (!closed) {
            controller.enqueue({ type: 'text-end', id: streamId });
          }
        } catch (error) {
          encounteredError = true;
          controller.error(error);
        } finally {
          closed = true;
          if (!encounteredError) {
            try {
              controller.close();
            } catch {
              // ignore close errors when stream already closed
            }
          }
          try {
            await session.destroy();
          } catch (destroyError) {
            console.warn('Failed to destroy Chrome streaming session', destroyError);
          }
        }
      },
      async cancel(reason) {
        closed = true;
        if (chromeStream && typeof (chromeStream as any).cancel === 'function') {
          try {
            await (chromeStream as any).cancel(reason);
          } catch (cancelError) {
            console.warn('Failed to cancel Chrome prompt stream', cancelError);
          }
        }
        try {
          await session.destroy();
        } catch (destroyError) {
          console.warn('Failed to destroy Chrome streaming session', destroyError);
        }
      },
    });

    return {
      stream,
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      warnings: [],
      response: { modelId: 'gemini-nano', timestamp: new Date() },
      request: {},
    };
  } catch (error) {
    if (session) {
      try {
        await session.destroy();
      } catch (destroyError) {
        console.warn('Failed to destroy Chrome streaming session', destroyError);
      }
    }
    throw error;
  }
}

/**
 * Create a static text stream for fallback non-streaming responses
 */
function createStaticTextStream(text: string) {
  const streamId = `chunk-${Math.random().toString(36).slice(2)}`;
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'text-start', id: streamId });
      if (text) {
        controller.enqueue({ type: 'text-delta', id: streamId, delta: text });
      }
      controller.enqueue({ type: 'text-end', id: streamId });
      controller.close();
    },
  });
}

/**
 * Create a Chrome AI language model compatible with Vercel AI SDK
 */
export function createChromeAIModel(): ChromeAIModel {
  return {
    specificationVersion: 'v2',
    provider: 'chrome-ai',
    modelId: 'gemini-nano',
    async doGenerate(options) {
      const result = await generateWithChromeModel(options);
      return {
        content: [{ type: 'text', text: result.text }],
        finishReason: 'stop',
        usage: result.usage,
        warnings: result.warnings,
        providerMetadata: undefined,
        response: result.response,
        request: result.request,
      };
    },
    async doStream(options) {
      const result = await generateWithChromeModelStream(options);
      return {
        stream: result.stream,
        usage: result.usage,
        warnings: result.warnings,
        providerMetadata: undefined,
        response: result.response,
        request: result.request,
      };
    },
  };
}
