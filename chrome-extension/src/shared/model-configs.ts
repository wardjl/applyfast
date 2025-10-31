export interface ModelConfig {
  name: string;
  description: string;
  cost: number;
  costDescription: string;
  badgeVariant: "free" | "paid";
}

export const MODEL_CONFIGS: Record<"local" | "cloud", ModelConfig> = {
  local: {
    name: "Gemini Nano",
    description: "Local",
    cost: 0,
    costDescription: "Free",
    badgeVariant: "free",
  },
  cloud: {
    name: "Gemini 2.5 Flash Lite",
    description: "Cloud",
    cost: 1,
    costDescription: "1 credit",
    badgeVariant: "paid",
  },
};

export const getModelDisplayName = (model: "local" | "cloud"): string => {
  const config = MODEL_CONFIGS[model];
  return `${config.name} (${config.description})`;
};
