import type { CardEffect } from "../card-hand/card-hand";

export type HandCardDefinition = {
    id: string;
    title: string;
    description: string;
    image?: string;
    cost: number;
    effect: CardEffect;
    cardType?: string;
    tags?: string[];
    effectText?: string;
    flavorText?: string;
    artist?: string;
    copyright?: string;
    collectorNumber?: string;
};

export type HandCardContent = HandCardDefinition & { instanceId: string };

export function generateCardInstanceId(baseId: string): string {
    const normalized = baseId?.trim() ? baseId.trim() : "card";

    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${normalized}-${crypto.randomUUID()}`;
    }

    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${normalized}-${Date.now()}-${randomPart}`;
}
