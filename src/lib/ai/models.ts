/**
 * The single place Firebase AI Logic models are configured.
 * Nova: PREFER_ON_DEVICE (Gemini Nano in Chrome, automatic cloud fallback).
 * Nova (forced cloud) and the Strategist: ONLY_IN_CLOUD.
 */
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, ThinkingLevel, type GenerativeModel } from 'firebase/ai';
import { firebaseApp } from '@/lib/firebase/client';
import { NOVA_SYSTEM, STRATEGIST_SYSTEM } from './prompts';
import { tutorResponseJsonSchema, tutorResponseSchema, strategistSchema } from './schemas';

/** Default cloud model in Firebase JS SDK v13 hybrid mode. */
export const DEFAULT_CLOUD_MODEL = 'gemini-3.5-flash-lite';
export const STRATEGIST_MODEL = process.env.NEXT_PUBLIC_STRATEGIST_MODEL || DEFAULT_CLOUD_MODEL;

export interface Models {
  tutorModel: GenerativeModel;
  tutorCloudModel: GenerativeModel;
  strategistModel: GenerativeModel;
  /** Backup when the configured strategist model is busy or failing (null if it already is the default). */
  strategistFallbackModel: GenerativeModel | null;
}

let models: Models | null = null;

export function getModels(): Models | null {
  if (models) return models;
  const app = firebaseApp();
  if (!app) return null;
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const novaCloudParams = {
    model: DEFAULT_CLOUD_MODEL,
    systemInstruction: NOVA_SYSTEM,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: tutorResponseSchema,
      temperature: 0.4,
      maxOutputTokens: 300,
    },
  };

  const tutorModel = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
        initialPrompts: [{ role: 'system', content: [{ type: 'text', value: NOVA_SYSTEM }] }],
      },
      promptOptions: { responseConstraint: tutorResponseJsonSchema },
    },
    inCloudParams: novaCloudParams,
  });

  const tutorCloudModel = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: novaCloudParams });

  const strategistFor = (model: string) => getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model,
      systemInstruction: STRATEGIST_SYSTEM,
      // Low thinking keeps newer Flash models (e.g. gemini-3.8-flash) to seconds rather than ~30 s+.
      generationConfig: { responseMimeType: 'application/json', responseSchema: strategistSchema, temperature: 0.2, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    },
  });
  const strategistModel = strategistFor(STRATEGIST_MODEL);
  const strategistFallbackModel = STRATEGIST_MODEL === DEFAULT_CLOUD_MODEL ? null : strategistFor(DEFAULT_CLOUD_MODEL);

  models = { tutorModel, tutorCloudModel, strategistModel, strategistFallbackModel };
  return models;
}
